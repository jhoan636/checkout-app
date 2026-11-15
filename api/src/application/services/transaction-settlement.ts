import { GatewayError, GatewayTransaction } from '../ports/payment-gateway';
import { Clock } from '../ports/system';
import { TransactionRepository } from '../ports/transaction.repository';
import { Result } from '../../domain/shared/result';
import {
  resolveTransaction,
  Transaction,
} from '../../domain/transaction/transaction';
import { TransactionStatus } from '../../domain/transaction/transaction-status';

/**
 * Applies what the gateway said about a payment. Shared by every path that
 * learns a status: the first charge, a later status query and the webhook.
 */
export class TransactionSettlement {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly clock: Clock,
  ) {}

  /** Returns the transaction as it is after applying the answer. */
  async apply(
    transaction: Transaction,
    answer: Result<GatewayTransaction, GatewayError>,
  ): Promise<Transaction> {
    if (!answer.ok) {
      // A refused request charged nothing. Any other failure leaves the
      // outcome unknown, so the transaction stays PENDING to be asked again.
      return answer.error === 'GATEWAY_REJECTED'
        ? this.settle(transaction, 'ERROR', null)
        : transaction;
    }
    if (answer.value.status === 'PENDING') {
      return this.rememberGatewayId(transaction, answer.value.id);
    }
    return this.settle(transaction, answer.value.status, answer.value.id);
  }

  private async rememberGatewayId(
    transaction: Transaction,
    gatewayTransactionId: string,
  ): Promise<Transaction> {
    if (transaction.gatewayTransactionId === gatewayTransactionId) {
      return transaction;
    }
    const at = this.clock.now();
    await this.transactions.assignGatewayId(
      transaction.id,
      gatewayTransactionId,
      at,
    );
    return { ...transaction, gatewayTransactionId, updatedAt: at };
  }

  private async settle(
    transaction: Transaction,
    status: TransactionStatus,
    gatewayTransactionId: string | null,
  ): Promise<Transaction> {
    const resolved = resolveTransaction(transaction, {
      status,
      gatewayTransactionId,
      at: this.clock.now(),
    });
    if (!resolved.ok) {
      return this.stored(transaction);
    }
    const outcome = await this.transactions.settle(resolved.value);
    return outcome === 'ALREADY_FINAL'
      ? this.stored(transaction)
      : resolved.value;
  }

  /** Someone else settled it first: the stored version is the truth. */
  private async stored(transaction: Transaction): Promise<Transaction> {
    return (await this.transactions.findById(transaction.id)) ?? transaction;
  }
}
