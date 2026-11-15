/** Injection tokens: TypeScript interfaces do not exist at runtime. */
export const CLOCK = Symbol('Clock');
export const ID_GENERATOR = Symbol('IdGenerator');
export const FEES = Symbol('Fees');

/** Port: the current time, so use cases never read the system clock. */
export interface Clock {
  now(): Date;
}

/** Port: unique identifiers, so use cases stay predictable in tests. */
export interface IdGenerator {
  uuid(): string;
}
