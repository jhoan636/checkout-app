import { HttpException } from '@nestjs/common';
import { ProductQueries } from '../../../application/use-cases/product-queries';
import { Product } from '../../../domain/product/product';
import { err, ok } from '../../../domain/shared/result';
import { ProductsController } from './products.controller';

const id = 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601';

const product: Product = {
  id,
  name: 'Aurora Wireless Headphones',
  description: 'Over-ear headphones',
  priceInCents: 45_990_000,
  stock: 12,
  imageUrl: '/products/aurora-headphones.svg',
};

const summary = {
  subtotalInCents: 91_980_000,
  baseFeeInCents: 300_000,
  deliveryFeeInCents: 1_200_000,
  totalInCents: 93_480_000,
};

const setup = () => {
  const queries = {
    list: jest.fn().mockResolvedValue([product]),
    get: jest.fn().mockResolvedValue(ok(product)),
    quote: jest.fn().mockResolvedValue(ok(summary)),
  };
  const controller = new ProductsController(
    queries as unknown as ProductQueries,
  );
  return { controller, queries };
};

const statusOf = async (action: Promise<unknown>): Promise<number> => {
  try {
    await action;
  } catch (error) {
    return (error as HttpException).getStatus();
  }
  throw new Error('expected an HTTP error');
};

describe('ProductsController', () => {
  it('GET /products returns the catalogue with stock', async () => {
    const { controller } = setup();

    await expect(controller.findAll()).resolves.toEqual([product]);
  });

  it('GET /products/:id returns one product', async () => {
    const { controller, queries } = setup();

    await expect(controller.findOne(id)).resolves.toEqual(product);
    expect(queries.get).toHaveBeenCalledWith(id);
  });

  it('GET /products/:id answers 404 for an unknown product', async () => {
    const { controller, queries } = setup();
    queries.get.mockResolvedValue(err('PRODUCT_NOT_FOUND'));

    expect(await statusOf(controller.findOne(id))).toBe(404);
  });

  it('GET /products/:id/payment-summary returns what would be charged', async () => {
    const { controller, queries } = setup();

    await expect(
      controller.paymentSummary(id, { quantity: 2 }),
    ).resolves.toEqual({ productId: id, quantity: 2, ...summary });
    expect(queries.quote).toHaveBeenCalledWith(id, 2);
  });

  it.each([
    ['PRODUCT_NOT_FOUND', 404],
    ['INSUFFICIENT_STOCK', 409],
  ])('payment-summary answers %s as HTTP %s', async (code, status) => {
    const { controller, queries } = setup();
    queries.quote.mockResolvedValue(err(code));

    expect(await statusOf(controller.paymentSummary(id, { quantity: 2 }))).toBe(
      status,
    );
  });
});
