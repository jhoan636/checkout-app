import { validateEnv } from './env.validation';

const validEnv = {
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5433',
  DB_USER: 'checkout',
  DB_PASSWORD: 'secret',
  DB_NAME: 'checkout',
  DB_SSL: 'false',
  GATEWAY_BASE_URL: 'https://gateway.test/v1',
  GATEWAY_PRIVATE_KEY: 'prv_test_key',
  GATEWAY_INTEGRITY_SECRET: 'integrity_secret',
  GATEWAY_EVENTS_SECRET: 'events_secret',
  GATEWAY_TIMEOUT_MS: '8000',
  BASE_FEE_IN_CENTS: '250000',
  DELIVERY_FEE_IN_CENTS: '900000',
};

describe('validateEnv', () => {
  it('returns typed values when every variable is valid', () => {
    expect(validateEnv(validEnv)).toEqual({
      PORT: 3000,
      DB_HOST: 'localhost',
      DB_PORT: 5433,
      DB_USER: 'checkout',
      DB_PASSWORD: 'secret',
      DB_NAME: 'checkout',
      DB_SSL: false,
      GATEWAY_BASE_URL: 'https://gateway.test/v1',
      GATEWAY_PRIVATE_KEY: 'prv_test_key',
      GATEWAY_INTEGRITY_SECRET: 'integrity_secret',
      GATEWAY_EVENTS_SECRET: 'events_secret',
      GATEWAY_TIMEOUT_MS: 8000,
      BASE_FEE_IN_CENTS: 250_000,
      DELIVERY_FEE_IN_CENTS: 900_000,
    });
  });

  it('applies defaults for optional variables', () => {
    const env = { ...validEnv, PORT: undefined, DB_SSL: undefined };

    expect(validateEnv(env)).toMatchObject({ PORT: 3000, DB_SSL: false });
  });

  it('reads DB_SSL=true as a boolean', () => {
    expect(validateEnv({ ...validEnv, DB_SSL: 'true' }).DB_SSL).toBe(true);
  });

  it.each([
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'GATEWAY_BASE_URL',
    'GATEWAY_PRIVATE_KEY',
    'GATEWAY_INTEGRITY_SECRET',
    'GATEWAY_EVENTS_SECRET',
  ])('fails when %s is missing', (name) => {
    expect(() => validateEnv({ ...validEnv, [name]: undefined })).toThrow(name);
  });

  it('fails when a required variable is blank', () => {
    expect(() => validateEnv({ ...validEnv, DB_HOST: '   ' })).toThrow(
      'DB_HOST',
    );
  });

  it.each(['abc', '0', '70000', '80.5'])(
    'fails when a port is not a valid port number (%s)',
    (port) => {
      expect(() => validateEnv({ ...validEnv, DB_PORT: port })).toThrow(
        'DB_PORT',
      );
    },
  );

  it('fails when DB_SSL is not true or false', () => {
    expect(() => validateEnv({ ...validEnv, DB_SSL: 'yes' })).toThrow('DB_SSL');
  });

  it('reports every invalid variable in one error', () => {
    const env = { ...validEnv, DB_HOST: undefined, DB_NAME: undefined };

    expect(() => validateEnv(env)).toThrow(/DB_HOST.*DB_NAME/s);
  });

  it('never includes variable values in the error message', () => {
    const env = { ...validEnv, DB_PASSWORD: 'secret', DB_PORT: 'abc' };

    expect(() => validateEnv(env)).not.toThrow(/secret/);
  });

  it('removes a trailing slash from the gateway URL', () => {
    const env = { ...validEnv, GATEWAY_BASE_URL: 'https://gateway.test/v1/' };

    expect(validateEnv(env).GATEWAY_BASE_URL).toBe('https://gateway.test/v1');
  });

  it.each(['http://gateway.test/v1', 'gateway.test', 'ftp://gateway.test'])(
    'fails when the gateway URL is not HTTPS (%s)',
    (url) => {
      expect(() => validateEnv({ ...validEnv, GATEWAY_BASE_URL: url })).toThrow(
        'GATEWAY_BASE_URL',
      );
    },
  );

  it('uses a default gateway timeout of 10 seconds', () => {
    const env = { ...validEnv, GATEWAY_TIMEOUT_MS: undefined };

    expect(validateEnv(env).GATEWAY_TIMEOUT_MS).toBe(10_000);
  });

  it.each(['abc', '0', '-5', '1.5', '120000'])(
    'fails when the gateway timeout is not between 1 ms and 60 s (%s)',
    (timeout) => {
      expect(() =>
        validateEnv({ ...validEnv, GATEWAY_TIMEOUT_MS: timeout }),
      ).toThrow('GATEWAY_TIMEOUT_MS');
    },
  );

  it('never includes the gateway keys in the error message', () => {
    const env = { ...validEnv, DB_PORT: 'abc' };

    expect(() => validateEnv(env)).not.toThrow(/prv_test_key|integrity_secret/);
  });

  it('uses default fees when none are configured', () => {
    const env = {
      ...validEnv,
      BASE_FEE_IN_CENTS: undefined,
      DELIVERY_FEE_IN_CENTS: undefined,
    };

    expect(validateEnv(env)).toMatchObject({
      BASE_FEE_IN_CENTS: 300_000,
      DELIVERY_FEE_IN_CENTS: 1_200_000,
    });
  });

  it('accepts a fee of zero', () => {
    const env = { ...validEnv, BASE_FEE_IN_CENTS: '0' };

    expect(validateEnv(env).BASE_FEE_IN_CENTS).toBe(0);
  });

  it.each(['BASE_FEE_IN_CENTS', 'DELIVERY_FEE_IN_CENTS'])(
    'fails when %s is negative or has decimals',
    (name) => {
      expect(() => validateEnv({ ...validEnv, [name]: '-1' })).toThrow(name);
      expect(() => validateEnv({ ...validEnv, [name]: '10.5' })).toThrow(name);
    },
  );
});
