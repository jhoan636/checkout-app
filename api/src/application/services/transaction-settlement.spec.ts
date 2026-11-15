import {
  FixedClock,
  InMemoryProductRepository,
  InMemoryTransactionRepository,
} from '../testing/in-memory.fake';
import { err, ok } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction/transaction';
import { TransactionSettlement } from './transaction-settlement';

const createdAt = new Date('2026-11-15T09:00:00Z');
const now = new Date('2026-11-15T09:00:10Z');

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
  gatewayTransactionId: null,
  createdAt,
  updatedAt: createdAt,
};

const setup = async (stock = 5) => {
  const products = InMemoryProductRepository.with({
    id: 'prod-1',
    name: 'Product',
    description: 'A product',
    priceInCents: 1_000_000,
    stock,
    imageUrl: '/p.webp',
  });
  const transactions = new InMemoryTransactionRepository(products);
  await transactions.createPending({
    transaction: pending,
    customer: { fullName: 'Ana', email: 'ana@example.com', phone: '300' },
    delivery: { addressLine: 'x', city: 'y', region: 'z', postalCode: null },
  });
  const settlement = new TransactionSettlement(
    transactions,
    new FixedClock(now),
  );
  return { products, transactions, settlement };
};

const approved = ok({
  id: 'gw-1',
  status: 'APPROVED',
  reference: 'r',
} as const);

describe('TransactionSettlement', () => {
  it('settles an approved payment once: stock, delivery and status', async () => {
    const { settlement, products, transactions } = await setup();

    const result = await settlement.apply(pending, approved);

    expect(result).toMatchObject({
      status: 'APPROVED',
      gatewayTransactionId: 'gw-1',
      updatedAt: now,
    });
    expect(products.stockOf('prod-1')).toBe(3);
    expect(transactions.deliveries.get('tx-1')).toBe('ASSIGNED');
  });

  it('does not decrease the stock twice for a repeated answer', async () => {
    const { settlement, products } = await setup();

    await settlement.apply(pending, approved);
    const second = await settlement.apply(pending, approved);

    expect(second).toMatchObject({ status: 'APPROVED' });
    expect(products.stockOf('prod-1')).toBe(3);
  });

  it('returns the stored transaction when it was already final', async () => {
    const { settlement, transactions } = await setup();
    await settlement.apply(pending, approved);
    const stored = await transactions.findById('tx-1');

    const result = await settlement.apply(
      stored!,
      ok({ id: 'gw-1', status: 'DECLINED', reference: 'r' }),
    );

    expect(result).toMatchObject({ status: 'APPROVED' });
  });

  it('keeps an approved payment approved even without stock left', async () => {
    const { settlement, products, transactions } = await setup(1);

    const result = await settlement.apply(pending, approved);

    expect(result).toMatchObject({ status: 'APPROVED' });
    expect(products.stockOf('prod-1')).toBe(1);
    expect(transactions.deliveries.get('tx-1')).toBe('PENDING');
  });

  it('does not write the gateway id again when it is already known', async () => {
    const { settlement, transactions } = await setup();
    const known = { ...pending, gatewayTransactionId: 'gw-1' };
    const assign = jest.spyOn(transactions, 'assignGatewayId');

    const result = await settlement.apply(
      known,
      ok({ id: 'gw-1', status: 'PENDING', reference: 'r' }),
    );

    expect(result).toEqual(known);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves the transaction PENDING when the gateway is unavailable', async () => {
    const { settlement, transactions } = await setup();

    const result = await settlement.apply(pending, err('GATEWAY_UNAVAILABLE'));

    expect(result).toEqual(pending);
    expect((await transactions.findById('tx-1'))?.status).toBe('PENDING');
  });
});
