"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ProductFormState } from "@/app/actions/products";
import { buttonClasses, Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/error-state";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PRODUCT_STATUSES, type Product } from "@/lib/api/types";

type ProductFormAction = (
  state: ProductFormState,
  formData: FormData,
) => Promise<ProductFormState>;

/**
 * Shared create/edit product form. The same fields drive both flows; the parent
 * passes the appropriate Server Action (`createProductAction` or
 * `updateProductAction` bound to an id).
 *
 * Inputs are uncontrolled with `defaultValue` seeds. On a failed submit the
 * Server Action returns without redirecting, so the browser preserves what the
 * user typed and we simply layer field-level errors on top.
 */
export function ProductForm({
  action,
  product,
  submitLabel = "Save product",
  cancelHref = "/products",
}: {
  action: ProductFormAction;
  product?: Product;
  submitLabel?: string;
  cancelHref?: string;
}) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    action,
    {},
  );


  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <InlineError error={new Error(state.error)} /> : null}
      {state.ok ? (
        <p
          role="status"
          className="rounded-md border border-success/40 bg-success-bg/50 px-3 py-2 text-sm text-success"
        >
          Changes saved.
        </p>
      ) : null}

      <Field label="Title" htmlFor="title" required error={state.fieldErrors?.title}>
        <Input
          id="title"
          name="title"
          defaultValue={product?.title ?? ""}
          required
          maxLength={200}
          aria-invalid={Boolean(state.fieldErrors?.title) || undefined}
        />
      </Field>

      <Field label="Description" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          defaultValue={product?.description ?? ""}
          rows={4}
          placeholder="What this past-question pack covers…"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Course code" htmlFor="course">
          <Input
            id="course"
            name="course"
            defaultValue={product?.courseCode ?? ""}
            placeholder="e.g. CSC101"
          />
        </Field>
        <Field label="Institution" htmlFor="institution">
          <Input
            id="institution"
            name="institution"
            defaultValue={product?.institution ?? ""}
            placeholder="e.g. University of Lagos"
          />
        </Field>
        <Field label="Level" htmlFor="level">
          <Input
            id="level"
            name="level"
            defaultValue={product?.level ?? ""}
            placeholder="e.g. 100"
          />
        </Field>
        <Field
          label="Status"
          htmlFor="status"
          required
          error={state.fieldErrors?.status}
        >
          <Select
            id="status"
            name="status"
            defaultValue={product?.status ?? "draft"}
          >
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        <Link
          href={cancelHref}
          className={buttonClasses({ variant: "ghost" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
