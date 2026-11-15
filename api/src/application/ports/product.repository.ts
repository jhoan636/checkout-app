import { Product } from '../../domain/product/product';

/** Injection token: TypeScript interfaces do not exist at runtime. */
export const PRODUCT_REPOSITORY = Symbol('ProductRepository');

/** Port: what the application needs from storage, with no database detail. */
export interface ProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
}
