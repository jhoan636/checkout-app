import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintToNumber } from './bigint.transformer';
import { CustomerOrmEntity } from './customer.orm-entity';
import { ProductOrmEntity } from './product.orm-entity';

/** Never holds card data: only the reference and the gateway id. */
@Entity({ name: 'transactions' })
export class TransactionOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  reference!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => ProductOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product?: ProductOrmEntity;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => CustomerOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer?: CustomerOrmEntity;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({
    name: 'unit_price_in_cents',
    type: 'bigint',
    transformer: bigintToNumber,
  })
  unitPriceInCents!: number;

  @Column({
    name: 'base_fee_in_cents',
    type: 'bigint',
    transformer: bigintToNumber,
  })
  baseFeeInCents!: number;

  @Column({
    name: 'delivery_fee_in_cents',
    type: 'bigint',
    transformer: bigintToNumber,
  })
  deliveryFeeInCents!: number;

  @Column({
    name: 'amount_in_cents',
    type: 'bigint',
    transformer: bigintToNumber,
  })
  amountInCents!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({
    name: 'gateway_transaction_id',
    type: 'varchar',
    length: 64,
    nullable: true,
    unique: true,
  })
  gatewayTransactionId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
