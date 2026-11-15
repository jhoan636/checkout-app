import { BadRequestException, HttpException } from '@nestjs/common';
import { OrderDetails } from '../../../application/ports/transaction.repository';
import { CreateTransactionUseCase } from '../../../application/use-cases/create-transaction.use-case';
import { GetOrderDetailsUseCase } from '../../../application/use-cases/get-order-details.use-case';
import { GetTransactionUseCase } from '../../../application/use-cases/get-transaction.use-case';
import { err, ok } from '../../../domain/shared/result';
import { Transaction } from '../../../domain/transaction/transaction';
import { CreateTransactionDto } from './create-transaction.dto';
import { maskEmail, maskPhone } from './transaction.presenter';
import { TransactionsController } from './transactions.controller';

const key = '7c1e8a52-6d0b-4a55-9a5e-0d3b8c1f7a10';
const at = new Date('2026-11-15T09:00:00.000Z');

const transaction: Transaction = {
  id: key,
  reference: `ORDER-${key}`,
  productId: 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601',
  quantity: 2,
  unitPriceInCents: 45_990_000,
  baseFeeInCents: 300_000,
  deliveryFeeInCents: 1_200_000,
  amountInCents: 93_480_000,
  currency: 'COP',
  status: 'APPROVED',
  gatewayTransactionId: 'gw-secret-id',
  createdAt: at,
  updatedAt: at,
};

const order: OrderDetails = {
  transaction,
  customer: {
    fullName: 'Ana Gomez',
    email: 'ana@example.com',
    phone: '3001234567',
  },
  delivery: {
    addressLine: 'Calle 1 # 2-3',
    city: 'Bogota',
    region: 'Cundinamarca',
    postalCode: null,
    status: 'ASSIGNED',
  },
};

const body: CreateTransactionDto = {
  productId: transaction.productId,
  quantity: 2,
  customer: order.customer,
  delivery: {
    addressLine: 'Calle 1 # 2-3',
    city: 'Bogota',
    region: 'Cundinamarca',
  },
  payment: {
    cardToken: 'tok_test_123',
    installments: 1,
    acceptanceToken: 'acceptance-token',
    personalDataAuthToken: 'personal-auth-token',
  },
};

const setup = () => {
  const create = jest.fn().mockResolvedValue(ok(transaction));
  const get = jest.fn().mockResolvedValue(ok(transaction));
  const details = jest.fn().mockResolvedValue(ok(order));
  const controller = new TransactionsController(
    { execute: create } as unknown as CreateTransactionUseCase,
    { execute: get } as unknown as GetTransactionUseCase,
    { execute: details } as unknown as GetOrderDetailsUseCase,
  );
  return { controller, create, get, details };
};

const statusOf = async (action: Promise<unknown>): Promise<number> => {
  try {
    await action;
  } catch (error) {
    return (error as HttpException).getStatus();
  }
  throw new Error('expected an HTTP error');
};

describe('TransactionsController', () => {
  describe('POST /transactions', () => {
    it('passes the purchase and the idempotency key to the use case', async () => {
      const { controller, create } = setup();

      await controller.create(key, body);

      expect(create).toHaveBeenCalledWith({
        idempotencyKey: key,
        productId: transaction.productId,
        quantity: 2,
        customer: order.customer,
        delivery: {
          addressLine: 'Calle 1 # 2-3',
          city: 'Bogota',
          region: 'Cundinamarca',
          postalCode: null,
        },
        cardToken: 'tok_test_123',
        installments: 1,
        acceptanceToken: 'acceptance-token',
        personalDataAuthToken: 'personal-auth-token',
      });
    });

    it('returns the transaction without the internal gateway id', async () => {
      const { controller } = setup();

      const response = await controller.create(key, body);

      expect(response).toEqual({
        id: key,
        reference: `ORDER-${key}`,
        status: 'APPROVED',
        productId: transaction.productId,
        quantity: 2,
        unitPriceInCents: 45_990_000,
        baseFeeInCents: 300_000,
        deliveryFeeInCents: 1_200_000,
        amountInCents: 93_480_000,
        currency: 'COP',
        createdAt: '2026-11-15T09:00:00.000Z',
        updatedAt: '2026-11-15T09:00:00.000Z',
      });
      expect(JSON.stringify(response)).not.toContain('gw-secret-id');
    });

    it.each([undefined, '', 'not-a-uuid'])(
      'answers 400 without calling the use case when the key is %j',
      async (badKey) => {
        const { controller, create } = setup();

        await expect(controller.create(badKey, body)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(create).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['PRODUCT_NOT_FOUND', 404],
      ['INSUFFICIENT_STOCK', 409],
      ['INVALID_QUANTITY', 422],
    ])('answers %s as HTTP %s', async (code, status) => {
      const { controller, create } = setup();
      create.mockResolvedValue(err(code));

      expect(await statusOf(controller.create(key, body))).toBe(status);
    });
  });

  describe('GET /transactions/:id', () => {
    it('returns the transaction', async () => {
      const { controller, get } = setup();

      await expect(controller.findOne(key)).resolves.toMatchObject({
        id: key,
        status: 'APPROVED',
      });
      expect(get).toHaveBeenCalledWith(key);
    });

    it('answers 404 when it does not exist', async () => {
      const { controller, get } = setup();
      get.mockResolvedValue(err('TRANSACTION_NOT_FOUND'));

      expect(await statusOf(controller.findOne(key))).toBe(404);
    });
  });

  describe('GET /transactions/:id/customer', () => {
    it('returns the customer with masked contact data', async () => {
      const { controller } = setup();

      await expect(controller.findCustomer(key)).resolves.toEqual({
        transactionId: key,
        fullName: 'Ana Gomez',
        email: 'a***@example.com',
        phone: '*******567',
      });
    });

    it('answers 404 when the transaction does not exist', async () => {
      const { controller, details } = setup();
      details.mockResolvedValue(err('TRANSACTION_NOT_FOUND'));

      expect(await statusOf(controller.findCustomer(key))).toBe(404);
    });
  });

  describe('GET /transactions/:id/delivery', () => {
    it('returns the delivery address and its status', async () => {
      const { controller } = setup();

      await expect(controller.findDelivery(key)).resolves.toEqual({
        transactionId: key,
        status: 'ASSIGNED',
        addressLine: 'Calle 1 # 2-3',
        city: 'Bogota',
        region: 'Cundinamarca',
        postalCode: null,
      });
    });

    it('answers 404 when the transaction does not exist', async () => {
      const { controller, details } = setup();
      details.mockResolvedValue(err('TRANSACTION_NOT_FOUND'));

      expect(await statusOf(controller.findDelivery(key))).toBe(404);
    });
  });
});

describe('masking', () => {
  it('maskEmail keeps the first letter and the domain', () => {
    expect(maskEmail('ana@example.com')).toBe('a***@example.com');
  });

  it('maskEmail hides a value that is not an email', () => {
    expect(maskEmail('not-an-email')).toBe('***');
  });

  it('maskPhone keeps the last three digits', () => {
    expect(maskPhone('3001234567')).toBe('*******567');
  });

  it('maskPhone copes with a very short value', () => {
    expect(maskPhone('12')).toBe('12');
  });
});
