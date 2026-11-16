import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
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

/** Messages of this API for the errors raised below the framework. */
const MESSAGES: Record<number, string> = {
  400: 'The request body could not be read.',
  413: 'The request body is too large.',
};
const UNEXPECTED = 'The request could not be completed.';

/**
 * The body parser throws plain errors, not HttpException, and puts its
 * status in a property. Only a client error is taken from there: anything
 * else is a failure of this server.
 */
const statusBelowFramework = (exception: unknown): number => {
  const status = (exception as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500
    ? status
    : 500;
};

/**
 * Every error leaves with the same shape: `{ statusCode, error, message }`,
 * where `error` is a stable code a client can switch on. That covers the
 * business errors, the ones the framework raises (a bad id, an unknown
 * route, too many requests) and the ones raised below it (a body that is too
 * large or is not JSON). An unexpected failure is logged here and answered
 * with a generic 500 that reveals nothing.
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpErrorFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      const status = statusBelowFramework(exception);
      if (status === 500) {
        this.logger.error(exception);
      }
      response.status(status).json({
        statusCode: status,
        error: fallbackCode(status),
        message: MESSAGES[status] ?? UNEXPECTED,
      });
      return;
    }

    const status = exception.getStatus();
    const body = exception.getResponse();
    const given: { error?: unknown; message?: unknown } =
      typeof body === 'object' ? body : { message: body };

    response.status(status).json({
      statusCode: status,
      error: isCode(given.error) ? given.error : fallbackCode(status),
      message: given.message ?? exception.message,
    });
  }
}
