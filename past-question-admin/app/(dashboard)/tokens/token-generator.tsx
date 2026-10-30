"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { generateTokensAction, type TokenGenerateState } from "@/app/actions/tokens";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/error-state";
import { Field, Input, Select } from "@/components/ui/input";

interface ProductOption {
  id: string;
  title: string;
}

/**
 * Access-token generator.
 *
 * SECURITY: the plaintext codes returned by the Server Action are displayed
 * exactly once, here, immediately after generation. They are never re-fetched
 * or persisted — the backend stores only hashes. We warn the admin explicitly
 * and offer a copy action so they can distribute the codes before navigating
 * away.
 */
export function TokenGenerator({
  products,
  productsError = false,
}: {
  products: ProductOption[];
  productsError?: boolean;
}) {
  const [state, formAction, pending] = useActionState<TokenGenerateState, FormData>(
    generateTokensAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  const codes = state.codes ?? [];
  const canGenerate = products.length > 0;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — the codes remain visible
      // for manual copying, so we fail silently.
    }
  };

  return (
    <div className="space-y-4">
      {productsError ? (
        <InlineError
          error={new Error("Couldn't load products to attach tokens to. Try refreshing.")}
        />
      ) : !canGenerate ? (
        <p className="text-sm text-muted-foreground">
          Create a product first — tokens are generated against a specific
          product.
        </p>
      ) : null}

      <form action={formAction} className="space-y-4">
        <Field
          label="Product"
          htmlFor="productId"
          required
          error={state.fieldErrors?.productId}
        >
          <Select id="productId" name="productId" defaultValue="" disabled={!canGenerate}>
            <option value="" disabled>
              Select a product…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Quantity"
            htmlFor="quantity"
            required
            error={state.fieldErrors?.quantity}
            hint="How many codes to generate (1–500)."
          >
            <Input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              defaultValue="1"
              disabled={!canGenerate}
            />
          </Field>
          <Field
            label="Expires at"
            htmlFor="expiresAt"
            hint="Optional expiry date."
          >
            <Input
              id="expiresAt"
              name="expiresAt"
              type="date"
              disabled={!canGenerate}
            />
          </Field>
        </div>



        {state.error ? <InlineError error={new Error(state.error)} /> : null}

        <Button
          type="submit"
          loading={pending}
          disabled={!canGenerate}
          leadingIcon={<KeyRound className="h-4 w-4" />}
        >
          Generate tokens
        </Button>
      </form>

      {codes.length > 0 ? (
        <div className="space-y-3 rounded-md border border-warning/50 bg-warning-bg/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {codes.length} {codes.length === 1 ? "code" : "codes"} generated
              </p>
              <p className="text-xs text-warning">
                Copy these now — for security they are shown only once and cannot
                be retrieved again.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyAll}
              leadingIcon={
                copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )
              }
            >
              {copied ? "Copied" : "Copy all"}
            </Button>
          </div>
          <ul className="space-y-1 font-mono text-sm">
            {codes.map((code, i) => (
              <li
                key={`${code}-${i}`}
                className="select-all rounded bg-card px-2 py-1 text-foreground"
              >
                {code}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
