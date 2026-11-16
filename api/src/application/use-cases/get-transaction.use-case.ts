import { PaymentGateway } from '../ports/payment-gateway';
import { Clock } from '../ports/system';
import { TransactionRepository } from '../ports/transaction.repository';
import { TransactionSettlement } from '../services/transaction-settlement';
import { err, ok, Result } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction/transaction';
import { isFinal } from '../../domain/transaction/transaction-status';

export type GetTransactionError = 'TRANSACTION_NOT_FOUND';

/**
 * A charge the gateway still does not know after this long never reached it.
 * Far longer than the longest time the gateway call is allowed to take.
 */
export const NEVER_ARRIVED_AFTER_MS = 2 * 60 * 1000;

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
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<Result<Transaction, GetTransactionError>> {
    const transaction = await this.transactions.findById(id);
    if (!transaction) {
      return err('TRANSACTION_NOT_FOUND');
    }
    if (isFinal(transaction.status)) {
      return ok(transaction);
    }
    if (transaction.gatewayTransactionId === null) {
      return ok(await this.recover(transaction));
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

  /**
   * The answer to the charge was lost (a timeout, a restart), so its gateway
   * id is unknown. The gateway is asked by reference instead.
   */
  private async recover(transaction: Transaction): Promise<Transaction> {
    const answer = await this.gateway.findTransactionByReference(
      transaction.reference,
    );
    if (!answer.ok) {
      return transaction;
    }
    if (answer.value) {
      return this.settlement.apply(transaction, ok(answer.value));
    }
    // The gateway does not know it. Early on the charge may still be on its
    // way; later it is certain that it never arrived and nothing was charged.
    const age = this.clock.now().getTime() - transaction.createdAt.getTime();
    return age >= NEVER_ARRIVED_AFTER_MS
      ? this.settlement.closeAsNotCharged(transaction)
      : transaction;
  }
}
