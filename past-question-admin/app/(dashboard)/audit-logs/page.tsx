import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AUDIT_MAX_LIMIT, listAuditEvents } from "@/lib/api/finance";
import type { AuditEvent } from "@/lib/api/types";
import { formatDateTime, truncate } from "@/lib/format";
import { firstStr } from "@/lib/query";

const LIMIT_OPTIONS = [50, AUDIT_MAX_LIMIT] as const;

export default async function AuditLogsPage(props: PageProps<"/audit-logs">) {
  const sp = await props.searchParams;
  const requested = Number.parseInt(firstStr(sp.limit), 10);
  const limit = (LIMIT_OPTIONS as readonly number[]).includes(requested) ? requested : 50;

  let events: AuditEvent[] | null = null;
  let error: unknown = null;
  try {
    events = await listAuditEvents(limit);
  } catch (err) {
    error = err;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Recorded administrative and security events. Newest first. Secrets are never written here."
      />

      <form method="get" action="/audit-logs" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-48">
          <label htmlFor="limit" className="text-sm font-medium text-foreground">Rows to show</label>
          <Select id="limit" name="limit" defaultValue={String(limit)}>
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">Apply</Button>
          <Link href="/audit-logs" className={buttonClasses({ variant: "ghost" })}>Reset</Link>
        </div>
      </form>

      {error ? (
        <ErrorState error={error} action={<RefreshButton />} />
      ) : !events || events.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No events yet" description="Events appear as administrators and the system act." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Action</TH>
              <TH>Entity</TH>
              <TH>Actor</TH>
              <TH>IP</TH>
              <TH>Details</TH>
            </TR>
          </THead>
          <TBody>
            {events.map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt)}</TD>
                <TD className="font-mono text-xs">{e.action}</TD>
                <TD className="text-muted-foreground">
                  {e.entityType ?? "—"}
                  {e.entityId ? <span className="block font-mono text-xs">{e.entityId.slice(0, 8)}…</span> : null}
                </TD>
                <TD className="font-mono text-xs text-muted-foreground">{e.actorId ? `${e.actorId.slice(0, 8)}…` : "system"}</TD>
                <TD className="font-mono text-xs text-muted-foreground">{e.ipAddress ?? "—"}</TD>
                <TD className="max-w-xs font-mono text-xs text-muted-foreground" title={e.metadata ?? undefined}>
                  {e.metadata ? truncate(e.metadata, 90) : "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
