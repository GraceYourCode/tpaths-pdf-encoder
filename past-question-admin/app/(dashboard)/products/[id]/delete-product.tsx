"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import type { SimpleActionState } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/error-state";

type DeleteAction = (
  state: SimpleActionState,
  formData: FormData,
) => Promise<SimpleActionState>;

/**
 * Product archival, guarded by a browser confirm. On success the
 * Server Action redirects to `/products`; on failure it returns an honest error.
 */
export function DeleteProduct({
  action,
  productTitle,
}: {
  action: DeleteAction;
  productTitle: string;
}) {
  const [state, formAction, pending] = useActionState<SimpleActionState, FormData>(
    action,
    {},
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Archive “${productTitle}”? This will remove the product from active listings.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="space-y-3"
    >
      {state.error ? <InlineError error={new Error(state.error)} /> : null}
      <Button
        type="submit"
        variant="danger"
        loading={pending}
        leadingIcon={<Trash2 className="h-4 w-4" />}
      >
        Archive product
      </Button>
    </form>
  );
}
