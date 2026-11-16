import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

/** Codes for the errors the framework raises by itself. */
const CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
};

const isCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Z][A-Z0-9_]*$/.test(value);

const fallbackCode = (status: number): string =>
  CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');

/**
 * Every HTTP error leaves with the same shape:
 * `{ statusCode, error, message }`, where `error` is a stable code a client
 * can switch on. Errors raised by the framework (a bad id, an unknown route,
 * too many requests) get a code too, instead of a phrase in English.
 */
@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const given: { error?: unknown; message?: unknown } =
      typeof body === 'object' ? body : { message: body };

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        error: isCode(given.error) ? given.error : fallbackCode(status),
        message: given.message ?? exception.message,
      });
  }
}
