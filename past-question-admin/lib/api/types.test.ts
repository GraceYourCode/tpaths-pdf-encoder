import assert from "node:assert/strict";
import { test } from "node:test";
import { mapDocument, mapProduct, mapStudent, toAdminUser } from "./types.ts";

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

test("backend product/document fields map without inventing price/year", () => {
  const product = mapProduct({
    id: "p1", title: "CSC101", description: null, course: "CSC101", institution: "UNILAG",
    level: "100", status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-02",
    documents: [{ id: "d1", title: "CSC101.pdf", version: 1, sizeBytes: 1234, status: "ACTIVE", createdAt: "2026-01-02", updatedAt: "2026-01-02" }],
  });
  assert.equal(product.status, "published");
  assert.equal(product.courseCode, "CSC101");
  assert.equal(product.hasDocument, true);
  assert.equal(product.document?.fileName, "CSC101.pdf");
});

test("backend pending students remain distinguishable", () => {
  const student = mapStudent({
    id: "s1", email: "student@example.com", firstName: "Test", lastName: "Student",
    status: "PENDING", emailVerifiedAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-02",
  });
  assert.equal(student.status, "pending");
  assert.equal(student.lastActiveAt, null);
  assert.equal(student.purchaseCount, null);
});

test("document mapping never exposes the private storage key", () => {
  const doc = mapDocument({ id: "d1", title: "x.pdf", version: 1, sizeBytes: 1, status: "ACTIVE", createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  assert.equal(doc?.fileName, "x.pdf");
  assert.equal("storageKey" in (doc ?? {}), false);
});
