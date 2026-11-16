import { andThen, err, fromPromise, match, ok, Result } from './result';

const parsePositive = (input: number): Result<number, string> =>
  input > 0 ? ok(input) : err('NOT_POSITIVE');

describe('Result', () => {
  describe('ok and err', () => {
    it('ok carries a value on the success track', () => {
      expect(ok(5)).toEqual({ ok: true, value: 5 });
    });

    it('err carries an error on the failure track', () => {
      expect(err('BOOM')).toEqual({ ok: false, error: 'BOOM' });
    });

    it('lets the compiler narrow the type by checking ok', () => {
      const result = parsePositive(3);

      expect(result.ok && result.value).toBe(3);
    });
  });

  describe('andThen', () => {
    it('chains a step that succeeds', () => {
      expect(andThen(ok(4), parsePositive)).toEqual(ok(4));
    });

    it('switches to the failure track when the step fails', () => {
      expect(andThen(ok(-1), parsePositive)).toEqual(err('NOT_POSITIVE'));
    });

    it('skips the step when the result is already a failure', () => {
      const step = jest.fn();

      expect(andThen(err('EARLIER'), step)).toEqual(err('EARLIER'));
      expect(step).not.toHaveBeenCalled();
    });
  });

  describe('match', () => {
    const handlers = {
      ok: (value: number) => `value ${value}`,
      err: (error: string) => `error ${error}`,
    };

    it('runs the ok handler for a success', () => {
      expect(match(ok(7), handlers)).toBe('value 7');
    });

    it('runs the err handler for a failure', () => {
      expect(match(err('BOOM'), handlers)).toBe('error BOOM');
    });
  });

  describe('fromPromise', () => {
    it('turns a resolved promise into a success', async () => {
      await expect(
        fromPromise(Promise.resolve(9), () => 'FAILED'),
      ).resolves.toEqual(ok(9));
    });

    it('turns a rejected promise into a failure using the mapper', async () => {
      const failure = new Error('timeout');

      await expect(
        fromPromise(Promise.reject(failure), (cause) => ({
          code: 'GATEWAY_UNAVAILABLE',
          cause,
        })),
      ).resolves.toEqual(err({ code: 'GATEWAY_UNAVAILABLE', cause: failure }));
    });
  });
});
