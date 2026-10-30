import type { BackendStudent, ListQuery, Paginated, Student, StudentStatus } from "./types";
import { mapStudent } from "./types";
import { backendRequest } from "./server";

interface BackendPage { items: BackendStudent[]; total: number; page: number; limit: number; totalPages: number; }

export async function listStudents(query: ListQuery = {}): Promise<Paginated<Student>> {
  const data = await backendRequest<BackendPage>({ path: "/admin/students", method: "GET", query: { page: query.page, limit: query.pageSize, search: query.search, status: query.status?.toUpperCase() } });
  return { items: data.items.map(mapStudent), total: data.total, page: data.page, pageSize: data.limit, totalPages: data.totalPages };
}

export async function getStudent(id: string): Promise<Student> {
  const data = await backendRequest<BackendStudent>({ path: `/admin/students/${encodeURIComponent(id)}`, method: "GET" });
  return mapStudent(data);
}

export async function setStudentStatus(id: string, status: StudentStatus): Promise<Student> {
  const data = await backendRequest<BackendStudent>({ path: `/admin/students/${encodeURIComponent(id)}/status`, method: "PATCH", body: { status: status.toUpperCase() } });
  return mapStudent(data);
}
