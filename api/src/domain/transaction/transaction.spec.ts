import { err, ok } from '../shared/result';
import {
  createPendingTransaction,
  NewTransaction,
  resolveTransaction,
  Transaction,
} from './transaction';

const createdAt = new Date('2026-11-14T10:00:00Z');
const resolvedAt = new Date('2026-11-14T10:00:05Z');

const input: NewTransaction = {
  id: 'tx-1',
  reference: 'ORDER-0001',
  productId: 'prod-1',
  quantity: 2,
  unitPriceInCents: 25_000_000,
  baseFeeInCents: 200_000,
  deliveryFeeInCents: 300_000,
  amountInCents: 50_500_000,
  createdAt,
};

const pending: Transaction = {
  ...input,
  currency: 'COP',
  status: 'PENDING',
  gatewayTransactionId: null,
  updatedAt: createdAt,
};

describe('createPendingTransaction', () => {
  it('creates the transaction in PENDING, in COP and without gateway id', () => {
    expect(createPendingTransaction(input)).toEqual(ok(pending));
  });

  it.each([0, -1, 1.5])(
    'fails when the quantity is not a positive integer (%s)',
    (quantity) => {
      expect(createPendingTransaction({ ...input, quantity })).toEqual(
        err('INVALID_QUANTITY'),
      );
    },
  );

  it.each([0, -100, 10.5])(
    'fails when the amount is not a positive integer of cents (%s)',
    (amountInCents) => {
      expect(createPendingTransaction({ ...input, amountInCents })).toEqual(
        err('INVALID_AMOUNT'),
      );
    },
  );
});

describe('resolveTransaction', () => {
  const resolution = {
    status: 'APPROVED',
    gatewayTransactionId: 'gw-123',
    at: resolvedAt,
  } as const;

  it('moves a PENDING transaction to its final status', () => {
    expect(resolveTransaction(pending, resolution)).toEqual(
      ok({
        ...pending,
        status: 'APPROVED',
        gatewayTransactionId: 'gw-123',
        updatedAt: resolvedAt,
      }),
    );
  });

  it.each(['DECLINED', 'VOIDED', 'ERROR'] as const)(
    'accepts %s as a final status',
    (status) => {
      expect(
        resolveTransaction(pending, { ...resolution, status }),
      ).toMatchObject({ ok: true, value: { status } });
    },
  );

  it('keeps the known gateway id when the resolution brings none', () => {
    const withId: Transaction = { ...pending, gatewayTransactionId: 'gw-9' };

    expect(
      resolveTransaction(withId, {
        status: 'ERROR',
        gatewayTransactionId: null,
        at: resolvedAt,
      }),
    ).toMatchObject({
      value: { status: 'ERROR', gatewayTransactionId: 'gw-9' },
    });
  });

  it('does not modify the original transaction', () => {
    resolveTransaction(pending, resolution);

    expect(pending.status).toBe('PENDING');
  });

  it('refuses to resolve a transaction to PENDING', () => {
    expect(
      resolveTransaction(pending, { ...resolution, status: 'PENDING' }),
    ).toEqual(err('INVALID_STATUS_TRANSITION'));
  });

  it('refuses to change a transaction that is already final', () => {
    const approved: Transaction = { ...pending, status: 'APPROVED' };

    expect(
      resolveTransaction(approved, { ...resolution, status: 'DECLINED' }),
    ).toEqual(err('TRANSACTION_ALREADY_FINAL'));
  });

  it('reports a repeated notification as already final', () => {
    const approved: Transaction = { ...pending, status: 'APPROVED' };

    expect(resolveTransaction(approved, resolution)).toEqual(
      err('TRANSACTION_ALREADY_FINAL'),
    );
  });
});
