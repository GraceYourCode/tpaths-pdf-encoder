import type { PrismaService } from '../../database/prisma.service.js';

export interface RateLimitState {
  count: number;
  resetAt: number;
}

/** Fixed-window counter store. `hit` increments and returns the window state. */
export interface RateLimitStore {
  readonly kind: 'memory' | 'postgres';
  hit(key: string, ttlMs: number, now: number): Promise<RateLimitState>;
}

/** Per-process store. Development and tests only; production policy rejects it. */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly kind = 'memory' as const;
  private readonly windows = new Map<string, RateLimitState>();
  private lastSweep = 0;

  async hit(key: string, ttlMs: number, now: number): Promise<RateLimitState> {
    this.sweep(now, ttlMs);
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + ttlMs };
      this.windows.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  private sweep(now: number, ttlMs: number) {
    if (now - this.lastSweep < ttlMs) return;
    this.lastSweep = now;
    for (const [k, v] of this.windows) if (v.resetAt <= now) this.windows.delete(k);
  }
}

/**
 * Shared store backed by PostgreSQL. Each hit is a single atomic upsert, so
 * concurrent requests on any number of instances are counted exactly once.
 * Requires the `RateLimitWindow` table (migration 20260920120000).
 */
export class PostgresRateLimitStore implements RateLimitStore {
  readonly kind = 'postgres' as const;

  constructor(private readonly prisma: PrismaService) {}

  async hit(key: string, ttlMs: number, now: number): Promise<RateLimitState> {
    const nowDate = new Date(now);
    const resetAt = new Date(now + ttlMs);
    const rows = await this.prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimitWindow" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitWindow"."resetAt" <= ${nowDate}
                       THEN 1 ELSE "RateLimitWindow"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimitWindow"."resetAt" <= ${nowDate}
                         THEN ${resetAt} ELSE "RateLimitWindow"."resetAt" END
      RETURNING "count", "resetAt"`;
    const row = rows[0];
    if (!row) throw new Error('Rate limit upsert returned no row');

    // Occasional cleanup of expired windows (about 1 in 100 hits).
    if (Math.random() < 0.01) {
      const cutoff = new Date(now - 24 * 3600 * 1000);
      await this.prisma
        .$executeRaw`DELETE FROM "RateLimitWindow" WHERE "resetAt" < ${cutoff}`
        .catch(() => undefined);
    }
    return { count: Number(row.count), resetAt: new Date(row.resetAt).getTime() };
  }
}
