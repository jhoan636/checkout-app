import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation';
import { buildTypeOrmOptions } from './typeorm.config';

const env: Env = {
  PORT: 3000,
  DB_HOST: 'db.internal',
  DB_PORT: 5433,
  DB_USER: 'checkout',
  DB_PASSWORD: 'secret',
  DB_NAME: 'checkout',
  DB_SSL: false,
  GATEWAY_BASE_URL: 'https://gateway.test/v1',
  GATEWAY_PRIVATE_KEY: 'prv_test_key',
  GATEWAY_INTEGRITY_SECRET: 'integrity_secret',
  GATEWAY_EVENTS_SECRET: 'events_secret',
  GATEWAY_TIMEOUT_MS: 10_000,
  BASE_FEE_IN_CENTS: 300_000,
  DELIVERY_FEE_IN_CENTS: 1_200_000,
  CORS_ORIGINS: ['http://localhost:5173'],
  RATE_LIMIT_PER_MINUTE: 120,
};

const configWith = (overrides: Partial<Env> = {}) =>
  new ConfigService<Env, true>({ ...env, ...overrides });

describe('buildTypeOrmOptions', () => {
  it('maps the environment to a postgres connection', () => {
    expect(buildTypeOrmOptions(configWith())).toMatchObject({
      type: 'postgres',
      host: 'db.internal',
      port: 5433,
      username: 'checkout',
      password: 'secret',
      database: 'checkout',
    });
  });

  it('limits the pool and how long a connection or a statement can take', () => {
    expect(buildTypeOrmOptions(configWith())).toMatchObject({
      extra: {
        max: 10,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 30_000,
        statement_timeout: 10_000,
      },
    });
  });

  it('never lets the ORM change the schema on its own', () => {
    expect(buildTypeOrmOptions(configWith())).toMatchObject({
      synchronize: false,
    });
  });

  it('runs pending migrations when the app starts', () => {
    const options = buildTypeOrmOptions(configWith());

    expect(options).toMatchObject({ migrationsRun: true });
    expect(options.migrations).toEqual([
      expect.stringMatching(/migrations[\\/]\*\{\.ts,\.js\}$/),
    ]);
  });

  it('disables TLS when DB_SSL is false', () => {
    expect(buildTypeOrmOptions(configWith())).toMatchObject({ ssl: false });
  });

  it('enables verified TLS when DB_SSL is true', () => {
    expect(buildTypeOrmOptions(configWith({ DB_SSL: true }))).toMatchObject({
      ssl: { rejectUnauthorized: true },
    });
  });
});
