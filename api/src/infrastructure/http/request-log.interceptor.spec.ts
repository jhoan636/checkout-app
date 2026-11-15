import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RequestLogInterceptor } from './request-log.interceptor';

const contextFor = (request: object, statusCode = 200): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode }),
    }),
  }) as unknown as ExecutionContext;

const request = {
  method: 'POST',
  route: { path: '/transactions/:id' },
  url: '/transactions/7c1e8a52?email=ana@example.com',
  headers: { authorization: 'Bearer secret', 'idempotency-key': 'key-1' },
  body: {
    payment: { cardToken: 'tok_secret' },
    customer: { email: 'ana@example.com' },
  },
};

const firstLine = (spy: jest.SpyInstance): string =>
  String((spy.mock.calls as unknown[][])[0][0]);

describe('RequestLogInterceptor', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  const run = (handler: CallHandler, statusCode?: number) =>
    lastValueFrom(
      new RequestLogInterceptor().intercept(
        contextFor(request, statusCode),
        handler,
      ),
    );

  it('logs method, route pattern, status and duration', async () => {
    await run({ handle: () => of('ok') }, 201);

    expect(log).toHaveBeenCalledTimes(1);
    expect(firstLine(log)).toMatch(/^POST \/transactions\/:id 201 \d+ms$/);
  });

  it('never logs the body, the headers or the query string', async () => {
    await run({ handle: () => of('ok') });

    const line = String(firstLine(log));
    expect(line).not.toMatch(/secret|ana@example\.com|key-1|7c1e8a52/);
  });

  it('logs a failed request as a warning and lets the error through', async () => {
    const failure = Object.assign(new Error('boom'), { status: 409 });

    await expect(run({ handle: () => throwError(() => failure) })).rejects.toBe(
      failure,
    );

    expect(firstLine(warn)).toMatch(/^POST \/transactions\/:id 409 \d+ms$/);
  });

  it('reports 500 for an error without an HTTP status', async () => {
    await expect(
      run({ handle: () => throwError(() => new Error('boom')) }),
    ).rejects.toThrow('boom');

    expect(firstLine(warn)).toMatch(/ 500 \d+ms$/);
  });

  it('logs "unmatched" when no route was matched', async () => {
    const interceptor = new RequestLogInterceptor();

    await lastValueFrom(
      interceptor.intercept(contextFor({ method: 'GET', url: '/nope?x=1' }), {
        handle: () => of('ok'),
      }),
    );

    expect(firstLine(log)).toMatch(/^GET unmatched 200 \d+ms$/);
  });
});
