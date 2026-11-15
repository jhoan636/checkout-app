import { isPositiveInteger } from '../shared/quantity';
import { err, ok, Result } from '../shared/result';

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Money is always an integer amount of cents, never a decimal. */
  readonly priceInCents: number;
  readonly stock: number;
  readonly imageUrl: string;
}

export type StockError = 'INVALID_QUANTITY' | 'INSUFFICIENT_STOCK';

/** Returns a new product with less stock; the original is never modified. */
export const reserveStock = (
  product: Product,
  quantity: number,
): Result<Product, StockError> => {
  if (!isPositiveInteger(quantity)) {
    return err('INVALID_QUANTITY');
  }
  if (quantity > product.stock) {
    return err('INSUFFICIENT_STOCK');
  }
  return ok({ ...product, stock: product.stock - quantity });
};
