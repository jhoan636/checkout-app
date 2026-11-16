import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HEALTH_CACHE_MS, HealthController } from './health.controller';

const controllerWith = (query: jest.Mock) =>
  new HealthController({ query } as unknown as DataSource);

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

    await expect(controllerWith(query).check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('answers 503 when the database is unreachable', async () => {
    const query = jest.fn().mockRejectedValue(new Error('connection refused'));

    await expect(controllerWith(query).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  describe('under many requests', () => {
    afterEach(() => jest.useRealTimers());

    it('asks the database once for all of them', async () => {
      const query = jest.fn().mockResolvedValue([]);
      const controller = controllerWith(query);

      await Promise.all([
        controller.check(),
        controller.check(),
        controller.check(),
      ]);
      await controller.check();

      expect(query).toHaveBeenCalledTimes(1);
    });

    it('asks again once the cached answer is old', async () => {
      jest.useFakeTimers();
      const query = jest
        .fn()
        .mockRejectedValueOnce(new Error('connection refused'))
        .mockResolvedValue([]);
      const controller = controllerWith(query);

      await expect(controller.check()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      jest.advanceTimersByTime(HEALTH_CACHE_MS - 1);
      await expect(controller.check()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      jest.advanceTimersByTime(1);

      await expect(controller.check()).resolves.toMatchObject({
        database: 'up',
      });
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  it('does not leak the database error to the client', async () => {
    const query = jest
      .fn()
      .mockRejectedValue(new Error('password authentication failed'));

    await expect(controllerWith(query).check()).rejects.toMatchObject({
      response: { status: 'error', database: 'down' },
    });
  });
});
