import { InMemoryProductRepository } from '../testing/in-memory.fake';
import { Product } from '../../domain/product/product';
import { err, ok } from '../../domain/shared/result';
import { ProductQueries } from './product-queries';

const drone: Product = {
  id: 'prod-1',
  name: 'Glide Camera Drone',
  description: 'Foldable camera drone',
  priceInCents: 45_990_000,
  stock: 3,
  imageUrl: '/products/glide-drone.webp',
};

const soldOut: Product = { ...drone, id: 'prod-2', stock: 0 };

const queries = () =>
  new ProductQueries(InMemoryProductRepository.with(drone, soldOut), {
    baseFeeInCents: 300_000,
    deliveryFeeInCents: 1_200_000,
  });

describe('ProductQueries', () => {
  it('lists every product with its stock', async () => {
    await expect(queries().list()).resolves.toEqual([drone, soldOut]);
  });

  it('returns one product by id', async () => {
    await expect(queries().get('prod-1')).resolves.toEqual(ok(drone));
  });

  it('fails with PRODUCT_NOT_FOUND for an unknown id', async () => {
    await expect(queries().get('nope')).resolves.toEqual(
      err('PRODUCT_NOT_FOUND'),
    );
  });

  describe('quote', () => {
    it('returns the payment summary the customer will be charged', async () => {
      await expect(queries().quote('prod-1', 2)).resolves.toEqual(
        ok({
          subtotalInCents: 91_980_000,
          baseFeeInCents: 300_000,
          deliveryFeeInCents: 1_200_000,
          totalInCents: 93_480_000,
        }),
      );
    });

    it('fails with PRODUCT_NOT_FOUND for an unknown product', async () => {
      await expect(queries().quote('nope', 1)).resolves.toEqual(
        err('PRODUCT_NOT_FOUND'),
      );
    });

    it('fails with INSUFFICIENT_STOCK when asking for more than there is', async () => {
      await expect(queries().quote('prod-1', 4)).resolves.toEqual(
        err('INSUFFICIENT_STOCK'),
      );
    });

    it('fails with INSUFFICIENT_STOCK for a product that is sold out', async () => {
      await expect(queries().quote('prod-2', 1)).resolves.toEqual(
        err('INSUFFICIENT_STOCK'),
      );
    });

    it('fails with INVALID_QUANTITY for zero units', async () => {
      await expect(queries().quote('prod-1', 0)).resolves.toEqual(
        err('INVALID_QUANTITY'),
      );
    });
  });
});
