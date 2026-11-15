import { TransactionRepository } from '../ports/transaction.repository';
import { TransactionSettlement } from '../services/transaction-settlement';
import { ok } from '../../domain/shared/result';
import {
  isFinal,
  TransactionStatus,
} from '../../domain/transaction/transaction-status';

/** A gateway notification, already verified as authentic. */
export interface GatewayEvent {
  readonly gatewayTransactionId: string;
  readonly status: TransactionStatus;
  readonly reference: string;
  readonly amountInCents: number;
}

export type GatewayEventOutcome =
  | 'APPLIED'
  | 'STILL_PENDING'
  | 'ALREADY_FINAL'
  | 'UNKNOWN_REFERENCE'
  | 'AMOUNT_MISMATCH';

/**
 * Applies a status notification from the gateway. Safe to receive any number
 * of times and in any order: only the first final status has an effect.
 */
export class HandleGatewayEventUseCase {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly settlement: TransactionSettlement,
  ) {}

  async execute(event: GatewayEvent): Promise<GatewayEventOutcome> {
    const transaction = await this.transactions.findByReference(
      event.reference,
    );
    if (!transaction) {
      return 'UNKNOWN_REFERENCE';
    }
    // The event must be about the exact amount this backend asked to charge.
    if (transaction.amountInCents !== event.amountInCents) {
      return 'AMOUNT_MISMATCH';
    }
    if (isFinal(transaction.status)) {
      return 'ALREADY_FINAL';
    }

    const updated = await this.settlement.apply(
      transaction,
      ok({
        id: event.gatewayTransactionId,
        status: event.status,
        reference: event.reference,
      }),
    );
    return isFinal(updated.status) ? 'APPLIED' : 'STILL_PENDING';
  }
}
