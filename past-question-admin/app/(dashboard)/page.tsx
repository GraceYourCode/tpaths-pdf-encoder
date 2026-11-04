import Link from "next/link";
import { History, KeyRound, Package, Users } from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { getDashboardStats } from "@/lib/api/dashboard";
import type { DashboardStats } from "@/lib/api/types";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function OverviewPage() {
  let stats: DashboardStats | null = null;
  let error: unknown = null;
  try { stats = await getDashboardStats(); } catch (err) { error = err; }

  return (
    <div className="space-y-8">
      <PageHeader title="Overview" description="Catalogue, student access and recent administrative activity." />

      {error || !stats ? (
        <ErrorState error={error} action={<RefreshButton />} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatSection
              icon={Package}
              title="Catalogue"
              href="/products"
              primary={{ label: "Products", value: stats.totalProducts, sub: `${formatNumber(stats.activeProducts)} published` }}
              secondary={{ label: "Paid purchases", value: stats.paidPurchases }}
            />
            <StatSection
              icon={Users}
              title="Students"
              href="/students"
              primary={{ label: "Students", value: stats.totalStudents, sub: `${formatNumber(stats.activeStudents)} active` }}
              secondary={{ label: "Suspended or pending", value: Math.max(0, stats.totalStudents - stats.activeStudents) }}
            />
            <StatSection
              icon={KeyRound}
              title="Licenses"
              href="/licenses"
              primary={{ label: "Licenses", value: stats.totalLicenses, sub: `${formatNumber(stats.activeLicenses)} active` }}
              secondary={{ label: "Inactive licenses", value: Math.max(0, stats.totalLicenses - stats.activeLicenses) }}
            />
            <StatSection
              icon={KeyRound}
              title="Access tokens"
              href="/tokens"
              primary={{ label: "Tokens", value: stats.totalTokens, sub: `${formatNumber(stats.activeTokens)} unused or active` }}
              secondary={{ label: "Used, revoked or expired", value: Math.max(0, stats.totalTokens - stats.activeTokens) }}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>The latest recorded administrative events.</CardDescription>
              </div>
              <Link href="/audit-logs" className="shrink-0 text-sm font-medium text-primary hover:underline">
                View audit log
              </Link>
            </CardHeader>
            <CardContent>
              {stats.recentActivity.length === 0 ? (
                <EmptyState
                  icon={<History className="h-5 w-5" />}
                  title="No recent activity"
                  description="Administrative actions will appear here as they happen."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {stats.recentActivity.map((event) => (
                    <li key={event.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info" className="font-mono">{event.action}</Badge>
                        <span className="text-sm text-muted-foreground">{event.entityType ?? "System"}</span>
                      </div>
                      <time dateTime={event.createdAt} className="text-xs text-muted-foreground">
                        {formatRelativeTime(event.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <section aria-labelledby="quick-actions" className="space-y-3">
        <h2 id="quick-actions" className="text-sm font-semibold text-foreground">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/products/new" title="New product" description="Create a pack and set its price." />
          <QuickLink href="/tokens" title="Generate tokens" description="Create redemption codes for a product." />
          <QuickLink href="/students" title="Review students" description="Find accounts and change their access." />
          <QuickLink href="/payments" title="Check payments" description="Review payment references and outcomes." />
        </div>
      </section>
    </div>
  );
}

function StatSection({
  icon: Icon,
  title,
  href,
  primary,
  secondary,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  href: string;
  primary: { label: string; value: number; sub: string };
  secondary: { label: string; value: number };
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {title}
          </span>
          <Link href={href} className="text-xs font-medium text-primary hover:underline">
            Open<span className="sr-only"> {title}</span>
          </Link>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{primary.label}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{formatNumber(primary.value)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{primary.sub}</p>
        </div>
        <dl className="flex items-baseline justify-between border-t border-border pt-3 text-sm">
          <dt className="text-muted-foreground">{secondary.label}</dt>
          <dd className="font-medium tabular-nums text-foreground">{formatNumber(secondary.value)}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="font-medium text-foreground group-hover:text-primary">{title}</span>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
