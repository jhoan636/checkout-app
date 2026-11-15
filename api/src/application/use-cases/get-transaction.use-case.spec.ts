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
import { GetTransactionUseCase } from './get-transaction.use-case';

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

const setup = async (stored: Transaction = pending) => {
  const products = InMemoryProductRepository.with({
    id: 'prod-1',
    name: 'Product',
    description: 'A product',
    priceInCents: 1_000_000,
    stock: 5,
    imageUrl: '/p.svg',
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
    new TransactionSettlement(transactions, new FixedClock(now)),
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

  it('stores DECLINED and keeps the stock', async () => {
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
  ])(
    'keeps the transaction PENDING when the query fails with %s',
    async (failure) => {
      const { useCase, gateway, transactions } = await setup();
      gateway.answer = err(failure);

      await expect(useCase.execute('tx-1')).resolves.toEqual(ok(pending));
      expect((await transactions.findById('tx-1'))?.status).toBe('PENDING');
    },
  );

  it('cannot ask the gateway when the charge never returned an id', async () => {
    const lost: Transaction = { ...pending, gatewayTransactionId: null };
    const { useCase, gateway } = await setup(lost);

    await expect(useCase.execute('tx-1')).resolves.toEqual(ok(lost));
    expect(gateway.queries).toHaveLength(0);
  });
});
