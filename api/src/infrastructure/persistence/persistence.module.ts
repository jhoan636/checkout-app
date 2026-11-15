import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PRODUCT_REPOSITORY } from '../../application/ports/product.repository';
import { TRANSACTION_REPOSITORY } from '../../application/ports/transaction.repository';
import { ORM_ENTITIES } from './entities';
import { TypeOrmProductRepository } from './repositories/typeorm-product.repository';
import { TypeOrmTransactionRepository } from './repositories/typeorm-transaction.repository';

@Module({
  imports: [TypeOrmModule.forFeature(ORM_ENTITIES)],
  providers: [
    { provide: PRODUCT_REPOSITORY, useClass: TypeOrmProductRepository },
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: TypeOrmTransactionRepository,
    },
  ],
  exports: [PRODUCT_REPOSITORY, TRANSACTION_REPOSITORY],
})
export class PersistenceModule {}
