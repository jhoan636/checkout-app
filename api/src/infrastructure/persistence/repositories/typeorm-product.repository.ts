import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductRepository } from '../../../application/ports/product.repository';
import { Product } from '../../../domain/product/product';
import { ProductOrmEntity } from '../entities/product.orm-entity';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toDomain = (row: ProductOrmEntity): Product => ({
  id: row.id,
  name: row.name,
  description: row.description,
  priceInCents: row.priceInCents,
  stock: row.stock,
  imageUrl: row.imageUrl,
});

/** Adapter: implements the port with TypeORM and PostgreSQL. */
@Injectable()
export class TypeOrmProductRepository implements ProductRepository {
  constructor(
    @InjectRepository(ProductOrmEntity)
    private readonly products: Repository<ProductOrmEntity>,
  ) {}

  async findAll(): Promise<Product[]> {
    const rows = await this.products.find({ order: { name: 'ASC' } });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Product | null> {
    // PostgreSQL rejects a malformed UUID with an error; an id that cannot
    // exist is simply reported as not found.
    if (!UUID_PATTERN.test(id)) {
      return null;
    }
    const row = await this.products.findOneBy({ id });
    return row ? toDomain(row) : null;
  }
}
