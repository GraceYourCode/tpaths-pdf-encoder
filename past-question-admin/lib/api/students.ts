import type { BackendStudent, ListQuery, Paginated, Student, StudentDetail, StudentStatus } from "./types";
import { mapStudent, mapStudentDetail, STUDENT_STATUSES } from "./types";
import { backendRequest } from "./server";

interface BackendPage<T> { items: T[]; total: number; page: number; limit: number; totalPages: number; }

export async function listStudents(query: ListQuery = {}): Promise<Paginated<Student>> {
  // Only known statuses reach the backend: an arbitrary value would be an invalid
  // Prisma enum filter and surface as a server error instead of an empty list.
  const status = query.status && (STUDENT_STATUSES as readonly string[]).includes(query.status)
    ? query.status.toUpperCase()
    : undefined;
  const data = await backendRequest<BackendPage<BackendStudent>>({
    path: "/admin/students",
    method: "GET",
    query: {
      page: query.page,
      limit: query.pageSize,
      search: query.search,
      status,
    },
  });
  return {
    items: data.items.map((s) => mapStudent(s)),
    total: data.total,
    page: data.page,
    pageSize: data.limit,
    totalPages: data.totalPages,
  };
}

/**
 * Consolidated student record: profile, purchases, licenses and devices.
 *
 * NOTE: the backend's `AdminService.student()` currently checks `u.role` while
 * not selecting `role`, so this request returns 404 until that select is fixed.
 * The UI reports that honestly as "Not found".
 */
export async function getStudentDetail(id: string): Promise<StudentDetail> {
  const data = await backendRequest<BackendStudent>({
    path: `/admin/students/${encodeURIComponent(id)}`,
    method: "GET",
  });
  return mapStudentDetail(data);
}

export async function setStudentStatus(id: string, status: StudentStatus): Promise<Student> {
  const data = await backendRequest<BackendStudent>({
    path: `/admin/students/${encodeURIComponent(id)}/status`,
    method: "PATCH",
    body: { status: status.toUpperCase() },
  });
  return mapStudent(data);
}

/**
 * Revokes one student device. The backend currently exposes device revocation
 * only to the device's owner (`POST /devices/:id/revoke`), so an admin call needs
 * a dedicated admin route. Until that route exists the backend answers 404 and
 * the UI shows that as a backend-not-available error.
 */
export async function revokeStudentDevice(deviceId: string): Promise<void> {
  await backendRequest<unknown>({
    path: `/admin/devices/${encodeURIComponent(deviceId)}/revoke`,
    method: "POST",
  });
}
