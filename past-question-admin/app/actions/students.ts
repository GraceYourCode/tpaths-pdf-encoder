"use server";

import { revalidatePath } from "next/cache";
import { describeError } from "@/lib/api/errors";
import { setStudentStatus } from "@/lib/api/students";
import { STUDENT_STATUSES, type StudentStatus } from "@/lib/api/types";
import { requireSession } from "@/lib/session";

/**
 * Student mutation Server Actions. Authorization is enforced again by the
 * backend on every request.
 */

export interface SimpleActionState {
  ok?: boolean;
  error?: string;
}

export async function setStudentStatusAction(
  id: string,
  status: StudentStatus,
): Promise<SimpleActionState> {
  await requireSession();

  if (!(STUDENT_STATUSES as readonly string[]).includes(status)) {
    return { error: "Invalid status." };
  }

  try {
    await setStudentStatus(id, status);
  } catch (err) {
    return { error: describeError(err).message };
  }

  revalidatePath("/students");
  return { ok: true };
}
