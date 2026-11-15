export interface Env {
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SSL: boolean;
  GATEWAY_BASE_URL: string;
  GATEWAY_PRIVATE_KEY: string;
  GATEWAY_INTEGRITY_SECRET: string;
  GATEWAY_EVENTS_SECRET: string;
  GATEWAY_TIMEOUT_MS: number;
  BASE_FEE_IN_CENTS: number;
  DELIVERY_FEE_IN_CENTS: number;
  CORS_ORIGINS: string[];
  RATE_LIMIT_PER_MINUTE: number;
}

type RawEnv = Record<string, unknown>;

const DEFAULT_PORT = '3000';
const DEFAULT_DB_SSL = 'false';
const MAX_PORT = 65535;
const DEFAULT_GATEWAY_TIMEOUT_MS = '10000';
const MAX_GATEWAY_TIMEOUT_MS = 60_000;
const DEFAULT_BASE_FEE_IN_CENTS = '300000';
const DEFAULT_DELIVERY_FEE_IN_CENTS = '1200000';
const MAX_FEE_IN_CENTS = 100_000_000;
const DEFAULT_CORS_ORIGINS = 'http://localhost:5173';
const DEFAULT_RATE_LIMIT_PER_MINUTE = '120';
const MAX_RATE_LIMIT_PER_MINUTE = 10_000;

/**
 * Validates the process environment at startup so a missing or malformed
 * variable stops the application with a clear message. Error messages name the
 * variables but never include their values.
 */
export function validateEnv(raw: RawEnv): Env {
  const errors: string[] = [];

  const text = (name: string): string => {
    const value = raw[name];
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${name} is required`);
      return '';
    }
    return value;
  };

  const port = (name: string, fallback?: string): number => {
    const value = raw[name] ?? fallback;
    const parsed = Number(value);
    const isPort =
      typeof value === 'string' &&
      Number.isInteger(parsed) &&
      parsed >= 1 &&
      parsed <= MAX_PORT;
    if (!isPort) {
      errors.push(`${name} must be a port number between 1 and ${MAX_PORT}`);
      return 0;
    }
    return parsed;
  };

  const flag = (name: string, fallback: string): boolean => {
    const value = raw[name] ?? fallback;
    if (value !== 'true' && value !== 'false') {
      errors.push(`${name} must be true or false`);
      return false;
    }
    return value === 'true';
  };

  const httpsUrl = (name: string): string => {
    const value = text(name);
    if (value !== '' && !URL.canParse(value)) {
      errors.push(`${name} must be a valid URL`);
      return '';
    }
    if (value !== '' && new URL(value).protocol !== 'https:') {
      errors.push(`${name} must use https`);
      return '';
    }
    return value.replace(/\/+$/, '');
  };

  const integer = (
    name: string,
    fallback: string,
    min: number,
    max: number,
  ): number => {
    const value = raw[name] ?? fallback;
    const parsed = Number(value);
    const isValid =
      typeof value === 'string' &&
      Number.isInteger(parsed) &&
      parsed >= min &&
      parsed <= max;
    if (!isValid) {
      errors.push(`${name} must be a whole number between ${min} and ${max}`);
      return 0;
    }
    return parsed;
  };

  /** Comma separated list of exact origins, such as https://shop.example.com */
  const origins = (name: string, fallback: string): string[] => {
    const value = raw[name] ?? fallback;
    const list =
      typeof value === 'string'
        ? value
            .split(',')
            .map((origin) => origin.trim())
            .filter((origin) => origin !== '')
        : [];
    const areOrigins =
      list.length > 0 &&
      list.every(
        (origin) => URL.canParse(origin) && new URL(origin).origin === origin,
      );
    if (!areOrigins) {
      errors.push(`${name} must be a comma separated list of origins`);
      return [];
    }
    return list;
  };

  const env: Env = {
    PORT: port('PORT', DEFAULT_PORT),
    DB_HOST: text('DB_HOST'),
    DB_PORT: port('DB_PORT'),
    DB_USER: text('DB_USER'),
    DB_PASSWORD: text('DB_PASSWORD'),
    DB_NAME: text('DB_NAME'),
    DB_SSL: flag('DB_SSL', DEFAULT_DB_SSL),
    GATEWAY_BASE_URL: httpsUrl('GATEWAY_BASE_URL'),
    GATEWAY_PRIVATE_KEY: text('GATEWAY_PRIVATE_KEY'),
    GATEWAY_INTEGRITY_SECRET: text('GATEWAY_INTEGRITY_SECRET'),
    GATEWAY_EVENTS_SECRET: text('GATEWAY_EVENTS_SECRET'),
    GATEWAY_TIMEOUT_MS: integer(
      'GATEWAY_TIMEOUT_MS',
      DEFAULT_GATEWAY_TIMEOUT_MS,
      1,
      MAX_GATEWAY_TIMEOUT_MS,
    ),
    BASE_FEE_IN_CENTS: integer(
      'BASE_FEE_IN_CENTS',
      DEFAULT_BASE_FEE_IN_CENTS,
      0,
      MAX_FEE_IN_CENTS,
    ),
    DELIVERY_FEE_IN_CENTS: integer(
      'DELIVERY_FEE_IN_CENTS',
      DEFAULT_DELIVERY_FEE_IN_CENTS,
      0,
      MAX_FEE_IN_CENTS,
    ),
    CORS_ORIGINS: origins('CORS_ORIGINS', DEFAULT_CORS_ORIGINS),
    RATE_LIMIT_PER_MINUTE: integer(
      'RATE_LIMIT_PER_MINUTE',
      DEFAULT_RATE_LIMIT_PER_MINUTE,
      1,
      MAX_RATE_LIMIT_PER_MINUTE,
    ),
  };

  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.join('; ')}`);
  }

  return env;
}
