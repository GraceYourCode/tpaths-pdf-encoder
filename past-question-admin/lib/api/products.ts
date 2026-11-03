import type { BackendDocument, BackendProduct, ListQuery, Paginated, Product, ProductInput, ProductStatus } from "./types";
import { mapProduct, PRODUCT_STATUSES, toBackendProductBody, toBackendProductStatus } from "./types";
import { backendRequest } from "./server";

interface BackendPage<T> { items: T[]; total: number; page: number; limit: number; totalPages: number; }

export async function listProducts(query: ListQuery = {}): Promise<Paginated<Product>> {
  const data = await backendRequest<BackendPage<BackendProduct>>({
    path: "/admin/products",
    method: "GET",
    query: {
      page: query.page,
      limit: query.pageSize,
      search: query.search,
      status: query.status && (PRODUCT_STATUSES as readonly string[]).includes(query.status)
        ? toBackendProductStatus(query.status as ProductStatus)
        : undefined,
    },
  });
  return {
    items: data.items.map((p) => mapProduct(p)),
    total: data.total,
    page: data.page,
    pageSize: data.limit,
    totalPages: data.totalPages,
  };
}

export async function getProduct(id: string): Promise<Product> {
  const data = await backendRequest<BackendProduct & { documents?: BackendDocument[] }>({
    path: `/admin/products/${encodeURIComponent(id)}`,
    method: "GET",
  });
  return mapProduct(data);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const data = await backendRequest<BackendProduct>({
    path: "/admin/products",
    method: "POST",
    body: toBackendProductBody(input),
  });
  return mapProduct(data);
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const data = await backendRequest<BackendProduct>({
    path: `/admin/products/${encodeURIComponent(id)}`,
    method: "PATCH",
    body: toBackendProductBody(input),
  });
  return mapProduct(data);
}

/** Archives the product (the backend's DELETE is a soft archive, never a hard delete). */
export async function archiveProduct(id: string): Promise<void> {
  await backendRequest<unknown>({ path: `/admin/products/${encodeURIComponent(id)}`, method: "DELETE" });
}

export async function uploadProductDocument(id: string, formData: FormData): Promise<BackendDocument> {
  return backendRequest<BackendDocument>({
    path: `/admin/products/${encodeURIComponent(id)}/documents`,
    method: "POST",
    formData,
  });
}

/**
 * Soft-removes a document. The backend marks it DISABLED (students lose access)
 * and removes the stored object on a best-effort basis.
 */
export async function removeProductDocument(documentId: string): Promise<void> {
  await backendRequest<unknown>({ path: `/admin/documents/${encodeURIComponent(documentId)}`, method: "DELETE" });
}

/**
 * Moves an existing document to DISABLED (used when a newer version replaces it).
 * The backend's `DocumentDto` currently requires `title` on PATCH as well, so the
 * current title is sent alongside the status.
 */
export async function disableProductDocument(documentId: string, title: string): Promise<void> {
  await backendRequest<unknown>({
    path: `/admin/documents/${encodeURIComponent(documentId)}`,
    method: "PATCH",
    body: { title, status: "DISABLED" },
  });
}
