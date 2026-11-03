/**
 * Naira <-> kobo helpers.
 *
 * The backend stores every amount as an integer in the currency's minor unit
 * (kobo for NGN). The admin form takes naira as the operator types it, so the
 * conversion lives here in one pure, unit-tested place.
 *
 * Pure module: no React/Next imports, so it can run under `node --test`.
 */

/** Upper bound of a Prisma `Int` column (32-bit signed). */
export const MAX_KOBO = 2_147_483_647;

export type NairaParseResult =
  | { ok: true; kobo: number }
  | { ok: false; error: string };

/**
 * Parse an operator-entered naira amount ("2500", "2,500.50", "₦ 10.5") into
 * integer kobo. Rejects zero/negative values, more than two decimals and
 * anything the backend column cannot store.
 */
export function parseNairaToKobo(raw: string): NairaParseResult {
  const cleaned = raw.trim().replace(/[₦,\s]/g, "");
  if (!cleaned) {
    return { ok: false, error: "Enter a price in naira, for example 2500." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return {
      ok: false,
      error: "Enter an amount such as 2500 or 2500.50 (at most two decimals).",
    };
  }
  const [whole, fraction = ""] = cleaned.split(".");
  const kobo = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(kobo) || kobo > MAX_KOBO) {
    return { ok: false, error: "That price is too large to store." };
  }
  if (kobo < 1) {
    return { ok: false, error: "Price must be greater than zero." };
  }
  return { ok: true, kobo };
}

/**
 * Render kobo as an editable naira string ("2500.00"). Zero or missing values
 * (products created before pricing existed) render as an empty string so the
 * operator must enter a real price rather than saving a placeholder.
 */
export function koboToNairaInput(kobo: number | null | undefined): string {
  if (!kobo || !Number.isInteger(kobo) || kobo <= 0) return "";
  const major = Math.trunc(kobo / 100);
  const minor = String(kobo % 100).padStart(2, "0");
  return `${major}.${minor}`;
}
