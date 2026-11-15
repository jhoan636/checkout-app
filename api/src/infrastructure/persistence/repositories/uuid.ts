const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PostgreSQL rejects a malformed UUID with an error; repositories check first
 * and report an id that cannot exist as not found.
 */
export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);
