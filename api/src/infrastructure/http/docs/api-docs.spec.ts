import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductQueries } from '../../../application/use-cases/product-queries';
import { CreateTransactionUseCase } from '../../../application/use-cases/create-transaction.use-case';
import { GetOrderDetailsUseCase } from '../../../application/use-cases/get-order-details.use-case';
import { GetTransactionUseCase } from '../../../application/use-cases/get-transaction.use-case';
import { ProductsController } from '../products/products.controller';
import { TransactionsController } from '../transactions/transactions.controller';
import { buildApiDocument, setupApiDocs } from './api-docs';

describe('API documentation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController, TransactionsController],
      providers: [
        { provide: ProductQueries, useValue: {} },
        { provide: CreateTransactionUseCase, useValue: {} },
        { provide: GetTransactionUseCase, useValue: {} },
        { provide: GetOrderDetailsUseCase, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('documents every public endpoint', () => {
    const document = buildApiDocument(app);

    expect(Object.keys(document.paths).sort()).toEqual([
      '/products',
      '/products/{id}',
      '/products/{id}/payment-summary',
      '/transactions',
      '/transactions/{id}',
      '/transactions/{id}/customer',
      '/transactions/{id}/delivery',
    ]);
  });

  it('documents the Idempotency-Key header and the error responses of a purchase', () => {
    const create = buildApiDocument(app).paths['/transactions'].post!;

    expect(JSON.stringify(create.parameters)).toContain('Idempotency-Key');
    expect(Object.keys(create.responses).sort()).toEqual([
      '201',
      '400',
      '404',
      '409',
      '422',
      '429',
    ]);
  });

  it('describes the transaction response with its statuses', () => {
    const schemas = buildApiDocument(app).components?.schemas ?? {};

    expect(JSON.stringify(schemas.TransactionResponse)).toContain('APPROVED');
    expect(schemas).toHaveProperty('ErrorResponse');
  });

  it('never documents a field for card data', () => {
    const text = JSON.stringify(buildApiDocument(app)).toLowerCase();

    expect(text).not.toMatch(/cardnumber|"cvc"|"cvv"|exp_month|expmonth/);
  });

  it('serves the documentation without failing', () => {
    expect(() => setupApiDocs(app)).not.toThrow();
  });
});
