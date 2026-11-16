import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { DOCS_PATH } from '../configure-app';

const DESCRIPTION = [
  'Single-product store with a credit card checkout.',
  '',
  '**Flow:** read the product, ask for the payment summary, create the',
  'transaction, then read it until its status is final.',
  '',
  '**Card data never reaches this API.** The browser exchanges the card for a',
  'token directly with the payment gateway and only that token is sent here.',
  '',
  '**Money** is always an integer amount of cents of COP.',
].join('\n');

export const buildApiDocument = (app: INestApplication): OpenAPIObject =>
  SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Product Checkout API')
      .setDescription(DESCRIPTION)
      .setVersion('1.0')
      .addTag('products', 'Product, stock and payment summary')
      .addTag('transactions', 'Purchases, with their customer and delivery')
      .addTag('webhooks', 'Notifications sent by the payment gateway')
      .addTag('health')
      .build(),
  );

/** Swagger UI at /docs and the OpenAPI document at /docs-json. */
export const setupApiDocs = (app: INestApplication): void => {
  SwaggerModule.setup(DOCS_PATH, app, buildApiDocument(app), {
    jsonDocumentUrl: `${DOCS_PATH}-json`,
    customSiteTitle: 'Product Checkout API',
  });
};
