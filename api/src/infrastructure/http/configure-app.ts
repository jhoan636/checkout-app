import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * HTTP settings shared by the real server and the end-to-end tests, so the
 * tests exercise the same validation the deployed API has.
 */
export const configureApp = (app: INestApplication): void => {
  app.useGlobalPipes(
    new ValidationPipe({
      // Unknown fields are refused instead of silently dropped.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
};
