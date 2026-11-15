import { isPositiveInteger } from '../shared/quantity';
import { err, ok, Result } from '../shared/result';
import {
  canTransition,
  isFinal,
  TransactionStatus,
} from './transaction-status';

export interface Transaction {
  readonly id: string;
  /** Unique reference sent to the payment gateway. */
  readonly reference: string;
  readonly productId: string;
  readonly quantity: number;
  /** Total charged, as an integer amount of cents. */
  readonly amountInCents: number;
  readonly currency: 'COP';
  readonly status: TransactionStatus;
  /** Id given by the gateway; unknown until the gateway answers. */
  readonly gatewayTransactionId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewTransaction {
  readonly id: string;
  readonly reference: string;
  readonly productId: string;
  readonly quantity: number;
  readonly amountInCents: number;
  readonly createdAt: Date;
}

export type CreateTransactionError = 'INVALID_QUANTITY' | 'INVALID_AMOUNT';

/** Every transaction is born PENDING, before the gateway is called. */
export const createPendingTransaction = (
  input: NewTransaction,
): Result<Transaction, CreateTransactionError> => {
  if (!isPositiveInteger(input.quantity)) {
    return err('INVALID_QUANTITY');
  }
  if (!isPositiveInteger(input.amountInCents)) {
    return err('INVALID_AMOUNT');
  }
  return ok({
    ...input,
    currency: 'COP',
    status: 'PENDING',
    gatewayTransactionId: null,
    updatedAt: input.createdAt,
  });
};

export interface Resolution {
  readonly status: TransactionStatus;
  readonly gatewayTransactionId: string;
  readonly at: Date;
}

export type ResolveTransactionError =
  'TRANSACTION_ALREADY_FINAL' | 'INVALID_STATUS_TRANSITION';

/**
 * Applies the final status reported by the gateway. A transaction that is
 * already final is never changed, so a repeated notification has no effect.
 */
export const resolveTransaction = (
  transaction: Transaction,
  resolution: Resolution,
): Result<Transaction, ResolveTransactionError> => {
  if (isFinal(transaction.status)) {
    return err('TRANSACTION_ALREADY_FINAL');
  }
  if (!canTransition(transaction.status, resolution.status)) {
    return err('INVALID_STATUS_TRANSITION');
  }
  return ok({
    ...transaction,
    status: resolution.status,
    gatewayTransactionId: resolution.gatewayTransactionId,
    updatedAt: resolution.at,
  });
};
