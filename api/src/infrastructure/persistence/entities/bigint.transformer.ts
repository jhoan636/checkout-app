import { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL returns BIGINT as text. Amounts in cents stay far below
 * Number.MAX_SAFE_INTEGER, so they are read back as numbers.
 */
export const bigintToNumber: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};
