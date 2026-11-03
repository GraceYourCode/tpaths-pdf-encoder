/**
 * Expiry inspection for backend-issued JWTs.
 *
 * SECURITY: this reads the `exp` claim ONLY to decide whether a refresh should
 * be attempted. It never trusts decoded claims for authorization; the backend
 * verifies every request and `requireSession()` checks `/auth/me`.
 *
 * Pure module: runs under `node --test`.
 */

/** Seconds since epoch from the `exp` claim, or null when absent/unreadable. */
export function tokenExpirySeconds(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * True only when the token carries an `exp` that has already passed. A token we
 * cannot read is NOT treated as expired here; the backend then answers 401 and
 * the session is cleared by `requireSession()`.
 */
export function accessTokenNeedsRefresh(
  token: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const exp = tokenExpirySeconds(token);
  return exp !== null && exp <= nowSeconds;
}
