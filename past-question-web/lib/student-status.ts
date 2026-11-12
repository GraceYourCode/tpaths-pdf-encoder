/**
 * Display rules for backend purchase, payment and licence records. The backend
 * returns raw enum values; this module decides what a student is allowed to
 * believe about them. Expiry is checked against the clock because the backend
 * does not always flip a licence to EXPIRED before the date passes.
 */

export type Tone = "success" | "warning" | "danger" | "neutral";

export type LicenseLike = {
  status: string;
  expiresAt: string | null;
  deviceId?: string | null;
  product: { status: string };
};

export type LicenseView = {
  label: string;
  tone: Tone;
  /** True only when the student can use the material now. */
  usable: boolean;
};

export function describeLicense(license: LicenseLike, now: Date = new Date()): LicenseView {
  if (license.status === "REVOKED") return { label: "Revoked", tone: "danger", usable: false };
  if (license.status === "SUSPENDED") return { label: "Suspended", tone: "warning", usable: false };

  const past = license.expiresAt !== null && Date.parse(license.expiresAt) <= now.getTime();
  if (license.status === "EXPIRED" || past) return { label: "Expired", tone: "neutral", usable: false };

  if (license.status !== "ACTIVE") return { label: "Inactive", tone: "neutral", usable: false };
  if (license.product.status !== "ACTIVE")
    return { label: "Product unavailable", tone: "warning", usable: false };

  return { label: "Active", tone: "success", usable: true };
}

export function activationLabel(license: LicenseLike): string {
  return license.deviceId ? "Bound to a device" : "Not yet activated on a device";
}

const PURCHASE_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SUCCESS: "Successful",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export function purchaseStatusLabel(status: string): string {
  return PURCHASE_LABELS[status] ?? status;
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_LABELS[status] ?? status;
}

export function purchaseTone(status: string): Tone {
  if (status === "PAID") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  return "neutral";
}
