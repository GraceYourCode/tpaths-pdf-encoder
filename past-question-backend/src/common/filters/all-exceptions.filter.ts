/**
 * AllExceptionsFilter
 *
 * Catches everything thrown in the request pipeline and returns the consistent
 * API error envelope:
 *
 *   { success: false, error: { code, message, details? }, timestamp, path }
 *
 * SECURITY: in production this filter never exposes internal detail. For
 * unexpected (non-HTTP) errors it returns a generic message and logs the real
 * error server-side only. Stack traces, database driver errors, filesystem
 * paths, and secrets are therefore kept out of client responses. Known
 * `HttpException`s (including validation errors from the global ValidationPipe)
 * keep their client-safe message and status.
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import type { RequestWithId } from '../middleware/request-id.middleware.js';
import type { ApiErrorResponse } from '../types/api-response.js';
import { ErrorCode, errorCodeFromStatus } from '../types/error-code.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithId>();

    const { status, code, message, details } = this.normalize(exception);

    // Server-side logging: 5xx are errors (with stack), 4xx are debug-level.
    const logContext = `reqId=${req.requestId ?? '-'} ${req.method} ${req.url}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${status} ${code} ${logContext}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(`${status} ${code} ${logContext} - ${message}`);
    }

    const body: ApiErrorResponse = {
      success: false,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
      timestamp: new Date().toISOString(),
      path: req.originalUrl ?? req.url,
    };

    res.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      return {
        status,
        code: errorCodeFromStatus(status),
        message: this.messageFrom(response, exception.message),
        details: this.detailsFrom(response, status),
      };
    }

    // Unknown/unexpected error: never leak internals to the client.
    const message = this.isProduction
      ? 'Internal server error'
      : exception instanceof Error
        ? exception.message
        : 'Internal server error';

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.InternalServerError,
      message,
    };
  }

  /** Extract a client-safe message from an HttpException response payload. */
  private messageFrom(response: string | object, fallback: string): string {
    if (typeof response === 'string') {
      return response;
    }
    const msg = (response as { message?: unknown }).message;
    if (Array.isArray(msg)) {
      // ValidationPipe returns an array of messages; surface the first as the
      // summary and keep the full list in `details`.
      return 'Request validation failed';
    }
    if (typeof msg === 'string') {
      return msg;
    }
    return fallback;
  }

  /**
   * For validation errors, expose the field-level messages under `details` so
   * clients can show precise feedback. These come from our own DTOs and contain
   * no sensitive server internals.
   */
  private detailsFrom(response: string | object, status: number): unknown {
    if (status !== HttpStatus.BAD_REQUEST || typeof response === 'string') {
      return undefined;
    }
    const msg = (response as { message?: unknown }).message;
    return Array.isArray(msg) ? msg : undefined;
  }
}
