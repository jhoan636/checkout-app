import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import {
  PendingOrder,
  SettleOutcome,
  TransactionRepository,
} from '../../../application/ports/transaction.repository';
import { Transaction } from '../../../domain/transaction/transaction';
import { TransactionStatus } from '../../../domain/transaction/transaction-status';
import { CustomerOrmEntity } from '../entities/customer.orm-entity';
import { DeliveryOrmEntity } from '../entities/delivery.orm-entity';
import { ProductOrmEntity } from '../entities/product.orm-entity';
import { TransactionOrmEntity } from '../entities/transaction.orm-entity';
import { isUuid } from './uuid';

const toDomain = (row: TransactionOrmEntity): Transaction => ({
  id: row.id,
  reference: row.reference,
  productId: row.productId,
  quantity: row.quantity,
  unitPriceInCents: row.unitPriceInCents,
  baseFeeInCents: row.baseFeeInCents,
  deliveryFeeInCents: row.deliveryFeeInCents,
  amountInCents: row.amountInCents,
  currency: 'COP',
  status: row.status as TransactionStatus,
  gatewayTransactionId: row.gatewayTransactionId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Adapter: implements the port with TypeORM and PostgreSQL. */
@Injectable()
export class TypeOrmTransactionRepository implements TransactionRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createPending(order: PendingOrder): Promise<void> {
    const { transaction, customer, delivery } = order;

    // One database transaction: the three rows are stored together or not at all.
    await this.dataSource.transaction(async (manager) => {
      const customerRow = await manager.save(CustomerOrmEntity, {
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      });
      await manager.insert(TransactionOrmEntity, {
        id: transaction.id,
        reference: transaction.reference,
        productId: transaction.productId,
        customerId: customerRow.id,
        quantity: transaction.quantity,
        unitPriceInCents: transaction.unitPriceInCents,
        baseFeeInCents: transaction.baseFeeInCents,
        deliveryFeeInCents: transaction.deliveryFeeInCents,
        amountInCents: transaction.amountInCents,
        currency: transaction.currency,
        status: transaction.status,
        gatewayTransactionId: transaction.gatewayTransactionId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      });
      await manager.insert(DeliveryOrmEntity, {
        transactionId: transaction.id,
        addressLine: delivery.addressLine,
        city: delivery.city,
        region: delivery.region,
        postalCode: delivery.postalCode,
        status: 'PENDING',
      });
    });
  }

  async findById(id: string): Promise<Transaction | null> {
    if (!isUuid(id)) {
      return null;
    }
    const row = await this.dataSource
      .getRepository(TransactionOrmEntity)
      .findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async findByReference(reference: string): Promise<Transaction | null> {
    const row = await this.dataSource
      .getRepository(TransactionOrmEntity)
      .findOneBy({ reference });
    return row ? toDomain(row) : null;
  }

  async assignGatewayId(
    id: string,
    gatewayTransactionId: string,
    at: Date,
  ): Promise<void> {
    await this.dataSource
      .getRepository(TransactionOrmEntity)
      .update(
        { id, status: 'PENDING' },
        { gatewayTransactionId, updatedAt: at },
      );
  }

  settle(transaction: Transaction): Promise<SettleOutcome> {
    return this.dataSource.transaction(async (manager) => {
      // The WHERE on status is the lock: only the first caller changes a row.
      const settled = await manager.update(
        TransactionOrmEntity,
        { id: transaction.id, status: 'PENDING' },
        {
          status: transaction.status,
          gatewayTransactionId: transaction.gatewayTransactionId,
          updatedAt: transaction.updatedAt,
        },
      );
      if (settled.affected !== 1) {
        return 'ALREADY_FINAL';
      }
      if (transaction.status !== 'APPROVED') {
        return 'SETTLED';
      }

      // UPDATE ... SET stock = stock - n WHERE stock >= n: never below zero,
      // even with simultaneous purchases.
      const stock = await manager.decrement(
        ProductOrmEntity,
        {
          id: transaction.productId,
          stock: MoreThanOrEqual(transaction.quantity),
        },
        'stock',
        transaction.quantity,
      );
      if (stock.affected !== 1) {
        return 'APPROVED_WITHOUT_STOCK';
      }

      await manager.update(
        DeliveryOrmEntity,
        { transactionId: transaction.id },
        { status: 'ASSIGNED' },
      );
      return 'SETTLED';
    });
  }
}
