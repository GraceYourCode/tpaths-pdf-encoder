/** Types and adapters for the implemented NestJS backend API. */

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

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface BackendProduct {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  subject?: string | null;
  course?: string | null;
  level?: string | null;
  institution?: string | null;
  examType?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  coverImageKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendDocument {
  id: string;
  title: string;
  version: number;
  sizeBytes: number;
  checksumSha256?: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface ProductDocumentMeta {
  id: string;
  fileName: string;
  sizeBytes: number;
  pageCount?: number | null;
  uploadedAt: string;
  reference?: string | null;
  version: number;
  status: "draft" | "active" | "archived";
}

export interface Product {
  id: string;
  title: string;
  description?: string | null;
  courseCode?: string | null;
  institution?: string | null;
  level?: string | null;
  status: ProductStatus;
  hasDocument: boolean | null;
  document?: ProductDocumentMeta | null;
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
}

export function mapProductStatus(status: BackendProduct["status"]): ProductStatus {
  return status === "ACTIVE" ? "published" : status.toLowerCase() as ProductStatus;
}

export function mapDocument(document: BackendDocument | null | undefined): ProductDocumentMeta | null {
  if (!document) return null;
  return {
    id: document.id,
    fileName: document.title,
    sizeBytes: document.sizeBytes,
    uploadedAt: document.createdAt,
    version: document.version,
    status: document.status.toLowerCase() as ProductDocumentMeta["status"],
  };
}

export function mapProduct(
  product: BackendProduct & { documents?: BackendDocument[] },
): Product {
  const document = product.documents?.[0];
  return {
    id: product.id,
    title: product.title,
    description: product.description ?? null,
    courseCode: product.course ?? null,
    institution: product.institution ?? null,
    level: product.level ?? null,
    status: mapProductStatus(product.status),
    hasDocument: product.documents ? product.documents.length > 0 : null,
    document: mapDocument(document),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

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

export interface TokenGenerateInput {
  productId: string;
  quantity: number;
  studentEmail?: string | null;
  expiresAt?: string | null;
}

export interface TokenGenerateResult {
  tokens: AccessToken[];
  plaintextCodes: string[];
}

export interface Student {
  id: string;
  email: string;
  name?: string | null;
  status: StudentStatus;
  purchaseCount?: number | null;
  createdAt: string;
  lastActiveAt?: string | null;
}

export const STUDENT_STATUSES = ["active", "suspended", "pending"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface BackendStudent {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  purchases?: unknown[];
  licenses?: unknown[];
  devices?: unknown[];
}

export function mapStudent(student: BackendStudent): Student {
  return {
    id: student.id,
    email: student.email,
    name: [student.firstName, student.lastName].filter(Boolean).join(" ") || null,
    status: student.status === "SUSPENDED" ? "suspended" : student.status === "PENDING" ? "pending" : "active",
    purchaseCount: student.purchases?.length ?? null,
    createdAt: student.createdAt,
    lastActiveAt: null,
  };
}

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
