import { err, ok } from '../shared/result';
import { Product, reserveStock } from './product';

const product: Product = {
  id: 'prod-1',
  name: 'Camera drone',
  description: 'Foldable, with a gimbal',
  priceInCents: 25_000_000,
  stock: 5,
  imageUrl: 'https://example.com/drone.png',
};

describe('reserveStock', () => {
  it('decreases the stock by the requested quantity', () => {
    expect(reserveStock(product, 2)).toEqual(ok({ ...product, stock: 3 }));
  });

  it('allows taking the last units', () => {
    expect(reserveStock(product, 5)).toEqual(ok({ ...product, stock: 0 }));
  });

  it('does not modify the original product', () => {
    reserveStock(product, 2);

    expect(product.stock).toBe(5);
  });

  it('fails when there are not enough units', () => {
    expect(reserveStock(product, 6)).toEqual(err('INSUFFICIENT_STOCK'));
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'fails when the quantity is not a positive integer (%s)',
    (quantity) => {
      expect(reserveStock(product, quantity)).toEqual(err('INVALID_QUANTITY'));
    },
  );
});
