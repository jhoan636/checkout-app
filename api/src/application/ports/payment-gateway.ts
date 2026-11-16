import { Result } from '../../domain/shared/result';
import { TransactionStatus } from '../../domain/transaction/transaction-status';

/** Injection token: TypeScript interfaces do not exist at runtime. */
export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

/**
 * A card charge. It carries the card token created in the browser, never the
 * card number, expiry date or security code.
 */
export interface CardCharge {
  readonly reference: string;
  readonly amountInCents: number;
  readonly currency: 'COP';
  readonly customerEmail: string;
  readonly cardToken: string;
  readonly installments: number;
  readonly acceptanceToken: string;
  readonly personalDataAuthToken: string;
}

export interface GatewayTransaction {
  readonly id: string;
  readonly status: TransactionStatus;
  readonly reference: string;
}

export type GatewayError =
  /** Network error, timeout or 5xx: the outcome of the payment is unknown. */
  | 'GATEWAY_UNAVAILABLE'
  /** The gateway refused the request (4xx): nothing was charged. */
  | 'GATEWAY_REJECTED'
  /** The gateway answered something this application cannot interpret. */
  | 'GATEWAY_INVALID_RESPONSE'
  /**
   * The request was never sent, to leave alone a gateway that keeps failing:
   * nothing was charged.
   */
  | 'GATEWAY_NOT_CALLED';

/** Port: what the application needs from the external payment gateway. */
export interface PaymentGateway {
  createCardTransaction(
    charge: CardCharge,
  ): Promise<Result<GatewayTransaction, GatewayError>>;

  findTransaction(
    gatewayTransactionId: string,
  ): Promise<Result<GatewayTransaction, GatewayError>>;

  /**
   * Looks a charge up by the reference this application gave it. Used when
   * the answer to the charge was lost and its gateway id is unknown. The
   * value is null when the gateway has no transaction with that reference.
   */
  findTransactionByReference(
    reference: string,
  ): Promise<Result<GatewayTransaction | null, GatewayError>>;
}
