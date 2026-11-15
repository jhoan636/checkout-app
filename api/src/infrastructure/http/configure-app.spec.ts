import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configureApp, securityHeaders } from './configure-app';
import { RequestLogInterceptor } from './request-log.interceptor';

const setup = () => {
  const app = {
    get: jest.fn().mockReturnValue(
      new ConfigService({
        CORS_ORIGINS: ['https://shop.example.com', 'http://localhost:5173'],
      }),
    ),
    use: jest.fn(),
    enableCors: jest.fn(),
    useGlobalPipes: jest.fn(),
    useGlobalInterceptors: jest.fn(),
    enableShutdownHooks: jest.fn(),
  };
  configureApp(app as unknown as INestApplication);
  return app;
};

/** Runs the security middleware and returns the headers it sets. */
const headersFor = (path: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  const response = {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    removeHeader: jest.fn(),
    getHeader: jest.fn(),
  };
  securityHeaders({ path, headers: {} } as never, response as never, jest.fn());
  return headers;
};

describe('configureApp', () => {
  it('validates every request and refuses unknown fields', () => {
    const app = setup();

    const [pipe] = app.useGlobalPipes.mock.calls[0] as [ValidationPipe];
    expect(pipe).toBeInstanceOf(ValidationPipe);
    expect(pipe).toMatchObject({
      validatorOptions: { whitelist: true, forbidNonWhitelisted: true },
      isTransformEnabled: true,
    });
  });

  it('allows only the configured origins, methods and headers through CORS', () => {
    const app = setup();

    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ['https://shop.example.com', 'http://localhost:5173'],
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Idempotency-Key'],
      maxAge: 600,
    });
  });

  it('installs the security headers before anything else', () => {
    const app = setup();

    expect(app.use).toHaveBeenCalledWith(securityHeaders);
  });

  it('logs every request and closes cleanly on shutdown', () => {
    const app = setup();

    expect(
      (app.useGlobalInterceptors.mock.calls as unknown[][])[0][0],
    ).toBeInstanceOf(RequestLogInterceptor);
    expect(app.enableShutdownHooks).toHaveBeenCalled();
  });
});

describe('securityHeaders', () => {
  it('sets the OWASP recommended headers on API responses', () => {
    const headers = headersFor('/products');

    expect(headers).toMatchObject({
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cross-origin-resource-policy': 'same-site',
    });
  });

  it('forbids every kind of content on API responses (JSON only)', () => {
    expect(headersFor('/products')['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
  });

  it('never caches API responses', () => {
    expect(headersFor('/transactions/1')['cache-control']).toBe('no-store');
  });

  it('relaxes the policy only for the documentation page', () => {
    const policy = headersFor('/docs')['content-security-policy'];

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(headersFor('/docs-json')['content-security-policy']).toContain(
      "default-src 'self'",
    );
  });
});
