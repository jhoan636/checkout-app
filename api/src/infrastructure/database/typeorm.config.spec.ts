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
