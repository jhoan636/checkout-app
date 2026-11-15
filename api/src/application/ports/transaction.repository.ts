import { Customer } from '../../domain/customer/customer';
import {
  DeliveryAddress,
  DeliveryStatus,
} from '../../domain/delivery/delivery';
import { Transaction } from '../../domain/transaction/transaction';

/** Injection token: TypeScript interfaces do not exist at runtime. */
export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');

export interface PendingOrder {
  readonly transaction: Transaction;
  readonly customer: Customer;
  readonly delivery: DeliveryAddress;
}

export interface OrderDetails {
  readonly transaction: Transaction;
  readonly customer: Customer;
  readonly delivery: DeliveryAddress & { readonly status: DeliveryStatus };
}

export type CreateOutcome =
  | 'CREATED'
  /** A transaction with that id already exists; nothing was stored. */
  | 'DUPLICATE';

export type SettleOutcome =
  /** Final status stored; on approval, stock decreased and delivery assigned. */
  | 'SETTLED'
  /** Another request settled it first; nothing was changed. */
  | 'ALREADY_FINAL'
  /** Approved and stored, but there was no stock left to assign. */
  | 'APPROVED_WITHOUT_STOCK';

/** Port: what the application needs to store and settle transactions. */
export interface TransactionRepository {
  /** Stores customer, transaction and delivery together, or nothing. */
  createPending(order: PendingOrder): Promise<CreateOutcome>;

  findById(id: string): Promise<Transaction | null>;

  findByReference(reference: string): Promise<Transaction | null>;

  findOrderById(id: string): Promise<OrderDetails | null>;

  assignGatewayId(
    id: string,
    gatewayTransactionId: string,
    at: Date,
  ): Promise<void>;

  /**
   * Stores the final status only if the transaction is still PENDING. When
   * approved it also decreases the stock and assigns the delivery, all in one
   * database transaction, so a repeated notification can never do it twice.
   */
  settle(transaction: Transaction): Promise<SettleOutcome>;
}
