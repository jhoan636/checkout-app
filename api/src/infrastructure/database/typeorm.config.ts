import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Env } from '../config/env.validation';

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
    autoLoadEntities: true,
    // The schema only changes through migrations.
    synchronize: false,
  };
}
