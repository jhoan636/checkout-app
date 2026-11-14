import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

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

  it('does not leak the database error to the client', async () => {
    const query = jest
      .fn()
      .mockRejectedValue(new Error('password authentication failed'));

    await expect(controllerWith(query).check()).rejects.toMatchObject({
      response: { status: 'error', database: 'down' },
    });
  });
});
