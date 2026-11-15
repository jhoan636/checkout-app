import { PaymentGateway } from '../ports/payment-gateway';
import { TransactionRepository } from '../ports/transaction.repository';
import { TransactionSettlement } from '../services/transaction-settlement';
import { err, ok, Result } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction/transaction';
import { isFinal } from '../../domain/transaction/transaction-status';

export type GetTransactionError = 'TRANSACTION_NOT_FOUND';

/**
 * Returns a transaction with its most recent status. While it is PENDING the
 * gateway is asked again, so the purchase gets resolved even if the gateway
 * notification never arrives.
 */
export class GetTransactionUseCase {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly gateway: PaymentGateway,
    private readonly settlement: TransactionSettlement,
  ) {}

  async execute(id: string): Promise<Result<Transaction, GetTransactionError>> {
    const transaction = await this.transactions.findById(id);
    if (!transaction) {
      return err('TRANSACTION_NOT_FOUND');
    }
    if (
      isFinal(transaction.status) ||
      transaction.gatewayTransactionId === null
    ) {
      return ok(transaction);
    }

    const answer = await this.gateway.findTransaction(
      transaction.gatewayTransactionId,
    );
    // A failed query says nothing about the payment: keep what is stored.
    if (!answer.ok) {
      return ok(transaction);
    }
    return ok(await this.settlement.apply(transaction, answer));
  }
}
