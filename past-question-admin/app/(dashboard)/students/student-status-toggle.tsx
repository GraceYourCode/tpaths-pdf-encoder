"use client";

import { useActionState } from "react";
import { UserCheck, UserX } from "lucide-react";
import type { SimpleActionState } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import type { StudentStatus } from "@/lib/api/types";

type ToggleAction = (
  state: SimpleActionState,
  formData: FormData,
) => Promise<SimpleActionState>;

/**
 * Suspend / reactivate a student. The parent binds the target status into the
 * Server Action; this component only renders the correct label and guards the
 * change with a confirm.
 */
export function StudentStatusToggle({
  action,
  currentStatus,
}: {
  action: ToggleAction;
  currentStatus: StudentStatus;
}) {
  const [state, formAction, pending] = useActionState<SimpleActionState, FormData>(
    action,
    {},
  );
  const suspending = currentStatus === "active";
  if (currentStatus === "pending") return <span className="text-xs text-muted-foreground">Pending</span>;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const msg = suspending
          ? "Suspend this student? They will lose access to purchased packs."
          : "Reactivate this student?";
        if (!window.confirm(msg)) e.preventDefault();
      }}
      className="flex items-center justify-end gap-2"
    >
      <Button
        type="submit"
        variant={suspending ? "outline" : "primary"}
        size="sm"
        loading={pending}
        leadingIcon={
          suspending ? (
            <UserX className="h-4 w-4" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )
        }
      >
        {suspending ? "Suspend" : "Reactivate"}
      </Button>
      {state.error ? (
        <span className="text-xs text-danger">{state.error}</span>
      ) : null}
    </form>
  );
}
