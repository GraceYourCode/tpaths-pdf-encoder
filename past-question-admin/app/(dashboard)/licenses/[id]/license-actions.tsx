"use client";

import { useActionState } from "react";
import { Ban, PauseCircle } from "lucide-react";
import type { LicenseActionState } from "@/app/actions/licenses";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/error-state";

type LicenseAction = (state: LicenseActionState, formData: FormData) => Promise<LicenseActionState>;

/**
 * Suspend (reversible on the backend) and revoke (terminal) for one license.
 * Both are confirmed before the Server Action runs.
 */
export function LicenseActions({
  suspendAction,
  revokeAction,
  canSuspend,
  canRevoke,
}: {
  suspendAction: LicenseAction;
  revokeAction: LicenseAction;
  canSuspend: boolean;
  canRevoke: boolean;
}) {
  const [suspendState, suspendForm, suspending] = useActionState<LicenseActionState, FormData>(suspendAction, {});
  const [revokeState, revokeForm, revoking] = useActionState<LicenseActionState, FormData>(revokeAction, {});
  const error = suspendState.error || revokeState.error;
  const message = suspendState.message || revokeState.message;

  return (
    <div className="space-y-3">
      {error ? <InlineError error={new Error(error)} /> : null}
      {message && !error ? (
        <p role="status" className="text-sm text-success">{message}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canSuspend ? (
          <form
            action={suspendForm}
            onSubmit={(e) => {
              if (!window.confirm("Suspend this license? The student loses access until it is reinstated.")) e.preventDefault();
            }}
          >
            <Button type="submit" variant="outline" loading={suspending} leadingIcon={<PauseCircle className="h-4 w-4" />}>
              Suspend
            </Button>
          </form>
        ) : null}
        {canRevoke ? (
          <form
            action={revokeForm}
            onSubmit={(e) => {
              if (!window.confirm("Revoke this license permanently? This cannot be undone from the admin console.")) e.preventDefault();
            }}
          >
            <Button type="submit" variant="danger" loading={revoking} leadingIcon={<Ban className="h-4 w-4" />}>
              Revoke
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
