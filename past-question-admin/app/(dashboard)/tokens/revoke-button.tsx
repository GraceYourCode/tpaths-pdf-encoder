"use client";

import { useActionState } from "react";
import { Ban } from "lucide-react";
import type { SimpleActionState } from "@/app/actions/tokens";
import { Button } from "@/components/ui/button";

type RevokeAction = (
  state: SimpleActionState,
  formData: FormData,
) => Promise<SimpleActionState>;

/** Revokes a single access token (guarded by a confirm). */
export function RevokeButton({ action }: { action: RevokeAction }) {
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
            "Revoke this token? It can no longer be redeemed by a student.",
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex items-center gap-2"
    >
      <Button
        type="submit"
        variant="outline"
        size="sm"
        loading={pending}
        leadingIcon={<Ban className="h-4 w-4" />}
      >
        Revoke
      </Button>
      {state.error ? (
        <span className="text-xs text-danger">{state.error}</span>
      ) : null}
    </form>
  );
}
