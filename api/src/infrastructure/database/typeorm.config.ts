import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'node:path';
import { Env } from '../config/env.validation';

const DB_POOL_SIZE = 10;
/** A request waits this long for a free connection, then fails. */
const DB_CONNECTION_TIMEOUT_MS = 5_000;
const DB_IDLE_TIMEOUT_MS = 30_000;
/** PostgreSQL cancels any statement that runs longer than this. */
const DB_STATEMENT_TIMEOUT_MS = 10_000;

export function buildTypeOrmOptions(
  config: ConfigService<Env, true>,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.get('DB_HOST', { infer: true }),
    port: config.get('DB_PORT', { infer: true }),
    username: config.get('DB_USER', { infer: true }),
    password: config.get('DB_PASSWORD', { infer: true }),
    database: config.get('DB_NAME', { infer: true }),
    ssl: config.get('DB_SSL', { infer: true })
      ? { rejectUnauthorized: true }
      : false,
    // Options of the connection pool (node-postgres). Without them a slow
    // database makes requests wait for ever and pile up.
    extra: {
      max: DB_POOL_SIZE,
      connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
      statement_timeout: DB_STATEMENT_TIMEOUT_MS,
    },
    autoLoadEntities: true,
    // The schema only changes through migrations.
    synchronize: false,
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    // Pending migrations are applied when the app starts.
    migrationsRun: true,
  };
}
