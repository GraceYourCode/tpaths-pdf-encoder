/**
 * RequestIdMiddleware
 *
 * Assigns a stable request identifier to every incoming request so logs and
 * error responses can be correlated. Honours an inbound `X-Request-Id` (useful
 * when a load balancer or the mobile client sets one) and otherwise generates a
 * UUID. The id is attached to the request object and echoed back in the
 * `X-Request-Id` response header.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Request augmented with the correlation id set by this middleware. */
export interface RequestWithId extends Request {
  requestId?: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const inbound = req.headers[REQUEST_ID_HEADER];
    const requestId =
      (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID();

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
