import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

interface LoggedRequest {
  method: string;
  route?: { path?: string };
}

/**
 * One line per request: method, route pattern, status and duration. It never
 * logs bodies, headers, query strings or real ids, so tokens and personal data
 * cannot end up in the logs.
 */
@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<LoggedRequest>();
    const startedAt = Date.now();
    const line = (status: number) =>
      `${request.method} ${request.route?.path ?? 'unmatched'} ${status} ${Date.now() - startedAt}ms`;

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(
            line(http.getResponse<{ statusCode: number }>().statusCode),
          ),
        error: (error: { status?: unknown }) =>
          this.logger.warn(
            line(
              typeof error.status === 'number'
                ? error.status
                : HttpStatus.INTERNAL_SERVER_ERROR,
            ),
          ),
      }),
    );
  }
}
