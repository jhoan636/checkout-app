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
  /** Stored, and its units taken out of the stock. */
  | 'CREATED'
  /** A transaction with that id already exists; nothing was stored. */
  | 'DUPLICATE'
  /** Another purchase took the units first; nothing was stored. */
  | 'INSUFFICIENT_STOCK';

export type SettleOutcome =
  /**
   * Final status stored. On approval the delivery was assigned; on any other
   * outcome the reserved units went back to the stock.
   */
  | 'SETTLED'
  /** Another request settled it first; nothing was changed. */
  | 'ALREADY_FINAL';

/** Port: what the application needs to store and settle transactions. */
export interface TransactionRepository {
  /**
   * Stores customer, transaction and delivery and reserves the units, all in
   * one database transaction. Reserving before charging means a card is
   * never charged for units that someone else already bought.
   */
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
   * approved it also assigns the delivery; otherwise it gives the reserved
   * units back. All in one database transaction, so a repeated notification
   * can never do it twice.
   */
  settle(transaction: Transaction): Promise<SettleOutcome>;
}
