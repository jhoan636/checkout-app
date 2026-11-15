import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from './../src/application/ports/product.repository';

// Needs the local database running: `npm run db:up`.
describe('Seeded products (e2e)', () => {
  let app: INestApplication;
  let products: ProductRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    products = app.get<ProductRepository>(PRODUCT_REPOSITORY);
  });

  afterAll(async () => {
    await app.close();
  });

  it('the catalogue is available after the migrations run', async () => {
    const all = await products.findAll();

    expect(all.map((product) => product.name)).toEqual(
      expect.arrayContaining([
        'Aurora Wireless Headphones',
        'Nimbus Mechanical Keyboard',
        'Orbit Portable Speaker',
        'Pulse Smart Watch',
      ]),
    );
  });

  it('reads prices as integer cents and stock as a number', async () => {
    const product = await products.findById(
      'a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601',
    );

    expect(product).toMatchObject({
      name: 'Aurora Wireless Headphones',
      priceInCents: 45_990_000,
    });
    expect(Number.isInteger(product?.stock)).toBe(true);
  });
});
