export interface Env {
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SSL: boolean;
}

type RawEnv = Record<string, unknown>;

const DEFAULT_PORT = '3000';
const DEFAULT_DB_SSL = 'false';
const MAX_PORT = 65535;

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

  const env: Env = {
    PORT: port('PORT', DEFAULT_PORT),
    DB_HOST: text('DB_HOST'),
    DB_PORT: port('DB_PORT'),
    DB_USER: text('DB_USER'),
    DB_PASSWORD: text('DB_PASSWORD'),
    DB_NAME: text('DB_NAME'),
    DB_SSL: flag('DB_SSL', DEFAULT_DB_SSL),
  };

  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.join('; ')}`);
  }

  return env;
}
