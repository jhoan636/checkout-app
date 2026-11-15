import { httpErrorFor } from './http-error';

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
