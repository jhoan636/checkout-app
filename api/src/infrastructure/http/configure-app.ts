import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Env } from '../config/env.validation';
import { RequestLogInterceptor } from './request-log.interceptor';

export const DOCS_PATH = 'docs';

const ONE_YEAR_IN_SECONDS = 31_536_000;
const CORS_PREFLIGHT_CACHE_SECONDS = 600;

const sharedHeaders = {
  strictTransportSecurity: {
    maxAge: ONE_YEAR_IN_SECONDS,
    includeSubDomains: true,
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginResourcePolicy: { policy: 'same-site' },
} as const;

/** The API only returns JSON, so no content of any kind is allowed to load. */
const apiHeaders = helmet({
  ...sharedHeaders,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  },
});

/** The documentation page needs its own scripts and styles, and nothing else. */
const docsHeaders = helmet({
  ...sharedHeaders,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      frameAncestors: ["'none'"],
    },
  },
});

/** OWASP secure headers on every response. */
export const securityHeaders = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  if (request.path.startsWith(`/${DOCS_PATH}`)) {
    docsHeaders(request, response, next);
    return;
  }
  // Payment and customer data must never be stored by a browser or a proxy.
  response.setHeader('Cache-Control', 'no-store');
  apiHeaders(request, response, next);
};

/**
 * HTTP settings shared by the real server and the end-to-end tests, so the
 * tests exercise the same behaviour the deployed API has.
 */
export const configureApp = (app: INestApplication): void => {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(securityHeaders);
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key'],
    maxAge: CORS_PREFLIGHT_CACHE_SECONDS,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      // Unknown fields are refused instead of silently dropped.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new RequestLogInterceptor());
  app.enableShutdownHooks();
};
