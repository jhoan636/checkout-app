import { TransactionSettlement } from '../services/transaction-settlement';
import {
  FixedClock,
  InMemoryProductRepository,
  InMemoryTransactionRepository,
} from '../testing/in-memory.fake';
import { Transaction } from '../../domain/transaction/transaction';
import {
  GatewayEvent,
  HandleGatewayEventUseCase,
} from './handle-gateway-event.use-case';

const createdAt = new Date('2026-11-15T09:00:00Z');
const now = new Date('2026-11-15T09:01:00Z');

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

const approvedEvent: GatewayEvent = {
  gatewayTransactionId: 'gw-1',
  status: 'APPROVED',
  reference: 'ORDER-tx-1',
  amountInCents: 2_000_000,
};

const setup = async () => {
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
    transaction: pending,
    customer: { fullName: 'Ana', email: 'ana@example.com', phone: '300' },
    delivery: { addressLine: 'x', city: 'y', region: 'z', postalCode: null },
  });
  const useCase = new HandleGatewayEventUseCase(
    transactions,
    new TransactionSettlement(transactions, new FixedClock(now)),
  );
  return { products, transactions, useCase };
};

describe('HandleGatewayEventUseCase', () => {
  it('settles the purchase found by its reference', async () => {
    const { useCase, products, transactions } = await setup();

    await expect(useCase.execute(approvedEvent)).resolves.toBe('APPLIED');

    expect(await transactions.findById('tx-1')).toMatchObject({
      status: 'APPROVED',
      gatewayTransactionId: 'gw-1',
      updatedAt: now,
    });
    expect(products.stockOf('prod-1')).toBe(3);
    expect(transactions.deliveries.get('tx-1')).toBe('ASSIGNED');
  });

  it('is idempotent: a repeated event does not touch the stock again', async () => {
    const { useCase, products } = await setup();

    await useCase.execute(approvedEvent);

    await expect(useCase.execute(approvedEvent)).resolves.toBe('ALREADY_FINAL');
    expect(products.stockOf('prod-1')).toBe(3);
  });

  it('never lets a later event change a final status', async () => {
    const { useCase, transactions } = await setup();
    await useCase.execute(approvedEvent);

    await useCase.execute({ ...approvedEvent, status: 'DECLINED' });

    expect((await transactions.findById('tx-1'))?.status).toBe('APPROVED');
  });

  it('ignores an event for a reference it does not know', async () => {
    const { useCase, products } = await setup();

    await expect(
      useCase.execute({ ...approvedEvent, reference: 'ORDER-unknown' }),
    ).resolves.toBe('UNKNOWN_REFERENCE');
    expect(products.stockOf('prod-1')).toBe(3);
  });

  it('ignores an event whose amount differs from the purchase', async () => {
    const { useCase, products, transactions } = await setup();

    await expect(
      useCase.execute({ ...approvedEvent, amountInCents: 100 }),
    ).resolves.toBe('AMOUNT_MISMATCH');
    expect((await transactions.findById('tx-1'))?.status).toBe('PENDING');
    expect(products.stockOf('prod-1')).toBe(3);
  });

  it('stores the gateway id from a PENDING event without settling', async () => {
    const { useCase, products, transactions } = await setup();

    await expect(
      useCase.execute({ ...approvedEvent, status: 'PENDING' }),
    ).resolves.toBe('STILL_PENDING');
    expect(await transactions.findById('tx-1')).toMatchObject({
      status: 'PENDING',
      gatewayTransactionId: 'gw-1',
    });
    expect(products.stockOf('prod-1')).toBe(3);
  });

  it('stores DECLINED and puts the reserved units back on sale', async () => {
    const { useCase, products, transactions } = await setup();

    await expect(
      useCase.execute({ ...approvedEvent, status: 'DECLINED' }),
    ).resolves.toBe('APPLIED');
    expect((await transactions.findById('tx-1'))?.status).toBe('DECLINED');
    expect(products.stockOf('prod-1')).toBe(5);
  });
});
