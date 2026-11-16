import { GatewayError } from '../ports/payment-gateway';
import { TransactionSettlement } from '../services/transaction-settlement';
import {
  FakePaymentGateway,
  FixedClock,
  InMemoryProductRepository,
  InMemoryTransactionRepository,
} from '../testing/in-memory.fake';
import { err, ok } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction/transaction';
import {
  GetTransactionUseCase,
  NEVER_ARRIVED_AFTER_MS,
} from './get-transaction.use-case';

const createdAt = new Date('2026-11-15T09:00:00Z');
const now = new Date('2026-11-15T09:00:30Z');

const pending: Transaction = {
  id: 'tx-1',
  reference: 'ORDER-tx-1',
  productId: 'prod-1',
  quantity: 2,
  unitPriceInCents: 1_000_000,
  baseFeeInCents: 0,
  deliveryFeeInCents: 0,
  amountInCents: 2_000_000,
  currency: 'COP',
  status: 'PENDING',
  gatewayTransactionId: 'gw-1',
  createdAt,
  updatedAt: createdAt,
};

const setup = async (stored: Transaction = pending, at: Date = now) => {
  const products = InMemoryProductRepository.with({
    id: 'prod-1',
    name: 'Product',
    description: 'A product',
    priceInCents: 1_000_000,
    stock: 5,
    imageUrl: '/p.webp',
  });
  const transactions = new InMemoryTransactionRepository(products);
  await transactions.createPending({
    transaction: stored,
    customer: { fullName: 'Ana', email: 'ana@example.com', phone: '300' },
    delivery: { addressLine: 'x', city: 'y', region: 'z', postalCode: null },
  });
  const gateway = new FakePaymentGateway();
  const useCase = new GetTransactionUseCase(
    transactions,
    gateway,
    new TransactionSettlement(transactions, new FixedClock(at)),
    new FixedClock(at),
  );
  return { products, transactions, gateway, useCase };
};

describe('GetTransactionUseCase', () => {
  it('fails with TRANSACTION_NOT_FOUND for an unknown id', async () => {
    const { useCase, gateway } = await setup();

    await expect(useCase.execute('nope')).resolves.toEqual(
      err('TRANSACTION_NOT_FOUND'),
    );
    expect(gateway.queries).toHaveLength(0);
  });

  it('returns a final transaction without asking the gateway', async () => {
    const approved: Transaction = { ...pending, status: 'APPROVED' };
    const { useCase, gateway } = await setup(approved);

    await expect(useCase.execute('tx-1')).resolves.toEqual(ok(approved));
    expect(gateway.queries).toHaveLength(0);
  });

  it('asks the gateway about a PENDING transaction, by its gateway id', async () => {
    const { useCase, gateway } = await setup();
    gateway.answer = ok({ id: 'gw-1', status: 'PENDING', reference: 'r' });

    await expect(useCase.execute('tx-1')).resolves.toEqual(ok(pending));
    expect(gateway.queries).toEqual(['gw-1']);
  });

  it('settles the purchase when the gateway now says APPROVED', async () => {
    const { useCase, gateway, products, transactions } = await setup();
    gateway.answer = ok({ id: 'gw-1', status: 'APPROVED', reference: 'r' });

    const result = await useCase.execute('tx-1');

    expect(result).toMatchObject({
      value: { status: 'APPROVED', updatedAt: now },
    });
    expect(products.stockOf('prod-1')).toBe(3);
    expect(transactions.deliveries.get('tx-1')).toBe('ASSIGNED');
  });

  it('decreases the stock only once, however many times it is asked', async () => {
    const { useCase, gateway, products } = await setup();
    gateway.answer = ok({ id: 'gw-1', status: 'APPROVED', reference: 'r' });

    await useCase.execute('tx-1');
    await useCase.execute('tx-1');
    await useCase.execute('tx-1');

    expect(products.stockOf('prod-1')).toBe(3);
    expect(gateway.queries).toHaveLength(1);
  });

  it('stores DECLINED and puts the reserved units back on sale', async () => {
    const { useCase, gateway, products } = await setup();
    gateway.answer = ok({ id: 'gw-1', status: 'DECLINED', reference: 'r' });

    await expect(useCase.execute('tx-1')).resolves.toMatchObject({
      value: { status: 'DECLINED' },
    });
    expect(products.stockOf('prod-1')).toBe(5);
  });

  it.each<GatewayError>([
    'GATEWAY_UNAVAILABLE',
    'GATEWAY_REJECTED',
    'GATEWAY_INVALID_RESPONSE',
    'GATEWAY_NOT_CALLED',
  ])(
    'keeps the transaction PENDING when the query fails with %s',
    async (failure) => {
      const { useCase, gateway, transactions } = await setup();
      gateway.answer = err(failure);

      await expect(useCase.execute('tx-1')).resolves.toEqual(ok(pending));
      expect((await transactions.findById('tx-1'))?.status).toBe('PENDING');
    },
  );

  describe('when the answer to the charge was lost and its gateway id is unknown', () => {
    const lost: Transaction = { ...pending, gatewayTransactionId: null };
    const after = (milliseconds: number) =>
      new Date(createdAt.getTime() + milliseconds);

    it('asks the gateway by reference and settles what it finds', async () => {
      const { useCase, gateway, products, transactions } = await setup(lost);
      gateway.found = ok({
        id: 'gw-9',
        status: 'APPROVED',
        reference: 'ORDER-tx-1',
      });

      await expect(useCase.execute('tx-1')).resolves.toMatchObject({
        value: { status: 'APPROVED', gatewayTransactionId: 'gw-9' },
      });
      expect(gateway.searches).toEqual(['ORDER-tx-1']);
      expect(gateway.queries).toHaveLength(0);
      expect(products.stockOf('prod-1')).toBe(3);
      expect(transactions.deliveries.get('tx-1')).toBe('ASSIGNED');
    });

    it('remembers the gateway id when the charge is found still PENDING', async () => {
      const { useCase, gateway } = await setup(lost);
      gateway.found = ok({
        id: 'gw-9',
        status: 'PENDING',
        reference: 'ORDER-tx-1',
      });

      await expect(useCase.execute('tx-1')).resolves.toMatchObject({
        value: { status: 'PENDING', gatewayTransactionId: 'gw-9' },
      });
    });

    it('keeps waiting while the charge may still be on its way', async () => {
      const { useCase, products } = await setup(
        lost,
        after(NEVER_ARRIVED_AFTER_MS - 1),
      );

      await expect(useCase.execute('tx-1')).resolves.toEqual(ok(lost));
      expect(products.stockOf('prod-1')).toBe(3);
    });

    it('ends as ERROR and frees the units once it is certain the charge never arrived', async () => {
      const { useCase, products, transactions } = await setup(
        lost,
        after(NEVER_ARRIVED_AFTER_MS),
      );

      await expect(useCase.execute('tx-1')).resolves.toMatchObject({
        value: { status: 'ERROR', gatewayTransactionId: null },
      });
      expect((await transactions.findById('tx-1'))?.status).toBe('ERROR');
      expect(products.stockOf('prod-1')).toBe(5);
    });

    it('decides nothing when the gateway cannot be asked', async () => {
      const { useCase, gateway, transactions } = await setup(
        lost,
        after(NEVER_ARRIVED_AFTER_MS * 10),
      );
      gateway.found = err('GATEWAY_UNAVAILABLE');

      await expect(useCase.execute('tx-1')).resolves.toEqual(ok(lost));
      expect((await transactions.findById('tx-1'))?.status).toBe('PENDING');
    });
  });
});
