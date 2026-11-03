"use client";

import { useActionState } from "react";
import { Ban } from "lucide-react";
import type { SimpleActionState } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/error-state";

type RevokeAction = (
  state: SimpleActionState,
  formData: FormData,
) => Promise<SimpleActionState>;

/**
 * Revokes a single device after a confirm. Revocation stops the device from
 * opening purchased packs; the device record is kept for audit.
 */
export function RevokeDeviceButton({ action }: { action: RevokeAction }) {
  const [state, formAction, pending] = useActionState<SimpleActionState, FormData>(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Revoke this device? The student will need to re-register it.")) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <Button type="submit" variant="outline" size="sm" loading={pending} leadingIcon={<Ban className="h-4 w-4" />}>
        Revoke
      </Button>
      {state.error ? <InlineError error={new Error(state.error)} className="py-1" /> : null}
    </form>
  );
}
