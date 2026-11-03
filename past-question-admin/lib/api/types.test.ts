import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DOCUMENT_STATUSES,
  mapAuditEvent,
  mapDocument,
  mapDocumentStatus,
  mapLicense,
  mapProduct,
  mapProductStatus,
  mapPurchase,
  mapStudent,
  mapStudentDetail,
  pickCurrentDocument,
  toAdminUser,
  toBackendProductBody,
  toBackendProductStatus,
  type BackendDocument,
} from "./types.ts";

const doc = (over: Partial<BackendDocument>): BackendDocument => ({
  id: "d1",
  title: "CSC101.pdf",
  version: 1,
  sizeBytes: 1234,
  status: "READY",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  ...over,
});

test("backend admin user maps uppercase role/name to the admin UI model", () => {
  assert.deepEqual(toAdminUser({
    id: "u1", email: "admin@example.com", firstName: "Ada", lastName: "Admin",
    role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: null,
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  }), {
    id: "u1", email: "admin@example.com", name: "Ada Admin", role: "superadmin",
    status: "ACTIVE", emailVerifiedAt: null,
  });
});

test("a student account cannot be mapped to an admin session", () => {
  assert.throws(() => toAdminUser({
    id: "s1", email: "s@example.com", firstName: "S", lastName: "T", role: "STUDENT",
    status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01",
  }));
});

test("product status maps both ways across the three backend states", () => {
  assert.equal(mapProductStatus("DRAFT"), "draft");
  assert.equal(mapProductStatus("ACTIVE"), "published");
  assert.equal(mapProductStatus("ARCHIVED"), "archived");
  assert.equal(toBackendProductStatus("draft"), "DRAFT");
  assert.equal(toBackendProductStatus("published"), "ACTIVE");
  assert.equal(toBackendProductStatus("archived"), "ARCHIVED");
});

test("product mapping carries price in kobo and currency from the backend", () => {
  const product = mapProduct({
    id: "p1", title: "CSC101", description: null, price: 250000, currency: "NGN",
    course: "CSC101", institution: "UNILAG", level: "100", status: "ACTIVE",
    createdAt: "2026-01-01", updatedAt: "2026-01-02",
    documents: [doc({ id: "d1", status: "READY" })],
  });
  assert.equal(product.status, "published");
  assert.equal(product.courseCode, "CSC101");
  assert.equal(product.priceKobo, 250000);
  assert.equal(product.currency, "NGN");
  assert.equal(product.hasDocument, true);
  assert.equal(product.document?.fileName, "CSC101.pdf");
  assert.equal(product.document?.status, "ready");
});

test("a product without documents reports unknown document state, not 'none'", () => {
  const product = mapProduct({
    id: "p2", title: "x", price: 0, currency: "NGN", status: "DRAFT",
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  });
  assert.equal(product.hasDocument, null);
  assert.equal(product.document, null);
  assert.equal(product.documents, null);
  assert.equal(product.priceKobo, 0);
});

test("legacy zero-priced products are visible as zero so the UI can flag them", () => {
  const product = mapProduct({
    id: "p3", title: "old", price: 0, currency: "NGN", status: "ARCHIVED",
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
  });
  assert.equal(product.priceKobo, 0);
  assert.equal(product.status, "archived");
});

test("toBackendProductBody sends only backend DTO fields, with price as kobo", () => {
  const body = toBackendProductBody({
    title: "CSC101", description: null, course: "CSC101", institution: null, level: "100",
    status: "published", priceKobo: 250000, currency: "NGN",
  });
  assert.deepEqual(body, {
    title: "CSC101", description: null, course: "CSC101", institution: null, level: "100",
    status: "ACTIVE", price: 250000, currency: "NGN",
  });
  assert.equal("priceKobo" in body, false, "UI-only key must not reach the whitelist-validated backend");
});

test("toBackendProductBody on a partial update sends only the changed keys", () => {
  assert.deepEqual(toBackendProductBody({ status: "archived" }), { status: "ARCHIVED" });
  assert.deepEqual(toBackendProductBody({ priceKobo: 100 }), { price: 100 });
});

test("document lifecycle uses exactly the Prisma DocumentStatus values", () => {
  assert.deepEqual([...DOCUMENT_STATUSES], ["PROCESSING", "READY", "DISABLED", "DELETED", "FAILED"]);
  assert.equal(DOCUMENT_STATUSES.includes("ACTIVE" as never), false);
  assert.equal(mapDocumentStatus("PROCESSING"), "processing");
  assert.equal(mapDocumentStatus("FAILED"), "failed");
});

test("pickCurrentDocument chooses the newest version that is not a DELETED tombstone", () => {
  const current = pickCurrentDocument([
    doc({ id: "v1", version: 1, status: "DISABLED" }),
    doc({ id: "v3", version: 3, status: "DELETED" }),
    doc({ id: "v2", version: 2, status: "READY" }),
  ]);
  assert.equal(current?.id, "v2");
  assert.equal(pickCurrentDocument([doc({ status: "DELETED" })]), null);
  assert.equal(pickCurrentDocument(undefined), null);
});

test("product document history is newest first and keeps failure reasons", () => {
  const product = mapProduct({
    id: "p4", title: "x", price: 100, currency: "NGN", status: "ACTIVE",
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
    documents: [
      doc({ id: "a", version: 1, status: "DISABLED" }),
      doc({ id: "b", version: 2, status: "FAILED", failureReason: "Corrupt PDF" }),
    ],
  });
  assert.deepEqual(product.documents?.map((d) => d.id), ["b", "a"]);
  assert.equal(product.document?.id, "b");
  assert.equal(product.document?.failureReason, "Corrupt PDF");
  assert.equal(product.hasDocument, false, "no READY document means students cannot read the product");
});

test("document mapping never exposes the private storage key", () => {
  const mapped = mapDocument(doc({ status: "READY" }));
  assert.equal(mapped?.fileName, "CSC101.pdf");
  assert.equal(mapped?.status, "ready");
  assert.equal("storageKey" in (mapped ?? {}), false);
});

test("backend pending students remain distinguishable and unlisted counts stay null", () => {
  const student = mapStudent({
    id: "s1", email: "student@example.com", firstName: "Test", lastName: "Student",
    status: "PENDING", emailVerifiedAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-02",
  });
  assert.equal(student.status, "pending");
  assert.equal(student.lastActiveAt, null);
  assert.equal(student.purchaseCount, null);
});

test("student detail maps purchases, licenses and devices without inventing values", () => {
  const detail = mapStudentDetail({
    id: "s2", email: "s2@example.com", firstName: "Ola", lastName: "Ade", status: "ACTIVE",
    emailVerifiedAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-03",
    purchases: [{ id: "pu1", reference: "REF-1", status: "PAID", productId: "p1", createdAt: "2026-01-02" }],
    licenses: [{ id: "l1", status: "ACTIVE", productId: "p1", createdAt: "2026-01-02" }],
    devices: [{ id: "dv1", platform: "android", appVersion: null, status: "REVOKED", lastSeenAt: "2026-01-03" }],
  });
  assert.equal(detail.purchaseCount, 1);
  assert.equal(detail.purchases[0]?.status, "paid");
  assert.equal(detail.licenses[0]?.status, "active");
  assert.equal(detail.devices[0]?.status, "revoked");
  assert.equal(detail.devices[0]?.appVersion, null);
  assert.equal(detail.lastActiveAt, null);
});

test("purchase mapping exposes payment outcome and whether a device is bound", () => {
  const row = mapPurchase({
    id: "pu2", reference: "PUR-9", status: "PAID", amount: 250000, currency: "NGN",
    createdAt: "2026-01-02",
    user: { id: "u9", email: "x@example.com", firstName: "Chi", lastName: "Eze" },
    product: { id: "p9", title: "MTH101 2024" },
    payment: { reference: "PAY-9", status: "SUCCESS", amount: 250000, currency: "NGN" },
    license: { id: "l9", status: "ACTIVE", deviceId: "dev-1" },
  });
  assert.equal(row.status, "paid");
  assert.equal(row.amountKobo, 250000);
  assert.equal(row.studentName, "Chi Eze");
  assert.equal(row.paymentStatus, "success");
  assert.equal(row.licenseStatus, "active");
  assert.equal(row.deviceBound, true);
});

test("purchase mapping tolerates a missing payment or license", () => {
  const row = mapPurchase({ id: "pu3", reference: "PUR-10", status: "PENDING", amount: 100, currency: "NGN", createdAt: "2026-01-02" });
  assert.equal(row.paymentReference, null);
  assert.equal(row.licenseStatus, null);
  assert.equal(row.deviceBound, false);
  assert.equal(row.studentEmail, null);
});

test("license mapping keeps the device and purchase link", () => {
  const row = mapLicense({
    id: "l2", status: "SUSPENDED", deviceId: null, expiresAt: null, activatedAt: null,
    createdAt: "2026-01-02", user: { id: "u2", email: "a@example.com", firstName: "A", lastName: "B" },
    product: { id: "p2", title: "PHY" }, purchase: { reference: "PUR-2" },
  });
  assert.equal(row.status, "suspended");
  assert.equal(row.purchaseReference, "PUR-2");
  assert.equal(row.deviceId, null);
  assert.equal(row.expiresAt, null);
});

test("audit events serialise metadata and never invent an actor", () => {
  const event = mapAuditEvent({
    id: "a1", action: "ADMIN_ACTION", entityType: "Product", entityId: "p1", userId: null,
    ipAddress: null, metadata: { operation: "update" }, createdAt: "2026-01-02",
  });
  assert.equal(event.metadata, '{"operation":"update"}');
  assert.equal(event.actorId, null);
  const bare = mapAuditEvent({ id: "a2", action: "X", createdAt: "2026-01-02" });
  assert.equal(bare.metadata, null);
  assert.equal(bare.entityType, null);
});
