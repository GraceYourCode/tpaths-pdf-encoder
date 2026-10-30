/**
 * ThrottlerGuard — lightweight, dependency-free rate limiting foundation.
 * ---------------------------------------------------------------------------
 * WHY HAND-ROLLED
 *
 * The canonical choice is `@nestjs/throttler`, but it is not installed in this
 * environment and cannot be added here. This guard provides a correct, minimal
 * fixed-window limiter so the foundation has real rate limiting today, wired
 * through configuration exactly where the official package would sit (as a
 * global `APP_GUARD`). It is intentionally simple and swappable — see
 * "UPGRADE PATH" below.
 *
 * SCOPE / LIMITATIONS (acceptable for the foundation, revisit before scale):
 *   - In-memory store: counters are per-process and reset on restart. With
 *     multiple instances, use `@nestjs/throttler` + a shared store (Redis).
 *   - Fixed window (not sliding): simpler, allows brief bursts at window edges.
 *   - Client key is best-effort IP. Behind a proxy, enable `trust proxy` /
 *     honour X-Forwarded-For before relying on this for security decisions.
 *
 * Defaults are deliberately generous (see THROTTLE_LIMIT / THROTTLE_TTL_MS in
 * .env.example) so normal development is never blocked. Tighten per-route for
 * sensitive endpoints (login, token activation, password reset, document
 * access) in later phases.
 * ---------------------------------------------------------------------------
 * UPGRADE PATH to @nestjs/throttler:
 *   1. npm install @nestjs/throttler
 *   2. Register ThrottlerModule.forRootAsync({...}) reading the same config.
 *   3. Replace this guard in the APP_GUARD provider with ThrottlerGuard.
 *   4. Delete this file.
 * ---------------------------------------------------------------------------
 */
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { THROTTLE_KEY, type ThrottleOptions } from '../decorators/throttle.decorator.js';
import type { Request, Response } from 'express';

import type { ThrottleConfig } from '../../config/configuration.js';

interface WindowState {
  count: number;
  resetAt: number;
}

@Injectable()
export class ThrottlerGuard implements CanActivate {
  private readonly ttlMs: number;
  private readonly limit: number;
  private readonly hits = new Map<string, WindowState>();
  private lastSweep = 0;

  constructor(configService: ConfigService, private readonly reflector: Reflector) {
    const throttle = configService.get<ThrottleConfig>('throttle');
    this.ttlMs = throttle?.ttlMs ?? 60000;
    this.limit = throttle?.limit ?? 120;
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const now = Date.now();
    const override = this.reflector.getAllAndOverride<ThrottleOptions>(THROTTLE_KEY, [context.getHandler(), context.getClass()]);
    const ttlMs = override?.ttlMs ?? this.ttlMs;
    const limit = override?.limit ?? this.limit;
    this.maybeSweep(now, ttlMs);

    const key = `${limit}:${ttlMs}:${this.clientKey(req)}`;
    const state = this.hits.get(key);

    let current: WindowState;
    if (!state || state.resetAt <= now) {
      current = { count: 1, resetAt: now + ttlMs };
      this.hits.set(key, current);
    } else {
      state.count += 1;
      current = state;
    }

    const remaining = Math.max(0, limit - current.count);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetAt / 1000));

    if (current.count > limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );
      res.setHeader('Retry-After', retryAfterSec);
      throw new HttpException(
        'Too many requests, please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private clientKey(req: Request): string {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  /** Periodically drop expired windows so the map does not grow unbounded. */
  private maybeSweep(now: number, ttlMs: number): void {
    if (now - this.lastSweep < ttlMs) {
      return;
    }
    this.lastSweep = now;
    for (const [key, state] of this.hits.entries()) {
      if (state.resetAt <= now) {
        this.hits.delete(key);
      }
    }
  }
}
