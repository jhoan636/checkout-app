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
import { err, ok, Result } from '../../domain/shared/result';
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
    const product = await this.products.findById(command.productId);
    if (!product) {
      return err('PRODUCT_NOT_FOUND');
    }

    const available = reserveStock(product, command.quantity);
    if (!available.ok) {
      return available;
    }

    // The amount always comes from the stored price, never from the client.
    const summary = calculatePaymentSummary(
      { unitPriceInCents: product.priceInCents, quantity: command.quantity },
      this.fees,
    );
    if (!summary.ok) {
      return summary;
    }

    const id = this.ids.uuid();
    const created = createPendingTransaction({
      id,
      reference: `ORDER-${id}`,
      productId: product.id,
      quantity: command.quantity,
      unitPriceInCents: product.priceInCents,
      baseFeeInCents: summary.value.baseFeeInCents,
      deliveryFeeInCents: summary.value.deliveryFeeInCents,
      amountInCents: summary.value.totalInCents,
      createdAt: this.clock.now(),
    });
    if (!created.ok) {
      return created;
    }
    const transaction = created.value;

    // Stored as PENDING first: if the gateway call is lost, the purchase is
    // still on record and can be resolved later.
    await this.transactions.createPending({
      transaction,
      customer: command.customer,
      delivery: command.delivery,
    });

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
