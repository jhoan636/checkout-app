import {
  CardCharge,
  GatewayError,
  GatewayTransaction,
  PaymentGateway,
} from '../ports/payment-gateway';
import { ProductRepository } from '../ports/product.repository';
import { Clock, IdGenerator } from '../ports/system';
import {
  PendingOrder,
  SettleOutcome,
  TransactionRepository,
} from '../ports/transaction.repository';
import { DeliveryStatus } from '../../domain/delivery/delivery';
import { Product } from '../../domain/product/product';
import { ok, Result } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction/transaction';

/** Test doubles that behave like the real adapters, but in memory. */

export class InMemoryProductRepository implements ProductRepository {
  constructor(private readonly products: Map<string, Product>) {}

  static with(...products: Product[]): InMemoryProductRepository {
    return new InMemoryProductRepository(
      new Map(products.map((product) => [product.id, product])),
    );
  }

  findAll(): Promise<Product[]> {
    return Promise.resolve([...this.products.values()]);
  }

  findById(id: string): Promise<Product | null> {
    return Promise.resolve(this.products.get(id) ?? null);
  }

  stockOf(id: string): number | undefined {
    return this.products.get(id)?.stock;
  }

  /** Same rule as the database: never below zero. */
  decreaseStock(id: string, quantity: number): boolean {
    const product = this.products.get(id);
    if (!product || product.stock < quantity) {
      return false;
    }
    this.products.set(id, { ...product, stock: product.stock - quantity });
    return true;
  }
}

export class InMemoryTransactionRepository implements TransactionRepository {
  readonly orders = new Map<string, PendingOrder>();
  readonly deliveries = new Map<string, DeliveryStatus>();

  constructor(private readonly products: InMemoryProductRepository) {}

  createPending(order: PendingOrder): Promise<void> {
    this.orders.set(order.transaction.id, order);
    this.deliveries.set(order.transaction.id, 'PENDING');
    return Promise.resolve();
  }

  findById(id: string): Promise<Transaction | null> {
    return Promise.resolve(this.orders.get(id)?.transaction ?? null);
  }

  findByReference(reference: string): Promise<Transaction | null> {
    const order = [...this.orders.values()].find(
      (candidate) => candidate.transaction.reference === reference,
    );
    return Promise.resolve(order?.transaction ?? null);
  }

  assignGatewayId(
    id: string,
    gatewayTransactionId: string,
    at: Date,
  ): Promise<void> {
    const order = this.orders.get(id);
    if (order) {
      this.orders.set(id, {
        ...order,
        transaction: {
          ...order.transaction,
          gatewayTransactionId,
          updatedAt: at,
        },
      });
    }
    return Promise.resolve();
  }

  settle(transaction: Transaction): Promise<SettleOutcome> {
    const order = this.orders.get(transaction.id);
    if (!order || order.transaction.status !== 'PENDING') {
      return Promise.resolve('ALREADY_FINAL');
    }
    this.orders.set(transaction.id, { ...order, transaction });
    if (transaction.status !== 'APPROVED') {
      return Promise.resolve('SETTLED');
    }
    if (
      !this.products.decreaseStock(transaction.productId, transaction.quantity)
    ) {
      return Promise.resolve('APPROVED_WITHOUT_STOCK');
    }
    this.deliveries.set(transaction.id, 'ASSIGNED');
    return Promise.resolve('SETTLED');
  }
}

export class FakePaymentGateway implements PaymentGateway {
  readonly charges: CardCharge[] = [];
  readonly queries: string[] = [];

  constructor(
    public answer: Result<GatewayTransaction, GatewayError> = ok({
      id: 'gw-1',
      status: 'APPROVED',
      reference: 'unused',
    }),
  ) {}

  createCardTransaction(
    charge: CardCharge,
  ): Promise<Result<GatewayTransaction, GatewayError>> {
    this.charges.push(charge);
    return Promise.resolve(this.answer);
  }

  findTransaction(
    gatewayTransactionId: string,
  ): Promise<Result<GatewayTransaction, GatewayError>> {
    this.queries.push(gatewayTransactionId);
    return Promise.resolve(this.answer);
  }
}

export class FixedClock implements Clock {
  constructor(public current: Date) {}

  now(): Date {
    return this.current;
  }
}

export class SequentialIds implements IdGenerator {
  private next = 1;

  uuid(): string {
    return `id-${this.next++}`;
  }
}
