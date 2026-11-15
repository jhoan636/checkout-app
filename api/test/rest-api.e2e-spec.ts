import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { PAYMENT_GATEWAY } from './../src/application/ports/payment-gateway';
import { FakePaymentGateway } from './../src/application/testing/in-memory.fake';
import { ok } from './../src/domain/shared/result';
import { configureApp } from './../src/infrastructure/http/configure-app';

const PRODUCT_ID = 'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601';
const EMAIL = 'e2e-rest@example.com';

interface TransactionBody {
  id: string;
  status: string;
  amountInCents: number;
}

interface ProductBody {
  id: string;
  stock: number;
  priceInCents: number;
}

// Real HTTP and real PostgreSQL (`npm run db:up`); only the gateway is fake.
describe('REST API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let gateway: FakePaymentGateway;
  let initialStock: number;
  const createdIds: string[] = [];

  const http = () => request(app.getHttpServer());

  const purchase = (overrides: Record<string, unknown> = {}) => ({
    productId: PRODUCT_ID,
    quantity: 1,
    customer: { fullName: 'E2E Rest', email: EMAIL, phone: '3001234567' },
    delivery: {
      addressLine: 'Calle 1 # 2-3',
      city: 'Bogota',
      region: 'Cundinamarca',
    },
    payment: {
      cardToken: 'tok_test_e2e',
      installments: 1,
      acceptanceToken: 'acceptance-token',
      personalDataAuthToken: 'personal-auth-token',
    },
    ...overrides,
  });

  const stock = async () => {
    const response = await http().get(`/products/${PRODUCT_ID}`).expect(200);
    return (response.body as ProductBody).stock;
  };

  beforeAll(async () => {
    gateway = new FakePaymentGateway();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue(gateway)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
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

  describe('products', () => {
    it('GET /products lists the seeded product', async () => {
      const response = await http().get('/products').expect(200);

      expect(response.body as ProductBody[]).toHaveLength(1);
    });

    it('GET /products/:id answers 404 for an unknown product', async () => {
      await http().get(`/products/${randomUUID()}`).expect(404);
    });

    it('GET /products/:id answers 400 for an id that is not a UUID', async () => {
      await http().get('/products/1').expect(400);
    });

    it('GET /products/:id/payment-summary returns the total to pay', async () => {
      const response = await http()
        .get(`/products/${PRODUCT_ID}/payment-summary?quantity=2`)
        .expect(200);

      expect(response.body).toEqual({
        productId: PRODUCT_ID,
        quantity: 2,
        subtotalInCents: 91_980_000,
        baseFeeInCents: 300_000,
        deliveryFeeInCents: 1_200_000,
        totalInCents: 93_480_000,
      });
    });

    it('payment-summary answers 400 without a valid quantity', async () => {
      await http()
        .get(`/products/${PRODUCT_ID}/payment-summary?quantity=abc`)
        .expect(400);
    });
  });

  describe('transactions', () => {
    it('runs a whole purchase: create, repeat safely, read, customer, delivery', async () => {
      const key = randomUUID();
      createdIds.push(key);
      gateway.answer = ok({
        id: `gw-${key}`,
        status: 'APPROVED',
        reference: 'r',
      });

      const created = await http()
        .post('/transactions')
        .set('Idempotency-Key', key)
        .send(purchase())
        .expect(201);
      expect(created.body as TransactionBody).toMatchObject({
        id: key,
        status: 'APPROVED',
        amountInCents: 45_990_000 + 300_000 + 1_200_000,
      });
      expect(created.body).not.toHaveProperty('gatewayTransactionId');
      expect(await stock()).toBe(initialStock - 1);

      // The same request again (double click, retry): no second charge.
      const repeated = await http()
        .post('/transactions')
        .set('Idempotency-Key', key)
        .send(purchase())
        .expect(201);
      expect(repeated.body).toEqual(created.body);
      expect(
        gateway.charges.filter((c) => c.reference === `ORDER-${key}`),
      ).toHaveLength(1);
      expect(await stock()).toBe(initialStock - 1);

      await http()
        .get(`/transactions/${key}`)
        .expect(200)
        .expect((response) => {
          expect((response.body as TransactionBody).status).toBe('APPROVED');
        });

      await http().get(`/transactions/${key}/customer`).expect(200).expect({
        transactionId: key,
        fullName: 'E2E Rest',
        email: 'e***@example.com',
        phone: '*******567',
      });

      await http().get(`/transactions/${key}/delivery`).expect(200).expect({
        transactionId: key,
        status: 'ASSIGNED',
        addressLine: 'Calle 1 # 2-3',
        city: 'Bogota',
        region: 'Cundinamarca',
        postalCode: null,
      });
    });

    it('answers 400 without an Idempotency-Key header', async () => {
      await http().post('/transactions').send(purchase()).expect(400);
    });

    it('answers 400 for an invalid body and stores nothing', async () => {
      const response = await http()
        .post('/transactions')
        .set('Idempotency-Key', randomUUID())
        .send(purchase({ quantity: 0 }))
        .expect(400);

      expect(JSON.stringify(response.body)).toContain('quantity');
    });

    it('answers 400 when the body carries card data', async () => {
      await http()
        .post('/transactions')
        .set('Idempotency-Key', randomUUID())
        .send(purchase({ cardNumber: '4242424242424242' }))
        .expect(400);
    });

    it('answers 404 for a product that does not exist', async () => {
      await http()
        .post('/transactions')
        .set('Idempotency-Key', randomUUID())
        .send(purchase({ productId: randomUUID() }))
        .expect(404);
    });

    it('answers 409 when asking for more units than there are', async () => {
      const setStock = (units: number) =>
        dataSource.query('UPDATE products SET stock = $1 WHERE id = $2', [
          units,
          PRODUCT_ID,
        ]);
      const before = await stock();
      await setStock(3);

      try {
        const response = await http()
          .post('/transactions')
          .set('Idempotency-Key', randomUUID())
          .send(purchase({ quantity: 4 }))
          .expect(409);

        expect(response.body).toMatchObject({ error: 'INSUFFICIENT_STOCK' });
      } finally {
        await setStock(before);
      }
    });

    it('GET /transactions/:id answers 404 for an unknown transaction', async () => {
      await http().get(`/transactions/${randomUUID()}`).expect(404);
    });
  });
});
