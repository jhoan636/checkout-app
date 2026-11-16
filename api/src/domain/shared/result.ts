/**
 * Railway Oriented Programming: every step returns a Result instead of
 * throwing. A success stays on the "ok" track; the first failure switches to
 * the "err" track and the remaining steps are skipped.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** Chains a step that can fail; it only runs if the result is a success. */
export const andThen = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> => (result.ok ? fn(result.value) : result);

/** Leaves the railway: one handler per track, both return the same type. */
export const match = <T, E, R>(
  result: Result<T, E>,
  handlers: { ok: (value: T) => R; err: (error: E) => R },
): R => (result.ok ? handlers.ok(result.value) : handlers.err(result.error));

/**
 * Boundary with code that throws (HTTP clients, the database driver): a
 * rejection becomes a typed failure instead of an exception.
 */
export const fromPromise = async <T, E>(
  promise: Promise<T>,
  onRejected: (cause: unknown) => E,
): Promise<Result<T, E>> => {
  try {
    return ok(await promise);
  } catch (cause) {
    return err(onRejected(cause));
  }
};
