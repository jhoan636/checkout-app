import { createHash, timingSafeEqual } from 'node:crypto';
import { GatewayEvent } from '../../application/use-cases/handle-gateway-event.use-case';
import { err, ok, Result } from '../../domain/shared/result';
import {
  TRANSACTION_STATUSES,
  TransactionStatus,
} from '../../domain/transaction/transaction-status';

export type GatewayEventError =
  /** Not sent by the gateway, or altered on the way. Must be refused. */
  | 'INVALID_SIGNATURE'
  /** Authentic, but about something this application does not handle. */
  | 'UNSUPPORTED_EVENT'
  /** Authentic, but without the fields this application needs. */
  | 'MALFORMED_EVENT';

const TRANSACTION_UPDATED = 'transaction.updated';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStatus = (value: unknown): value is TransactionStatus =>
  TRANSACTION_STATUSES.includes(value as TransactionStatus);

/**
 * Reads `transaction.status`-like paths from the event data. Only own
 * properties are followed, so a path can never reach the prototype chain.
 */
const valueAt = (data: unknown, path: string): string | null => {
  let current: unknown = data;
  for (const key of path.split('.')) {
    if (!isRecord(current) || !Object.hasOwn(current, key)) {
      return null;
    }
    current = current[key];
  }
  return typeof current === 'string' || typeof current === 'number'
    ? String(current)
    : null;
};

/**
 * The gateway signs each event: SHA-256 of the values named in
 * `signature.properties`, in that order, plus the timestamp and the events
 * secret that only the gateway and this backend know.
 */
const hasValidChecksum = (
  body: Record<string, unknown>,
  secret: string,
): boolean => {
  const { signature, timestamp, data } = body;
  if (
    !isRecord(signature) ||
    typeof signature.checksum !== 'string' ||
    !Array.isArray(signature.properties) ||
    signature.properties.length === 0 ||
    typeof timestamp !== 'number'
  ) {
    return false;
  }

  const values: string[] = [];
  for (const path of signature.properties) {
    const value = typeof path === 'string' ? valueAt(data, path) : null;
    if (value === null) {
      return false;
    }
    values.push(value);
  }

  const expected = createHash('sha256')
    .update(`${values.join('')}${timestamp}${secret}`)
    .digest();
  const received = Buffer.from(signature.checksum, 'hex');
  // Constant-time comparison: the time taken reveals nothing about the hash.
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
};

/** Verifies the signature first; nothing in the event is trusted before. */
export const parseGatewayEvent = (
  body: unknown,
  eventsSecret: string,
): Result<GatewayEvent, GatewayEventError> => {
  if (!isRecord(body) || !hasValidChecksum(body, eventsSecret)) {
    return err('INVALID_SIGNATURE');
  }
  if (body.event !== TRANSACTION_UPDATED) {
    return err('UNSUPPORTED_EVENT');
  }

  const transaction = isRecord(body.data) ? body.data.transaction : undefined;
  if (
    !isRecord(transaction) ||
    typeof transaction.id !== 'string' ||
    typeof transaction.reference !== 'string' ||
    typeof transaction.amount_in_cents !== 'number' ||
    !isStatus(transaction.status)
  ) {
    return err('MALFORMED_EVENT');
  }

  return ok({
    gatewayTransactionId: transaction.id,
    status: transaction.status,
    reference: transaction.reference,
    amountInCents: transaction.amount_in_cents,
  });
};
