import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PRODUCT_REPOSITORY } from '../../application/ports/product.repository';
import { ORM_ENTITIES } from './entities';
import { TypeOrmProductRepository } from './repositories/typeorm-product.repository';

@Module({
  imports: [TypeOrmModule.forFeature(ORM_ENTITIES)],
  providers: [
    { provide: PRODUCT_REPOSITORY, useClass: TypeOrmProductRepository },
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class PersistenceModule {}
