import { GatewayError } from '../ports/payment-gateway';
import { TransactionSettlement } from '../services/transaction-settlement';
import {
  FakePaymentGateway,
  FixedClock,
  InMemoryProductRepository,
  InMemoryTransactionRepository,
  SequentialIds,
} from '../testing/in-memory.fake';
import { Fees } from '../../domain/payment/payment-summary';
import { Product } from '../../domain/product/product';
import { err, ok } from '../../domain/shared/result';
import {
  CreateTransactionCommand,
  CreateTransactionUseCase,
} from './create-transaction.use-case';

const now = new Date('2026-11-15T09:00:00Z');
const fees: Fees = { baseFeeInCents: 300_000, deliveryFeeInCents: 1_200_000 };

const product: Product = {
  id: 'prod-1',
  name: 'Glide Camera Drone',
  description: 'Foldable camera drone',
  priceInCents: 45_990_000,
  stock: 3,
  imageUrl: '/products/glide-drone.webp',
};

const command: CreateTransactionCommand = {
  productId: 'prod-1',
  quantity: 2,
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
  },
  cardToken: 'tok_test_123',
  installments: 1,
  acceptanceToken: 'acceptance-token',
  personalDataAuthToken: 'personal-auth-token',
};

const setup = () => {
  const products = InMemoryProductRepository.with(product);
  const transactions = new InMemoryTransactionRepository(products);
  const gateway = new FakePaymentGateway();
  const clock = new FixedClock(now);
  const useCase = new CreateTransactionUseCase(
    products,
    transactions,
    gateway,
    new TransactionSettlement(transactions, clock),
    clock,
    new SequentialIds(),
    fees,
  );
  return { products, transactions, gateway, useCase };
};

const gatewayAnswers = (status: 'APPROVED' | 'DECLINED' | 'PENDING') =>
  ok({ id: 'gw-1', status, reference: 'ORDER-id-1' });

describe('CreateTransactionUseCase', () => {
  describe('before anything is charged', () => {
    it('fails with PRODUCT_NOT_FOUND for an unknown product', async () => {
      const { useCase, gateway, transactions } = setup();

      const result = await useCase.execute({ ...command, productId: 'nope' });

      expect(result).toEqual(err('PRODUCT_NOT_FOUND'));
      expect(gateway.charges).toHaveLength(0);
      expect(transactions.orders.size).toBe(0);
    });

    it('fails with INSUFFICIENT_STOCK and never calls the gateway', async () => {
      const { useCase, gateway, transactions } = setup();

      const result = await useCase.execute({ ...command, quantity: 4 });

      expect(result).toEqual(err('INSUFFICIENT_STOCK'));
      expect(gateway.charges).toHaveLength(0);
      expect(transactions.orders.size).toBe(0);
    });

    it('fails with INVALID_QUANTITY for a quantity of zero', async () => {
      const { useCase } = setup();

      await expect(
        useCase.execute({ ...command, quantity: 0 }),
      ).resolves.toEqual(err('INVALID_QUANTITY'));
    });
  });

  describe('charging', () => {
    it('stores the transaction as PENDING before calling the gateway', async () => {
      const { useCase, gateway, transactions } = setup();
      let statusWhenCharged: string | undefined;
      const charge = gateway.createCardTransaction.bind(gateway);
      gateway.createCardTransaction = (request) => {
        statusWhenCharged = transactions.orders.get('id-1')?.transaction.status;
        return charge(request);
      };

      await useCase.execute(command);

      expect(statusWhenCharged).toBe('PENDING');
    });

    it('charges the total calculated by the backend from its own price', async () => {
      const { useCase, gateway } = setup();

      await useCase.execute(command);

      expect(gateway.charges).toEqual([
        {
          reference: 'ORDER-id-1',
          amountInCents: 45_990_000 * 2 + 300_000 + 1_200_000,
          currency: 'COP',
          customerEmail: 'ana@example.com',
          cardToken: 'tok_test_123',
          installments: 1,
          acceptanceToken: 'acceptance-token',
          personalDataAuthToken: 'personal-auth-token',
        },
      ]);
    });

    it('stores customer, delivery address and the fee breakdown', async () => {
      const { useCase, transactions } = setup();

      await useCase.execute(command);

      expect(transactions.orders.get('id-1')).toMatchObject({
        customer: command.customer,
        delivery: command.delivery,
        transaction: {
          unitPriceInCents: 45_990_000,
          baseFeeInCents: 300_000,
          deliveryFeeInCents: 1_200_000,
          amountInCents: 93_480_000,
        },
      });
    });
  });

  describe('when the gateway approves', () => {
    it('returns the transaction APPROVED with the gateway id', async () => {
      const { useCase, gateway } = setup();
      gateway.answer = gatewayAnswers('APPROVED');

      const result = await useCase.execute(command);

      expect(result).toMatchObject({
        ok: true,
        value: {
          id: 'id-1',
          status: 'APPROVED',
          gatewayTransactionId: 'gw-1',
          updatedAt: now,
        },
      });
    });

    it('decreases the stock and assigns the delivery', async () => {
      const { useCase, gateway, products, transactions } = setup();
      gateway.answer = gatewayAnswers('APPROVED');

      await useCase.execute(command);

      expect(products.stockOf('prod-1')).toBe(1);
      expect(transactions.deliveries.get('id-1')).toBe('ASSIGNED');
    });
  });

  describe('when the gateway declines', () => {
    it('returns DECLINED and leaves stock and delivery untouched', async () => {
      const { useCase, gateway, products, transactions } = setup();
      gateway.answer = gatewayAnswers('DECLINED');

      const result = await useCase.execute(command);

      expect(result).toMatchObject({ value: { status: 'DECLINED' } });
      expect(products.stockOf('prod-1')).toBe(3);
      expect(transactions.deliveries.get('id-1')).toBe('PENDING');
    });
  });

  describe('when the gateway has not decided yet', () => {
    it('returns PENDING and remembers the gateway id to ask later', async () => {
      const { useCase, gateway, products, transactions } = setup();
      gateway.answer = gatewayAnswers('PENDING');

      const result = await useCase.execute(command);

      expect(result).toMatchObject({
        value: { status: 'PENDING', gatewayTransactionId: 'gw-1' },
      });
      expect(
        transactions.orders.get('id-1')?.transaction.gatewayTransactionId,
      ).toBe('gw-1');
      expect(products.stockOf('prod-1')).toBe(3);
    });
  });

  describe('when the gateway fails', () => {
    it.each<GatewayError>(['GATEWAY_REJECTED', 'GATEWAY_NOT_CALLED'])(
      'marks the transaction as ERROR on %s: nothing was charged',
      async (error) => {
        const { useCase, gateway, products } = setup();
        gateway.answer = err(error);

        const result = await useCase.execute(command);

        expect(result).toMatchObject({
          value: { status: 'ERROR', gatewayTransactionId: null },
        });
        expect(products.stockOf('prod-1')).toBe(3);
      },
    );

    it.each<GatewayError>(['GATEWAY_UNAVAILABLE', 'GATEWAY_INVALID_RESPONSE'])(
      'keeps the transaction PENDING on %s, because the outcome is unknown',
      async (failure) => {
        const { useCase, gateway, products, transactions } = setup();
        gateway.answer = err(failure);

        const result = await useCase.execute(command);

        expect(result).toMatchObject({ value: { status: 'PENDING' } });
        expect(transactions.orders.get('id-1')?.transaction.status).toBe(
          'PENDING',
        );
        expect(products.stockOf('prod-1')).toBe(3);
      },
    );
  });

  describe('idempotency', () => {
    const key = 'client-key-1';

    it('uses the idempotency key as the transaction id', async () => {
      const { useCase } = setup();

      const result = await useCase.execute({ ...command, idempotencyKey: key });

      expect(result).toMatchObject({
        value: { id: key, reference: `ORDER-${key}` },
      });
    });

    it('charges once when the same request is sent twice', async () => {
      const { useCase, gateway, products } = setup();
      gateway.answer = gatewayAnswers('APPROVED');

      const first = await useCase.execute({ ...command, idempotencyKey: key });
      const second = await useCase.execute({ ...command, idempotencyKey: key });

      expect(second).toEqual(first);
      expect(gateway.charges).toHaveLength(1);
      expect(products.stockOf('prod-1')).toBe(1);
    });

    it('does not charge when another request stored the same key first', async () => {
      const { useCase, gateway, transactions } = setup();
      const store = transactions.createPending.bind(transactions);
      // Both requests pass the first check; the database lets only one in.
      transactions.createPending = async (order) => {
        await store(order);
        return 'DUPLICATE';
      };

      const result = await useCase.execute({ ...command, idempotencyKey: key });

      expect(result).toMatchObject({ value: { id: key, status: 'PENDING' } });
      expect(gateway.charges).toHaveLength(0);
    });
  });
});
