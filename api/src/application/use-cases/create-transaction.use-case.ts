import { PaymentGateway } from '../ports/payment-gateway';
import { ProductRepository } from '../ports/product.repository';
import { Clock, IdGenerator } from '../ports/system';
import { TransactionRepository } from '../ports/transaction.repository';
import { TransactionSettlement } from '../services/transaction-settlement';
import { Customer } from '../../domain/customer/customer';
import { DeliveryAddress } from '../../domain/delivery/delivery';
import {
  calculatePaymentSummary,
  Fees,
  PaymentSummaryError,
} from '../../domain/payment/payment-summary';
import { reserveStock, StockError } from '../../domain/product/product';
import { andThen, err, ok, Result } from '../../domain/shared/result';
import {
  createPendingTransaction,
  CreateTransactionError as InvalidTransactionError,
  Transaction,
} from '../../domain/transaction/transaction';

export interface CreateTransactionCommand {
  readonly productId: string;
  readonly quantity: number;
  readonly customer: Customer;
  readonly delivery: DeliveryAddress;
  /** Token created in the browser. The card itself never reaches this API. */
  readonly cardToken: string;
  readonly installments: number;
  readonly acceptanceToken: string;
  readonly personalDataAuthToken: string;
  /**
   * Chosen by the client and sent again on a retry. It becomes the
   * transaction id, so the same purchase can never be charged twice.
   */
  readonly idempotencyKey?: string;
}

export type CreateTransactionError =
  | 'PRODUCT_NOT_FOUND'
  | StockError
  | PaymentSummaryError
  | InvalidTransactionError;

/**
 * Starts a purchase. An error means nothing was stored or charged. A success
 * returns the transaction in whatever status the gateway left it, PENDING
 * included: the final status may arrive later.
 */
export class CreateTransactionUseCase {
  constructor(
    private readonly products: ProductRepository,
    private readonly transactions: TransactionRepository,
    private readonly gateway: PaymentGateway,
    private readonly settlement: TransactionSettlement,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly fees: Fees,
  ) {}

  async execute(
    command: CreateTransactionCommand,
  ): Promise<Result<Transaction, CreateTransactionError>> {
    if (command.idempotencyKey) {
      const existing = await this.transactions.findById(command.idempotencyKey);
      if (existing) {
        return ok(existing);
      }
    }

    const product = await this.products.findById(command.productId);
    if (!product) {
      return err('PRODUCT_NOT_FOUND');
    }

    const id = command.idempotencyKey ?? this.ids.uuid();

    // One railway: each step runs only if the one before succeeded, and the
    // first failure is the answer. The amount always comes from the stored
    // price, never from the client.
    const order = andThen(
      andThen(reserveStock(product, command.quantity), () =>
        calculatePaymentSummary(
          {
            unitPriceInCents: product.priceInCents,
            quantity: command.quantity,
          },
          this.fees,
        ),
      ),
      (summary) =>
        createPendingTransaction({
          id,
          reference: `ORDER-${id}`,
          productId: product.id,
          quantity: command.quantity,
          unitPriceInCents: product.priceInCents,
          baseFeeInCents: summary.baseFeeInCents,
          deliveryFeeInCents: summary.deliveryFeeInCents,
          amountInCents: summary.totalInCents,
          createdAt: this.clock.now(),
        }),
    );
    if (!order.ok) {
      return order;
    }
    const transaction = order.value;

    // Stored as PENDING, with its units reserved, before the gateway is
    // called: if that call is lost, the purchase is still on record and can
    // be resolved later, and nobody is charged for units already taken.
    const stored = await this.transactions.createPending({
      transaction,
      customer: command.customer,
      delivery: command.delivery,
    });
    if (stored === 'DUPLICATE') {
      // A simultaneous request with the same key won; it does the charging.
      return ok((await this.transactions.findById(id)) ?? transaction);
    }
    if (stored === 'INSUFFICIENT_STOCK') {
      // Another purchase reserved the units between the check and this one.
      return err('INSUFFICIENT_STOCK');
    }

    const answer = await this.gateway.createCardTransaction({
      reference: transaction.reference,
      amountInCents: transaction.amountInCents,
      currency: transaction.currency,
      customerEmail: command.customer.email,
      cardToken: command.cardToken,
      installments: command.installments,
      acceptanceToken: command.acceptanceToken,
      personalDataAuthToken: command.personalDataAuthToken,
    });

    return ok(await this.settlement.apply(transaction, answer));
  }
}
