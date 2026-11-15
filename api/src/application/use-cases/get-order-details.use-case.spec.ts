import {
  InMemoryProductRepository,
  InMemoryTransactionRepository,
} from '../testing/in-memory.fake';
import { err, ok } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction/transaction';
import { GetOrderDetailsUseCase } from './get-order-details.use-case';

const createdAt = new Date('2026-11-15T09:00:00Z');

const transaction: Transaction = {
  id: 'tx-1',
  reference: 'ORDER-tx-1',
  productId: 'prod-1',
  quantity: 1,
  unitPriceInCents: 1_000_000,
  baseFeeInCents: 0,
  deliveryFeeInCents: 0,
  amountInCents: 1_000_000,
  currency: 'COP',
  status: 'PENDING',
  gatewayTransactionId: null,
  createdAt,
  updatedAt: createdAt,
};

const customer = {
  fullName: 'Ana Gomez',
  email: 'ana@example.com',
  phone: '3001234567',
};

const delivery = {
  addressLine: 'Calle 1 # 2-3',
  city: 'Bogota',
  region: 'Cundinamarca',
  postalCode: null,
};

const setup = async () => {
  const transactions = new InMemoryTransactionRepository(
    InMemoryProductRepository.with(),
  );
  await transactions.createPending({ transaction, customer, delivery });
  return new GetOrderDetailsUseCase(transactions);
};

describe('GetOrderDetailsUseCase', () => {
  it('returns the customer and the delivery of a purchase', async () => {
    const useCase = await setup();

    await expect(useCase.execute('tx-1')).resolves.toEqual(
      ok({
        transaction,
        customer,
        delivery: { ...delivery, status: 'PENDING' },
      }),
    );
  });

  it('fails with TRANSACTION_NOT_FOUND for an unknown id', async () => {
    const useCase = await setup();

    await expect(useCase.execute('nope')).resolves.toEqual(
      err('TRANSACTION_NOT_FOUND'),
    );
  });
});
