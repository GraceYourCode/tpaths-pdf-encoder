import type { BackendProduct, ListQuery, Paginated, Product, ProductDocumentMeta, ProductInput } from "./types";
import { mapProduct } from "./types";
import { backendRequest } from "./server";

interface BackendPage { items: BackendProduct[]; total: number; page: number; limit: number; totalPages: number; }

export async function listProducts(query: ListQuery = {}): Promise<Paginated<Product>> {
  const data = await backendRequest<BackendPage>({
    path: "/admin/products", method: "GET",
    query: { page: query.page, limit: query.pageSize, search: query.search, status: query.status ? query.status.toUpperCase().replace("PUBLISHED", "ACTIVE") : undefined },
  });
  return { items: data.items.map(mapProduct), total: data.total, page: data.page, pageSize: data.limit, totalPages: data.totalPages };
}

export async function getProduct(id: string): Promise<Product> {
  const data = await backendRequest<BackendProduct & { documents?: import("./types").BackendDocument[] }>({ path: `/admin/products/${encodeURIComponent(id)}`, method: "GET" });
  return mapProduct(data);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const data = await backendRequest<BackendProduct>({ path: "/admin/products", method: "POST", body: { ...input, status: input.status.toUpperCase().replace("PUBLISHED", "ACTIVE") } });
  return mapProduct(data);
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const body = { ...input, ...(input.status ? { status: input.status.toUpperCase().replace("PUBLISHED", "ACTIVE") } : {}) };
  const data = await backendRequest<BackendProduct>({ path: `/admin/products/${encodeURIComponent(id)}`, method: "PATCH", body });
  return mapProduct(data);
}

export async function deleteProduct(id: string): Promise<void> {
  await backendRequest<unknown>({ path: `/admin/products/${encodeURIComponent(id)}`, method: "DELETE" });
}

export async function uploadProductDocument(id: string, formData: FormData): Promise<ProductDocumentMeta> {
  const data = await backendRequest<import("./types").BackendDocument>({ path: `/admin/products/${encodeURIComponent(id)}/documents`, method: "POST", formData });
  return { id: data.id, fileName: data.title, sizeBytes: data.sizeBytes, uploadedAt: data.createdAt, version: data.version, status: data.status.toLowerCase() as ProductDocumentMeta["status"] };
}

export async function deleteProductDocument(documentId: string): Promise<void> {
  await backendRequest<unknown>({ path: `/admin/documents/${encodeURIComponent(documentId)}`, method: "DELETE" });
}
