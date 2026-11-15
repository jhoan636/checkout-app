import { createHash, randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/infrastructure/http/configure-app';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from './../src/application/ports/product.repository';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from './../src/application/ports/transaction.repository';
import { Transaction } from './../src/domain/transaction/transaction';

const PRODUCT_ID = 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601';
const EMAIL = 'e2e-webhook@example.com';

// Real PostgreSQL (`npm run db:up`) and real HTTP; the gateway is not called.
describe('Gateway webhook (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let products: ProductRepository;
  let transactions: TransactionRepository;
  let secret: string;
  let initialStock: number;
  const createdIds: string[] = [];

  const stock = async () => (await products.findById(PRODUCT_ID))!.stock;

  const createPending = async (): Promise<Transaction> => {
    const id = randomUUID();
    const now = new Date();
    const transaction: Transaction = {
      id,
      reference: `ORDER-${id}`,
      productId: PRODUCT_ID,
      quantity: 1,
      unitPriceInCents: 45_990_000,
      baseFeeInCents: 300_000,
      deliveryFeeInCents: 1_200_000,
      amountInCents: 47_490_000,
      currency: 'COP',
      status: 'PENDING',
      gatewayTransactionId: null,
      createdAt: now,
      updatedAt: now,
    };
    await transactions.createPending({
      transaction,
      customer: { fullName: 'E2E Webhook', email: EMAIL, phone: '3000000000' },
      delivery: {
        addressLine: 'Calle 1 # 2-3',
        city: 'Bogota',
        region: 'Cundinamarca',
        postalCode: null,
      },
    });
    createdIds.push(id);
    return transaction;
  };

  const eventFor = (
    transaction: Transaction,
    status: string,
    signingSecret: string,
  ) => {
    const data = {
      transaction: {
        id: `gw-${transaction.id}`,
        status,
        reference: transaction.reference,
        amount_in_cents: transaction.amountInCents,
      },
    };
    const timestamp = Math.floor(Date.now() / 1000);
    return {
      event: 'transaction.updated',
      data,
      timestamp,
      signature: {
        properties: [
          'transaction.id',
          'transaction.status',
          'transaction.amount_in_cents',
        ],
        checksum: createHash('sha256')
          .update(
            `${data.transaction.id}${status}${data.transaction.amount_in_cents}${timestamp}${signingSecret}`,
          )
          .digest('hex'),
      },
    };
  };

  const post = (body: object) =>
    request(app.getHttpServer()).post('/webhooks/payment-gateway').send(body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    products = app.get<ProductRepository>(PRODUCT_REPOSITORY);
    transactions = app.get<TransactionRepository>(TRANSACTION_REPOSITORY);
    secret = app.get(ConfigService).getOrThrow<string>('GATEWAY_EVENTS_SECRET');
    initialStock = await stock();
  });

  afterAll(async () => {
    // Leave the local database as it was found.
    await dataSource.query(
      'DELETE FROM deliveries WHERE transaction_id = ANY($1::uuid[])',
      [createdIds],
    );
    await dataSource.query(
      'DELETE FROM transactions WHERE id = ANY($1::uuid[])',
      [createdIds],
    );
    await dataSource.query('DELETE FROM customers WHERE email = $1', [EMAIL]);
    await dataSource.query('UPDATE products SET stock = $1 WHERE id = $2', [
      initialStock,
      PRODUCT_ID,
    ]);
    await app.close();
  });

  it('an approved event settles the purchase, and a repeated one changes nothing', async () => {
    const transaction = await createPending();
    const event = eventFor(transaction, 'APPROVED', secret);

    await post(event).expect(200).expect({ received: true });

    expect(await transactions.findById(transaction.id)).toMatchObject({
      status: 'APPROVED',
      gatewayTransactionId: `gw-${transaction.id}`,
    });
    expect(await stock()).toBe(initialStock - 1);

    await post(event).expect(200);
    await post(eventFor(transaction, 'DECLINED', secret)).expect(200);

    expect((await transactions.findById(transaction.id))?.status).toBe(
      'APPROVED',
    );
    expect(await stock()).toBe(initialStock - 1);
  });

  it('refuses an event signed with another secret', async () => {
    const before = await stock();
    const transaction = await createPending();

    await post(eventFor(transaction, 'APPROVED', 'not-the-secret')).expect(401);

    expect((await transactions.findById(transaction.id))?.status).toBe(
      'PENDING',
    );
    expect(await stock()).toBe(before);
  });

  it('refuses a body that is not an event', async () => {
    await post({ hello: 'world' }).expect(401);
  });
});
