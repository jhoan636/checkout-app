import { HttpException } from '@nestjs/common';
import { err, ok } from '../../../domain/shared/result';
import { httpErrorFor, respond } from './http-error';

describe('respond', () => {
  it('answers a success with what the presenter makes of its value', () => {
    expect(respond(ok(2), (units) => ({ units }))).toEqual({ units: 2 });
  });

  it('turns a failure into its HTTP error and never calls the presenter', () => {
    const present = jest.fn((units: number) => units);

    expect(() => respond(err('INSUFFICIENT_STOCK'), present)).toThrow(
      HttpException,
    );
    expect(present).not.toHaveBeenCalled();
  });

  it('keeps the code of the failure in the error', () => {
    let thrown: unknown;
    try {
      respond(err('PRODUCT_NOT_FOUND'), jest.fn());
    } catch (error) {
      thrown = error;
    }

    expect((thrown as HttpException).getStatus()).toBe(404);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      error: 'PRODUCT_NOT_FOUND',
    });
  });
});

describe('httpErrorFor', () => {
  it.each([
    ['PRODUCT_NOT_FOUND', 404],
    ['TRANSACTION_NOT_FOUND', 404],
    ['INSUFFICIENT_STOCK', 409],
    ['INVALID_QUANTITY', 422],
    ['INVALID_AMOUNT', 422],
  ])('maps %s to HTTP %s and keeps the code', (code, status) => {
    const error = httpErrorFor(code);

    expect(error.getStatus()).toBe(status);
    expect(error.getResponse()).toMatchObject({
      statusCode: status,
      error: code,
    });
  });

  it('turns an unknown code into a generic 500 without leaking it', () => {
    const error = httpErrorFor('INVALID_FEE');

    expect(error.getStatus()).toBe(500);
    expect(error.getResponse()).toEqual({
      statusCode: 500,
      error: 'INTERNAL_ERROR',
      message: 'The request could not be completed.',
    });
  });

  it('does not treat inherited object keys as known codes', () => {
    expect(httpErrorFor('constructor').getStatus()).toBe(500);
  });
});
