import Link from "next/link";
import { Users } from "lucide-react";
import { setStudentStatusAction } from "@/app/actions/students";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listStudents } from "@/lib/api/students";
import { STUDENT_STATUSES, type Paginated, type Student } from "@/lib/api/types";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { firstStr, toPageNumber } from "@/lib/query";
import { StudentStatusToggle } from "./student-status-toggle";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function StudentsPage(props: PageProps<"/students">) {
  const sp = await props.searchParams;
  const page = toPageNumber(sp.page);
  const search = firstStr(sp.search);
  const status = firstStr(sp.status);
  const filtersActive = Boolean(search || status);

  let data: Paginated<Student> | null = null;
  let error: unknown = null;
  try {
    data = await listStudents({
      page,
      search: search || undefined,
      status: status || undefined,
    });
  } catch (err) {
    error = err;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Registered students and their account status."
      />

      <form
        method="get"
        action="/students"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Search students
          </label>
          <Input
            id="search"
            name="search"
            defaultValue={search}
            placeholder="Search by name or email"
          />
        </div>
        <div className="sm:w-48">
          <label htmlFor="status" className="sr-only">
            Filter by status
          </label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {STUDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {cap(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {filtersActive ? (
            <Link
              href="/students"
              className={buttonClasses({ variant: "ghost" })}
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <ErrorState error={error} action={<RefreshButton />} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={filtersActive ? "No matching students" : "No students yet"}
          description={
            filtersActive
              ? "No students match your current search or status filter."
              : "Students will appear here once they register in the mobile app."
          }
          action={
            filtersActive ? (
              <Link
                href="/students"
                className={buttonClasses({ variant: "outline", size: "sm" })}
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH>Status</TH>
                <TH>Purchases</TH>
                <TH>Joined</TH>
                <TH>Last active</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((student) => (
                <TR key={student.id}>
                  <TD>
                    <Link
                      href={`/students/${student.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {student.name || "—"}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {student.email}
                    </span>
                  </TD>
                  <TD>
                    <StatusBadge status={student.status} />
                  </TD>
                  <TD className="tabular-nums text-muted-foreground">
                    {student.purchaseCount ?? 0}
                  </TD>
                  <TD className="text-muted-foreground">
                    {formatDate(student.createdAt)}
                  </TD>
                  <TD className="text-muted-foreground">
                    {student.lastActiveAt
                      ? formatRelativeTime(student.lastActiveAt)
                      : "—"}
                  </TD>
                  <TD className="text-right">
                    <StudentStatusToggle
                      action={setStudentStatusAction.bind(
                        null,
                        student.id,
                        student.status === "active" ? "suspended" : "active",
                      )}
                      currentStatus={student.status}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            basePath="/students"
            query={{ search: search || undefined, status: status || undefined }}
          />
        </div>
      )}
    </div>
  );
}
