/**
 * Pure, dependency-free formatting helpers.
 *
 * These are intentionally free of React/Next imports so they can be unit-tested
 * in isolation (see `format.test.ts`) and used from both Server and Client
 * Components.
 */

/** Coerce a Date | ISO string | epoch-ms into a valid Date, or null. */
function toDate(input: Date | string | number | null | undefined): Date | null {
  if (input === null || input === undefined) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 Jan 2026" */
export function formatDate(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "12 Jan 2026, 14:03" */
export function formatDateTime(
  input: Date | string | number | null | undefined,
): string {
  const d = toDate(input);
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Human relative time: "just now", "5 min ago", "3 h ago", "2 d ago", else a date.
 * `now` is injectable for deterministic tests.
 */
export function formatRelativeTime(
  input: Date | string | number | null | undefined,
  now: Date | number = new Date(),
): string {
  const d = toDate(input);
  if (!d) return "—";
  const nowMs = now instanceof Date ? now.getTime() : now;
  const diffSec = Math.round((nowMs - d.getTime()) / 1000);
  if (diffSec < 0) return formatDate(d);
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} d ago`;
  return formatDate(d);
}

/**
 * Format a Naira amount. Backends commonly store money as integer minor units
 * (kobo). Pass `{ fromKobo: true }` when the value is in kobo.
 */
export function formatNaira(
  amount: number | null | undefined,
  opts: { fromKobo?: boolean } = {},
): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "—";
  }
  const major = opts.fromKobo ? Number(amount) / 100 : Number(amount);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/** "1.4 MB", "820 KB", "512 B" */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(Number(bytes))) {
    return "—";
  }
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = b / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Truncate with an ellipsis, never cutting mid-surrogate weirdly for ASCII use. */
export function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Up to two uppercase initials from a name/email. */
export function initialsFromName(name: string | null | undefined): string {
  if (!name) return "?";
  const cleaned = name.includes("@") ? name.split("@")[0] : name;
  const parts = cleaned.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}
