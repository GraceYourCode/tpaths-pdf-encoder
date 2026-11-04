import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { distinctAuditActions, filterAuditEvents } from "@/lib/api/audit-filter";
import { AUDIT_MAX_LIMIT, listAuditEvents } from "@/lib/api/finance";
import type { AuditEvent } from "@/lib/api/types";
import { formatDateTime, truncate } from "@/lib/format";
import { firstStr } from "@/lib/query";

const LIMIT_OPTIONS = [50, AUDIT_MAX_LIMIT] as const;

export default async function AuditLogsPage(props: PageProps<"/audit-logs">) {
  const sp = await props.searchParams;
  const requested = Number.parseInt(firstStr(sp.limit), 10);
  const limit = (LIMIT_OPTIONS as readonly number[]).includes(requested) ? requested : 50;
  const q = firstStr(sp.q).trim();
  const action = firstStr(sp.action);

  let fetched: AuditEvent[] | null = null;
  let error: unknown = null;
  try {
    fetched = await listAuditEvents(limit);
  } catch (err) {
    error = err;
  }

  const actions = fetched ? distinctAuditActions(fetched) : [];
  const events = fetched ? filterAuditEvents(fetched, { q, action: action || undefined }) : [];
  const filtersActive = Boolean(q || action);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Recorded administrative and security events, newest first. Secrets are never written here."
      />

      <form method="get" action="/audit-logs" className="grid gap-3 md:grid-cols-[1fr_14rem_10rem_auto] md:items-end">
        <div className="space-y-1.5">
          <label htmlFor="q" className="text-sm font-medium text-foreground">Search</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Action, entity ID, actor, IP or details" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="action" className="text-sm font-medium text-foreground">Action</label>
          <Select id="action" name="action" defaultValue={action}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="limit" className="text-sm font-medium text-foreground">Rows fetched</label>
          <Select id="limit" name="limit" defaultValue={String(limit)}>
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">Apply</Button>
          {filtersActive ? (
            <Link href="/audit-logs" className={buttonClasses({ variant: "ghost" })}>Clear</Link>
          ) : null}
        </div>
      </form>

      {fetched ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing {events.length} of {fetched.length} fetched events.
          {fetched.length >= limit ? " Older events are not loaded; the backend has no paging for this log." : ""}
        </p>
      ) : null}

      {error ? (
        <ErrorState error={error} action={<RefreshButton />} />
      ) : !fetched || fetched.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No events yet" description="Events appear as administrators and the system act." />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" />}
          title="No matching events"
          description="Nothing in the fetched rows matches these filters."
          action={<Link href="/audit-logs" className={buttonClasses({ variant: "outline", size: "sm" })}>Clear filters</Link>}
        />
      ) : (
        <div className="overflow-x-auto">
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
                  <TD className="whitespace-nowrap text-muted-foreground">
                    <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
                  </TD>
                  <TD className="font-mono text-xs">{e.action}</TD>
                  <TD className="text-muted-foreground">
                    {e.entityType ?? "—"}
                    {e.entityId ? <span className="block font-mono text-xs" title={e.entityId}>{e.entityId.slice(0, 8)}…</span> : null}
                  </TD>
                  <TD className="font-mono text-xs text-muted-foreground" title={e.actorId ?? undefined}>
                    {e.actorId ? `${e.actorId.slice(0, 8)}…` : "system"}
                  </TD>
                  <TD className="font-mono text-xs text-muted-foreground">{e.ipAddress ?? "—"}</TD>
                  <TD className="max-w-xs font-mono text-xs text-muted-foreground" title={e.metadata ?? undefined}>
                    {e.metadata ? truncate(e.metadata, 90) : "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
