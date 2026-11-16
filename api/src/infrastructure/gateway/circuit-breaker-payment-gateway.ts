import {
  CardCharge,
  GatewayError,
  GatewayTransaction,
  PaymentGateway,
} from '../../application/ports/payment-gateway';
import { Clock } from '../../application/ports/system';
import { err, fromPromise, Result } from '../../domain/shared/result';

export interface CircuitBreakerConfig {
  /** Failures in a row that open the circuit. */
  readonly failureThreshold: number;
  /** How long the gateway is left alone before one trial call is allowed. */
  readonly cooldownMs: number;
}

export type CircuitState = 'OPEN' | 'CLOSED';

type Answer = Result<GatewayTransaction, GatewayError>;

/**
 * Circuit breaker around the payment gateway (decorator of the port).
 *
 * - Closed: every call goes through. Failures in a row are counted.
 * - Open: after too many failures the gateway is not called at all; callers
 *   get `GATEWAY_NOT_CALLED` at once instead of waiting for a timeout.
 * - Half open: after the cooldown one single call is let through. If it
 *   works the circuit closes; if not, it opens for another cooldown.
 *
 * Only `GATEWAY_UNAVAILABLE` counts as a failure. A refused request or an
 * unreadable answer means the gateway is up.
 *
 * The state lives in memory, so each instance of the API has its own.
 */
export class CircuitBreakerPaymentGateway implements PaymentGateway {
  private failuresInARow = 0;
  private openedAt: number | null = null;
  private trialInFlight = false;

  constructor(
    private readonly inner: PaymentGateway,
    private readonly config: CircuitBreakerConfig,
    private readonly clock: Clock,
    private readonly onStateChange: (state: CircuitState) => void = () =>
      undefined,
  ) {}

  createCardTransaction(charge: CardCharge): Promise<Answer> {
    return this.guard(() => this.inner.createCardTransaction(charge));
  }

  findTransaction(gatewayTransactionId: string): Promise<Answer> {
    return this.guard(() => this.inner.findTransaction(gatewayTransactionId));
  }

  private async guard(call: () => Promise<Answer>): Promise<Answer> {
    const isTrial = this.openedAt !== null;
    if (isTrial) {
      const cooledDown =
        this.now() - (this.openedAt as number) >= this.config.cooldownMs;
      if (!cooledDown || this.trialInFlight) {
        return err('GATEWAY_NOT_CALLED');
      }
      this.trialInFlight = true;
    }

    // The adapter promises not to throw; a breaker must not rely on it.
    const settled = await fromPromise(
      Promise.resolve().then(call),
      (): GatewayError => 'GATEWAY_UNAVAILABLE',
    );
    const answer: Answer = settled.ok ? settled.value : settled;

    if (isTrial) {
      this.trialInFlight = false;
    }
    this.record(answer, isTrial);
    return answer;
  }

  private record(answer: Answer, wasTrial: boolean): void {
    const failed = !answer.ok && answer.error === 'GATEWAY_UNAVAILABLE';
    if (!failed) {
      this.failuresInARow = 0;
      if (this.openedAt !== null) {
        this.openedAt = null;
        this.onStateChange('CLOSED');
      }
      return;
    }

    this.failuresInARow += 1;
    const mustOpen =
      wasTrial ||
      (this.openedAt === null &&
        this.failuresInARow >= this.config.failureThreshold);
    if (mustOpen) {
      this.openedAt = this.now();
      this.onStateChange('OPEN');
    }
  }

  private now(): number {
    return this.clock.now().getTime();
  }
}
