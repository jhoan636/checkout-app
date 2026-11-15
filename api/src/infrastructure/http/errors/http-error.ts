import { HttpException, HttpStatus } from '@nestjs/common';

interface ErrorResponse {
  readonly status: HttpStatus;
  readonly message: string;
}

/**
 * The only place where a business error becomes an HTTP status. Use cases
 * return error codes and know nothing about HTTP.
 */
const RESPONSES: Record<string, ErrorResponse> = {
  PRODUCT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'The product does not exist.',
  },
  TRANSACTION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'The transaction does not exist.',
  },
  INSUFFICIENT_STOCK: {
    status: HttpStatus.CONFLICT,
    message: 'There are not enough units in stock.',
  },
  INVALID_QUANTITY: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'The quantity must be a whole number greater than zero.',
  },
  INVALID_AMOUNT: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: 'The amount to charge is not valid.',
  },
};

const UNEXPECTED: ErrorResponse = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  message: 'The request could not be completed.',
};

/** Unknown codes become a generic 500 and reveal nothing internal. */
export const httpErrorFor = (code: string): HttpException => {
  const known = Object.hasOwn(RESPONSES, code) ? RESPONSES[code] : undefined;
  const { status, message } = known ?? UNEXPECTED;
  return new HttpException(
    {
      statusCode: status,
      error: known ? code : 'INTERNAL_ERROR',
      message,
    },
    status,
  );
};
