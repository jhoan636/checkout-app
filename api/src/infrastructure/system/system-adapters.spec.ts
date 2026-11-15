import { SystemClock, UuidGenerator } from './system-adapters';

describe('system adapters', () => {
  it('SystemClock returns the current time', () => {
    const before = Date.now();

    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('UuidGenerator returns a different UUID each time', () => {
    const ids = new UuidGenerator();
    const first = ids.uuid();

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(ids.uuid()).not.toBe(first);
  });
});
