import { validateEnv } from './env.validation';

const validEnv = {
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5433',
  DB_USER: 'checkout',
  DB_PASSWORD: 'secret',
  DB_NAME: 'checkout',
  DB_SSL: 'false',
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
    });
  });

  it('applies defaults for optional variables', () => {
    const env = { ...validEnv, PORT: undefined, DB_SSL: undefined };

    expect(validateEnv(env)).toMatchObject({ PORT: 3000, DB_SSL: false });
  });

  it('reads DB_SSL=true as a boolean', () => {
    expect(validateEnv({ ...validEnv, DB_SSL: 'true' }).DB_SSL).toBe(true);
  });

  it.each(['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'])(
    'fails when %s is missing',
    (name) => {
      expect(() => validateEnv({ ...validEnv, [name]: undefined })).toThrow(
        name,
      );
    },
  );

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
});
