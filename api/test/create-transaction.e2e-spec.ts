import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from './../src/application/ports/payment-gateway';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from './../src/application/ports/product.repository';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from './../src/application/ports/transaction.repository';
import { FakePaymentGateway } from './../src/application/testing/in-memory.fake';
import {
  CreateTransactionCommand,
  CreateTransactionUseCase,
} from './../src/application/use-cases/create-transaction.use-case';
import { err, ok } from './../src/domain/shared/result';

const PRODUCT_ID = 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601';

const command: CreateTransactionCommand = {
  productId: PRODUCT_ID,
  quantity: 2,
  customer: {
    fullName: 'E2E Buyer',
    email: 'e2e-buyer@example.com',
    phone: '3001234567',
  },
  delivery: {
    addressLine: 'Calle 1 # 2-3',
    city: 'Bogota',
    region: 'Cundinamarca',
    postalCode: null,
  },
  cardToken: 'tok_test_e2e',
  installments: 1,
  acceptanceToken: 'acceptance-token',
  personalDataAuthToken: 'personal-auth-token',
};

// Real PostgreSQL (`npm run db:up`), fake gateway: no network involved.
describe('Create transaction against the database (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let gateway: FakePaymentGateway;
  let useCase: CreateTransactionUseCase;
  let products: ProductRepository;
  let transactions: TransactionRepository;
  const createdIds: string[] = [];
  let initialStock: number;

  const stock = async () => (await products.findById(PRODUCT_ID))!.stock;

  const deliveryStatus = async (transactionId: string) => {
    const rows: { status: string }[] = await dataSource.query(
      'SELECT status FROM deliveries WHERE transaction_id = $1',
      [transactionId],
    );
    return rows[0]?.status;
  };

  const purchase = async () => {
    const result = await useCase.execute(command);
    if (!result.ok) {
      throw new Error(`unexpected failure: ${result.error}`);
    }
    createdIds.push(result.value.id);
    return result.value;
  };

  beforeAll(async () => {
    gateway = new FakePaymentGateway();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue(gateway satisfies PaymentGateway)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    useCase = app.get(CreateTransactionUseCase);
    products = app.get<ProductRepository>(PRODUCT_REPOSITORY);
    transactions = app.get<TransactionRepository>(TRANSACTION_REPOSITORY);
    initialStock = await stock();
  });

  afterAll(async () => {
    // Leave the local database as it was found.
    await dataSource.query(
      'DELETE FROM deliveries WHERE transaction_id = ANY($1::uuid[])',
      [createdIds],
    );
    await dataSource.query(
      `DELETE FROM transactions WHERE id = ANY($1::uuid[])`,
      [createdIds],
    );
    await dataSource.query('DELETE FROM customers WHERE email = $1', [
      command.customer.email,
    ]);
    await dataSource.query('UPDATE products SET stock = $1 WHERE id = $2', [
      initialStock,
      PRODUCT_ID,
    ]);
    await app.close();
  });

  it('approved: stores everything, decreases stock once and assigns the delivery', async () => {
    gateway.answer = ok({
      id: `gw-${Date.now()}-a`,
      status: 'APPROVED',
      reference: 'r',
    });

    const transaction = await purchase();

    const stored = await transactions.findById(transaction.id);
    expect(stored).toMatchObject({
      status: 'APPROVED',
      quantity: 2,
      unitPriceInCents: 45_990_000,
      amountInCents: 45_990_000 * 2 + 300_000 + 1_200_000,
      gatewayTransactionId: transaction.gatewayTransactionId,
    });
    expect(await stock()).toBe(initialStock - 2);
    expect(await deliveryStatus(transaction.id)).toBe('ASSIGNED');

    // A repeated notification for the same payment changes nothing.
    await expect(transactions.settle(stored!)).resolves.toBe('ALREADY_FINAL');
    expect(await stock()).toBe(initialStock - 2);
  });

  it('declined: keeps the stock and leaves the delivery pending', async () => {
    const before = await stock();
    gateway.answer = ok({
      id: `gw-${Date.now()}-d`,
      status: 'DECLINED',
      reference: 'r',
    });

    const transaction = await purchase();

    expect((await transactions.findById(transaction.id))?.status).toBe(
      'DECLINED',
    );
    expect(await stock()).toBe(before);
    expect(await deliveryStatus(transaction.id)).toBe('PENDING');
  });

  it('gateway unavailable: the purchase stays on record as PENDING', async () => {
    const before = await stock();
    gateway.answer = err('GATEWAY_UNAVAILABLE');

    const transaction = await purchase();

    expect(await transactions.findById(transaction.id)).toMatchObject({
      status: 'PENDING',
      gatewayTransactionId: null,
    });
    expect(await stock()).toBe(before);
  });

  it('pending answer: remembers the gateway id to ask again later', async () => {
    const gatewayId = `gw-${Date.now()}-p`;
    gateway.answer = ok({ id: gatewayId, status: 'PENDING', reference: 'r' });

    const transaction = await purchase();

    expect(await transactions.findById(transaction.id)).toMatchObject({
      status: 'PENDING',
      gatewayTransactionId: gatewayId,
    });
  });
});
