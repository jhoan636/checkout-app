import {
  CardCharge,
  GatewayError,
  GatewayTransaction,
  PaymentGateway,
} from '../../application/ports/payment-gateway';
import { err, fromPromise, ok, Result } from '../../domain/shared/result';
import {
  TRANSACTION_STATUSES,
  TransactionStatus,
} from '../../domain/transaction/transaction-status';
import { buildIntegritySignature } from './integrity-signature';

export interface GatewayConfig {
  readonly baseUrl: string;
  readonly privateKey: string;
  readonly integritySecret: string;
  readonly timeoutMs: number;
}

const SERVER_ERROR = 500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStatus = (value: unknown): value is TransactionStatus =>
  TRANSACTION_STATUSES.includes(value as TransactionStatus);

/** Accepts only the fields this application needs, and only if well formed. */
const parseTransaction = (
  body: unknown,
): Result<GatewayTransaction, GatewayError> => {
  const data = isRecord(body) ? body.data : undefined;
  if (
    !isRecord(data) ||
    typeof data.id !== 'string' ||
    typeof data.reference !== 'string' ||
    !isStatus(data.status)
  ) {
    return err('GATEWAY_INVALID_RESPONSE');
  }
  return ok({ id: data.id, status: data.status, reference: data.reference });
};

/** A search answers a list; a reference identifies at most one charge. */
const parseSearch = (
  body: unknown,
): Result<GatewayTransaction | null, GatewayError> => {
  const data = isRecord(body) ? body.data : undefined;
  if (!Array.isArray(data)) {
    return err('GATEWAY_INVALID_RESPONSE');
  }
  const [first] = data as unknown[];
  return data.length === 0 ? ok(null) : parseTransaction({ data: first });
};

/**
 * Adapter: talks to the payment gateway over HTTPS. It never throws and never
 * logs: requests carry the private key and the card token.
 */
export class HttpPaymentGateway implements PaymentGateway {
  constructor(
    private readonly config: GatewayConfig,
    private readonly httpFetch: typeof fetch = fetch,
  ) {}

  createCardTransaction(
    charge: CardCharge,
  ): Promise<Result<GatewayTransaction, GatewayError>> {
    return this.request(parseTransaction, '/transactions', {
      method: 'POST',
      body: JSON.stringify({
        amount_in_cents: charge.amountInCents,
        currency: charge.currency,
        signature: buildIntegritySignature(charge, this.config.integritySecret),
        customer_email: charge.customerEmail,
        reference: charge.reference,
        acceptance_token: charge.acceptanceToken,
        accept_personal_auth: charge.personalDataAuthToken,
        payment_method: {
          type: 'CARD',
          token: charge.cardToken,
          installments: charge.installments,
        },
      }),
    });
  }

  findTransaction(
    gatewayTransactionId: string,
  ): Promise<Result<GatewayTransaction, GatewayError>> {
    return this.request(
      parseTransaction,
      `/transactions/${encodeURIComponent(gatewayTransactionId)}`,
      { method: 'GET' },
    );
  }

  findTransactionByReference(
    reference: string,
  ): Promise<Result<GatewayTransaction | null, GatewayError>> {
    return this.request(
      parseSearch,
      `/transactions?reference=${encodeURIComponent(reference)}`,
      { method: 'GET' },
    );
  }

  private async request<T>(
    parse: (body: unknown) => Result<T, GatewayError>,
    path: string,
    init: { method: 'GET' | 'POST'; body?: string },
  ): Promise<Result<T, GatewayError>> {
    const response = await fromPromise(
      this.httpFetch(`${this.config.baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${this.config.privateKey}`,
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      }),
      (): GatewayError => 'GATEWAY_UNAVAILABLE',
    );
    if (!response.ok) {
      return response;
    }

    const { status } = response.value;
    if (status >= SERVER_ERROR) {
      return err('GATEWAY_UNAVAILABLE');
    }
    if (!response.value.ok) {
      return err('GATEWAY_REJECTED');
    }

    const body = await fromPromise<unknown, GatewayError>(
      response.value.json(),
      () => 'GATEWAY_INVALID_RESPONSE',
    );
    return body.ok ? parse(body.value) : body;
  }
}
