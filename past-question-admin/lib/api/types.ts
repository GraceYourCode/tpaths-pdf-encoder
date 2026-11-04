/**
 * Types and adapters for the implemented NestJS backend API.
 *
 * Backend enums (uppercase, from prisma/schema.prisma) are translated here into
 * the lowercase values the UI renders. Nothing in this file invents data: a
 * field the backend does not return is `null`/absent, never a placeholder.
 *
 * Pure module (no React/Next imports) so it runs under `node --test`.
 */

// ---------------------------------------------------------------------------
// Users / admin session
// ---------------------------------------------------------------------------

export type AdminRole = "admin" | "superadmin";
export type BackendRole = "ADMIN" | "SUPER_ADMIN" | "STUDENT";

export interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  role: AdminRole;
  status?: "ACTIVE" | "SUSPENDED" | "PENDING";
  emailVerifiedAt?: string | null;
}

export interface BackendUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: BackendRole;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendUserRef {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export function toAdminUser(user: BackendUser): AdminUser {
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    throw new Error("Authenticated account is not an administrator.");
  }
  return {
    id: user.id,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    role: user.role === "SUPER_ADMIN" ? "superadmin" : "admin",
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
  };
}

function nameOf(user: BackendUserRef | null | undefined): string | null {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
}

// ---------------------------------------------------------------------------
// Products and documents
// ---------------------------------------------------------------------------

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type BackendProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface BackendProduct {
  id: string;
  title: string;
  description?: string | null;
  /** Integer minor units (kobo for NGN). */
  price: number;
  currency: string;
  category?: string | null;
  subject?: string | null;
  course?: string | null;
  level?: string | null;
  institution?: string | null;
  examType?: string | null;
  status: BackendProductStatus;
  coverImageKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Document lifecycle exactly as the Prisma `DocumentStatus` enum defines it. */
export const DOCUMENT_STATUSES = [
  "PROCESSING",
  "READY",
  "DISABLED",
  "DELETED",
  "FAILED",
] as const;
export type BackendDocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type DocumentStatus = Lowercase<BackendDocumentStatus>;

export interface BackendDocument {
  id: string;
  productId?: string;
  title: string;
  version: number;
  sizeBytes: number;
  checksumSha256?: string;
  status: BackendDocumentStatus;
  failureReason?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDocumentMeta {
  id: string;
  fileName: string;
  sizeBytes: number;
  version: number;
  status: DocumentStatus;
  failureReason: string | null;
  uploadedAt: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string | null;
  courseCode?: string | null;
  institution?: string | null;
  level?: string | null;
  status: ProductStatus;
  /** Price in minor units. `0` means the product predates pricing and must be priced before publishing. */
  priceKobo: number;
  currency: string;
  /** `null` when the endpoint did not include documents (e.g. list views). */
  hasDocument: boolean | null;
  /** Newest non-deleted document, or null. */
  document: ProductDocumentMeta | null;
  /** Every stored version, newest first, or null when documents were not loaded. */
  documents: ProductDocumentMeta[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  title: string;
  description?: string | null;
  course?: string | null;
  institution?: string | null;
  level?: string | null;
  status: ProductStatus;
  priceKobo: number;
  currency: string;
}

export function mapProductStatus(status: BackendProductStatus): ProductStatus {
  switch (status) {
    case "ACTIVE":
      return "published";
    case "ARCHIVED":
      return "archived";
    default:
      return "draft";
  }
}

export function toBackendProductStatus(status: ProductStatus): BackendProductStatus {
  switch (status) {
    case "published":
      return "ACTIVE";
    case "archived":
      return "ARCHIVED";
    default:
      return "DRAFT";
  }
}

/**
 * Translate the UI product model into the exact body the backend DTO accepts.
 * The backend validates with `whitelist` + `forbidNonWhitelisted`, so every key
 * is mapped explicitly rather than spreading the UI object (`priceKobo` would
 * otherwise be rejected as an unknown field).
 */
export function toBackendProductBody(input: Partial<ProductInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.description !== undefined) body.description = input.description;
  if (input.course !== undefined) body.course = input.course;
  if (input.institution !== undefined) body.institution = input.institution;
  if (input.level !== undefined) body.level = input.level;
  if (input.status !== undefined) body.status = toBackendProductStatus(input.status);
  if (input.priceKobo !== undefined) body.price = input.priceKobo;
  if (input.currency !== undefined) body.currency = input.currency;
  return body;
}

export function mapDocumentStatus(status: BackendDocumentStatus): DocumentStatus {
  return status.toLowerCase() as DocumentStatus;
}

export function mapDocument(document: BackendDocument | null | undefined): ProductDocumentMeta | null {
  if (!document) return null;
  return {
    id: document.id,
    fileName: document.title,
    sizeBytes: document.sizeBytes,
    version: document.version,
    status: mapDocumentStatus(document.status),
    failureReason: document.failureReason ?? null,
    uploadedAt: document.createdAt,
  };
}

/**
 * The document an operator is working with: the highest version that has not
 * been tombstoned as DELETED. Older versions stay in the backend history.
 */
export function pickCurrentDocument(documents: BackendDocument[] | undefined): BackendDocument | null {
  const live = (documents ?? []).filter((d) => d.status !== "DELETED");
  if (live.length === 0) return null;
  return live.reduce((best, d) => (d.version > best.version ? d : best));
}

export function mapProduct(
  product: BackendProduct & { documents?: BackendDocument[] },
): Product {
  const documents = product.documents;
  return {
    id: product.id,
    title: product.title,
    description: product.description ?? null,
    courseCode: product.course ?? null,
    institution: product.institution ?? null,
    level: product.level ?? null,
    status: mapProductStatus(product.status),
    priceKobo: Number(product.price ?? 0),
    currency: product.currency ?? "NGN",
    hasDocument: documents ? documents.some((d) => d.status === "READY") : null,
    document: mapDocument(pickCurrentDocument(documents)),
    documents: documents
      ? [...documents]
          .sort((a, b) => b.version - a.version)
          .map((d) => mapDocument(d) as ProductDocumentMeta)
      : null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Access tokens
// ---------------------------------------------------------------------------

export interface BackendToken {
  id: string;
  productId: string;
  purchaseId?: string | null;
  status: "UNUSED" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";
  expiresAt?: string | null;
  activatedAt?: string | null;
  createdAt: string;
}

export const TOKEN_STATUSES = ["active", "suspended", "revoked", "expired"] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

export interface AccessToken {
  id: string;
  maskedCode: string;
  productId?: string | null;
  productTitle?: string | null;
  purchaseId?: string | null;
  studentId?: string | null;
  studentEmail?: string | null;
  status: TokenStatus;
  createdAt: string;
  expiresAt?: string | null;
  redeemedAt?: string | null;
}

export interface TokenGenerateResult {
  tokens: AccessToken[];
  plaintextCodes: string[];
}

// ---------------------------------------------------------------------------
// Students, devices, licenses, purchases, payments, audit
// ---------------------------------------------------------------------------

export const STUDENT_STATUSES = ["active", "suspended", "pending"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface Student {
  id: string;
  email: string;
  name?: string | null;
  status: StudentStatus;
  /** `null` when the list endpoint does not include purchases. */
  purchaseCount?: number | null;
  createdAt: string;
  /** The backend does not provide activity timestamps; always null. */
  lastActiveAt?: string | null;
}

export interface BackendStudent {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  purchases?: BackendStudentPurchase[];
  licenses?: BackendStudentLicense[];
  devices?: BackendDevice[];
}

export type PurchaseStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
export type LicenseStatus = "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";
export type DeviceStatus = "ACTIVE" | "REVOKED";

export interface BackendStudentPurchase {
  id: string;
  reference: string;
  status: PurchaseStatus;
  productId: string;
  createdAt: string;
}

export interface BackendStudentLicense {
  id: string;
  status: LicenseStatus;
  productId: string;
  createdAt: string;
}

export interface BackendDevice {
  id: string;
  platform: string;
  appVersion?: string | null;
  status: DeviceStatus;
  lastSeenAt: string;
  createdAt?: string;
}

export interface StudentDevice {
  id: string;
  platform: string;
  appVersion: string | null;
  status: "active" | "revoked";
  lastSeenAt: string;
}

export interface StudentPurchase {
  id: string;
  reference: string;
  status: string;
  productId: string;
  createdAt: string;
}

export interface StudentLicense {
  id: string;
  status: string;
  productId: string;
  createdAt: string;
}

export interface StudentDetail extends Student {
  emailVerifiedAt: string | null;
  updatedAt: string;
  purchases: StudentPurchase[];
  licenses: StudentLicense[];
  devices: StudentDevice[];
}

export interface BackendPurchase {
  id: string;
  reference: string;
  status: PurchaseStatus;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  user?: BackendUserRef | null;
  product?: { id: string; title: string } | null;
  payment?: { reference: string; status: PaymentStatus; amount: number; currency: string } | null;
  license?: { id: string; status: LicenseStatus; deviceId?: string | null } | null;
}

export interface PurchaseRecord {
  id: string;
  reference: string;
  status: string;
  /** Minor units. */
  amountKobo: number;
  currency: string;
  createdAt: string;
  studentId: string | null;
  studentEmail: string | null;
  studentName: string | null;
  productId: string | null;
  productTitle: string | null;
  paymentReference: string | null;
  paymentStatus: string | null;
  licenseStatus: string | null;
  deviceBound: boolean;
}

export function mapPurchase(p: BackendPurchase): PurchaseRecord {
  return {
    id: p.id,
    reference: p.reference,
    status: p.status.toLowerCase(),
    amountKobo: Number(p.amount),
    currency: p.currency,
    createdAt: p.createdAt,
    studentId: p.user?.id ?? null,
    studentEmail: p.user?.email ?? null,
    studentName: nameOf(p.user),
    productId: p.product?.id ?? null,
    productTitle: p.product?.title ?? null,
    paymentReference: p.payment?.reference ?? null,
    paymentStatus: p.payment?.status.toLowerCase() ?? null,
    licenseStatus: p.license?.status.toLowerCase() ?? null,
    deviceBound: Boolean(p.license?.deviceId),
  };
}

export interface BackendLicense {
  id: string;
  status: LicenseStatus;
  deviceId?: string | null;
  expiresAt?: string | null;
  activatedAt?: string | null;
  lastValidatedAt?: string | null;
  createdAt: string;
  user?: BackendUserRef | null;
  product?: { id: string; title: string } | null;
  purchase?: { reference: string } | null;
}

export interface LicenseRecord {
  id: string;
  status: string;
  studentId: string | null;
  studentEmail: string | null;
  studentName: string | null;
  productId: string | null;
  productTitle: string | null;
  purchaseReference: string | null;
  deviceId: string | null;
  expiresAt: string | null;
  activatedAt: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
}

export function mapLicense(l: BackendLicense): LicenseRecord {
  return {
    id: l.id,
    status: l.status.toLowerCase(),
    studentId: l.user?.id ?? null,
    studentEmail: l.user?.email ?? null,
    studentName: nameOf(l.user),
    productId: l.product?.id ?? null,
    productTitle: l.product?.title ?? null,
    purchaseReference: l.purchase?.reference ?? null,
    deviceId: l.deviceId ?? null,
    expiresAt: l.expiresAt ?? null,
    activatedAt: l.activatedAt ?? null,
    lastValidatedAt: l.lastValidatedAt ?? null,
    createdAt: l.createdAt,
  };
}

export interface BackendAuditLog {
  id: string;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  ipAddress: string | null;
  /** Compact JSON for display. The backend never writes secrets here. */
  metadata: string | null;
  createdAt: string;
}

export function mapAuditEvent(e: BackendAuditLog): AuditEvent {
  let metadata: string | null = null;
  if (e.metadata !== undefined && e.metadata !== null) {
    try {
      metadata = JSON.stringify(e.metadata);
    } catch {
      metadata = null;
    }
  }
  return {
    id: e.id,
    action: e.action,
    entityType: e.entityType ?? null,
    entityId: e.entityId ?? null,
    actorId: e.userId ?? null,
    ipAddress: e.ipAddress ?? null,
    metadata,
    createdAt: e.createdAt,
  };
}

export function mapStudent(student: BackendStudent): Student {
  return {
    id: student.id,
    email: student.email,
    name: nameOf(student) ?? null,
    status: student.status === "SUSPENDED" ? "suspended" : student.status === "PENDING" ? "pending" : "active",
    purchaseCount: student.purchases ? student.purchases.length : null,
    createdAt: student.createdAt,
    lastActiveAt: null,
  };
}

export function mapStudentDetail(student: BackendStudent): StudentDetail {
  return {
    ...mapStudent(student),
    emailVerifiedAt: student.emailVerifiedAt ?? null,
    updatedAt: student.updatedAt,
    purchases: (student.purchases ?? []).map((p) => ({
      id: p.id,
      reference: p.reference,
      status: p.status.toLowerCase(),
      productId: p.productId,
      createdAt: p.createdAt,
    })),
    licenses: (student.licenses ?? []).map((l) => ({
      id: l.id,
      status: l.status.toLowerCase(),
      productId: l.productId,
      createdAt: l.createdAt,
    })),
    devices: (student.devices ?? []).map((d) => ({
      id: d.id,
      platform: d.platform,
      appVersion: d.appVersion ?? null,
      status: d.status === "REVOKED" ? "revoked" : "active",
      lastSeenAt: d.lastSeenAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Dashboard and pagination
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalStudents: number;
  activeStudents: number;
  totalLicenses: number;
  activeLicenses: number;
  totalTokens: number;
  activeTokens: number;
  paidPurchases: number;
  recentActivity: AuditEvent[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  productId?: string;
}
