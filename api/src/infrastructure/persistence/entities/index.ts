import { CustomerOrmEntity } from './customer.orm-entity';
import { DeliveryOrmEntity } from './delivery.orm-entity';
import { ProductOrmEntity } from './product.orm-entity';
import { TransactionOrmEntity } from './transaction.orm-entity';

export const ORM_ENTITIES = [
  ProductOrmEntity,
  CustomerOrmEntity,
  TransactionOrmEntity,
  DeliveryOrmEntity,
];
