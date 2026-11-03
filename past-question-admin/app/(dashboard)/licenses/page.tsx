import Link from "next/link";
import { KeyRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listLicenses, type LicenseList } from "@/lib/api/finance";
import { formatDate, formatDateTime } from "@/lib/format";
import { firstStr, toPageNumber } from "@/lib/query";

const LICENSE_STATUSES = ["active", "suspended", "revoked", "expired"] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function LicensesPage(props: PageProps<"/licenses">) {
  const sp = await props.searchParams;
  const page = toPageNumber(sp.page);
  const statusRaw = firstStr(sp.status);
  const status = (LICENSE_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "";

  let data: LicenseList | null = null;
  let error: unknown = null;
  try {
    data = await listLicenses({ page, status: status || undefined });
  } catch (err) {
    error = err;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Licenses"
        description="Entitlements granted by purchases. Suspend or revoke a license from its detail page."
      />

      <form method="get" action="/licenses" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <label htmlFor="status" className="sr-only">Filter by status</label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {LICENSE_STATUSES.map((s) => (
              <option key={s} value={s}>{cap(s)}</option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">Filter</Button>
          {status ? (
            <Link href="/licenses" className={buttonClasses({ variant: "ghost" })}>Clear</Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <ErrorState error={error} action={<RefreshButton />} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="h-5 w-5" />}
          title={status ? "No matching licenses" : "No licenses yet"}
          description={status ? "No licenses match this status." : "Licenses appear once a purchase is activated."}
        />
      ) : (
        <div className="space-y-4">
          {!data.honoured ? (
            <p role="note" className="rounded-md border border-warning/40 bg-warning-bg/40 px-3 py-2 text-sm text-foreground">
              The backend returned the newest licenses without applying this filter or page.
              Filtering and paging need query support on the backend&apos;s license list.
            </p>
          ) : null}
          <Table>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH>Product</TH>
                <TH>Status</TH>
                <TH>Device</TH>
                <TH>Activated</TH>
                <TH>Expires</TH>
                <TH className="text-right"><span className="sr-only">Open</span></TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((l) => (
                <TR key={l.id}>
                  <TD>
                    <span className="font-medium text-foreground">{l.studentName || "—"}</span>
                    <span className="block text-xs text-muted-foreground">{l.studentEmail}</span>
                  </TD>
                  <TD className="text-muted-foreground">{l.productTitle || "—"}</TD>
                  <TD><StatusBadge status={l.status} /></TD>
                  <TD className="text-muted-foreground">{l.deviceId ? "Bound" : "Not bound"}</TD>
                  <TD className="text-muted-foreground">{l.activatedAt ? formatDateTime(l.activatedAt) : "—"}</TD>
                  <TD className="text-muted-foreground">{l.expiresAt ? formatDate(l.expiresAt) : "Never"}</TD>
                  <TD className="text-right">
                    <Link href={`/licenses/${l.id}`} className="text-sm font-medium text-primary hover:underline">View</Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            basePath="/licenses"
            query={{ status: status || undefined }}
          />
        </div>
      )}
    </div>
  );
}
