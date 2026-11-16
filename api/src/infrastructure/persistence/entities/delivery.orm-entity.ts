import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionOrmEntity } from './transaction.orm-entity';

@Entity({ name: 'deliveries' })
export class DeliveryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transaction_id', type: 'uuid', unique: true })
  transactionId!: string;

  @OneToOne(() => TransactionOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: TransactionOrmEntity;

  @Column({ name: 'address_line', type: 'varchar', length: 200 })
  addressLine!: string;

  @Column({ type: 'varchar', length: 80 })
  city!: string;

  @Column({ type: 'varchar', length: 80 })
  region!: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 12, nullable: true })
  postalCode!: string | null;

  /** PENDING until the payment is resolved, then ASSIGNED or CANCELLED. */
  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
