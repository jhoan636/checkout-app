import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { httpErrorFor } from './http-error';
import { HttpErrorFilter } from './http-error.filter';

const send = (exception: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  new HttpErrorFilter().catch(exception, host);

  return {
    status: status.mock.calls[0] as [number],
    body: json.mock.calls[0] as [unknown],
  };
};

describe('HttpErrorFilter', () => {
  it('keeps the code and message of a business error', () => {
    expect(send(httpErrorFor('INSUFFICIENT_STOCK'))).toEqual({
      status: [409],
      body: [
        {
          statusCode: 409,
          error: 'INSUFFICIENT_STOCK',
          message: 'There are not enough units in stock.',
        },
      ],
    });
  });

  it.each([
    [new BadRequestException('Validation failed'), 400, 'BAD_REQUEST'],
    [new UnauthorizedException(), 401, 'UNAUTHORIZED'],
    [new NotFoundException('Cannot GET /nope'), 404, 'NOT_FOUND'],
    [new HttpException('Too big', 413), 413, 'PAYLOAD_TOO_LARGE'],
    [new HttpException('Slow down', 429), 429, 'TOO_MANY_REQUESTS'],
    [new HttpException('Odd', 418), 418, 'REQUEST_ERROR'],
    [new HttpException('Down', 503), 503, 'INTERNAL_ERROR'],
  ])(
    'gives a code to an error raised by the framework',
    (exception, status, code) => {
      expect(send(exception).body[0]).toMatchObject({
        statusCode: status,
        error: code,
      });
    },
  );

  it('keeps the list of messages of a validation error', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: ['quantity must not be less than 1'],
    });

    expect(send(exception).body[0]).toEqual({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: ['quantity must not be less than 1'],
    });
  });

  describe('errors raised below the framework', () => {
    // The body parser throws plain errors that carry their status.
    const fromBodyParser = (status: number, message: string) =>
      Object.assign(new Error(message), { status });

    it('gives a body that is too large the same shape and a code', () => {
      expect(
        send(fromBodyParser(413, 'request entity too large')).body[0],
      ).toEqual({
        statusCode: 413,
        error: 'PAYLOAD_TOO_LARGE',
        message: 'The request body is too large.',
      });
    });

    it('gives a body that cannot be read the same shape and a code', () => {
      expect(
        send(fromBodyParser(400, 'Unexpected token } in JSON')).body[0],
      ).toEqual({
        statusCode: 400,
        error: 'BAD_REQUEST',
        message: 'The request body could not be read.',
      });
    });

    it('answers a generic 500 for anything unexpected and reveals nothing', () => {
      const logged = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      expect(send(new Error('password=secret at db.internal'))).toEqual({
        status: [500],
        body: [
          {
            statusCode: 500,
            error: 'INTERNAL_ERROR',
            message: 'The request could not be completed.',
          },
        ],
      });
      expect(logged).toHaveBeenCalledTimes(1);
      logged.mockRestore();
    });

    it('does not trust a status outside the client errors', () => {
      const logged = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      expect(send(fromBodyParser(200, 'odd')).status).toEqual([500]);
      logged.mockRestore();
    });
  });

  it('uses the text of the exception when it carries only a text', () => {
    expect(send(new HttpException('Just a text', 400)).body[0]).toEqual({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Just a text',
    });
  });
});
