import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_TITLE_LENGTH, readProductForm } from "./form.ts";

function formOf(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  title: "  CSC101 Past Questions 2024 ",
  description: "",
  course: "CSC101",
  institution: "UNILAG",
  level: "100",
  status: "published",
  price: "2,500",
};

test("a complete form produces a backend-ready input with kobo price and NGN currency", () => {
  const parsed = readProductForm(formOf(valid));
  assert.deepEqual(parsed.fieldErrors, {});
  assert.deepEqual(parsed.input, {
    title: "CSC101 Past Questions 2024",
    description: null,
    course: "CSC101",
    institution: "UNILAG",
    level: "100",
    status: "published",
    priceKobo: 250000,
    currency: "NGN",
  });
});

test("price is required: a product cannot be created or saved without one", () => {
  const parsed = readProductForm(formOf({ ...valid, price: "" }));
  assert.equal(parsed.input, undefined);
  assert.ok(parsed.fieldErrors.price);
});

test("zero and malformed prices are rejected with a field error", () => {
  assert.ok(readProductForm(formOf({ ...valid, price: "0" })).fieldErrors.price);
  assert.ok(readProductForm(formOf({ ...valid, price: "free" })).fieldErrors.price);
});

test("title and status are validated alongside price", () => {
  const parsed = readProductForm(formOf({ ...valid, title: "   ", status: "sold" }));
  assert.equal(parsed.input, undefined);
  assert.ok(parsed.fieldErrors.title);
  assert.ok(parsed.fieldErrors.status);
  assert.equal(parsed.fieldErrors.price, undefined);
});

test("an over-long title is rejected", () => {
  const parsed = readProductForm(formOf({ ...valid, title: "x".repeat(MAX_TITLE_LENGTH + 1) }));
  assert.ok(parsed.fieldErrors.title?.includes(String(MAX_TITLE_LENGTH)));
});

test("submitted values are echoed back so a failed submit keeps what the operator typed", () => {
  const parsed = readProductForm(formOf({ ...valid, price: "abc" }));
  assert.equal(parsed.values.price, "abc");
  assert.equal(parsed.values.courseCode, "CSC101");
});

test("only the three allowed statuses are accepted", () => {
  for (const status of ["draft", "published", "archived"]) {
    assert.equal(readProductForm(formOf({ ...valid, status })).input?.status, status);
  }
  assert.equal(readProductForm(formOf({ ...valid, status: "ACTIVE" })).fieldErrors.status !== undefined, true);
});
