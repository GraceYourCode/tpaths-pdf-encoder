/**
 * LoggingInterceptor
 *
 * Emits one structured log line per HTTP request with method, route, status
 * code, response time, and correlation id. This is the request-logging half of
 * the logging foundation (the exception filter logs failures in detail).
 *
 * LOGGING POLICY: this interceptor deliberately logs only request metadata. It
 * NEVER logs request bodies, headers, query strings, or responses, because
 * those may contain passwords, access/refresh tokens, raw license tokens, or
 * signed document URLs. If body logging is ever added, route it through
 * `redact()` and keep it out of production. See docs/architecture.md.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import type { RequestWithId } from '../middleware/request-id.middleware.js';

/** Field names whose values must never appear in logs. */
const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'apikey',
  'api_key',
  'licensetoken',
]);

/**
 * Recursively replace sensitive values with `[REDACTED]`. Provided for use by
 * any future opt-in payload logging; the request logger below does not log
 * payloads at all.
 */
export function redact(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => redact(item));
  }
  if (input && typeof input === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      input as Record<string, unknown>,
    )) {
      output[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? '[REDACTED]'
        : redact(value);
    }
    return output;
  }
  return input;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();
    const startedAt = Date.now();
    const { method } = req;
    const route = this.routeOf(req);

    return next.handle().pipe(
      tap({
        next: () =>
          this.log(method, route, res.statusCode, startedAt, req.requestId),
        error: (err: unknown) => {
          const status =
            typeof (err as { status?: number })?.status === 'number'
              ? (err as { status: number }).status
              : 500;
          this.log(method, route, status, startedAt, req.requestId);
        },
      }),
    );
  }

  private routeOf(req: Request): string {
    // Prefer the matched route pattern; fall back to the raw URL.
    return req.route?.path ?? req.originalUrl ?? req.url;
  }

  private log(
    method: string,
    route: string,
    status: number,
    startedAt: number,
    requestId?: string,
  ): void {
    const durationMs = Date.now() - startedAt;
    const parts = [
      `${method} ${route}`,
      `${status}`,
      `${durationMs}ms`,
      requestId ? `reqId=${requestId}` : undefined,
    ].filter(Boolean);
    this.logger.log(parts.join(' '));
  }
}
