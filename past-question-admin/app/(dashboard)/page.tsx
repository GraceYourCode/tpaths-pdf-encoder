import Link from "next/link";
import { KeyRound, Package, Users } from "lucide-react";
import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { getDashboardStats } from "@/lib/api/dashboard";
import type { DashboardStats } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export default async function OverviewPage() {
  let stats: DashboardStats | null = null;
  let error: unknown = null;
  try { stats = await getDashboardStats(); } catch (err) { error = err; }

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="A snapshot of products, access tokens, and students." />
      {error || !stats ? <ErrorState error={error} action={<RefreshButton />} /> : <StatsGrid stats={stats} />}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Manage</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink href="/products" icon={Package} title="Products" description="Create packs, edit details, and upload past-question PDFs." />
          <QuickLink href="/tokens" icon={KeyRound} title="Access tokens" description="Generate and revoke redemption codes for students." />
          <QuickLink href="/students" icon={Users} title="Students" description="Review accounts and suspend or reactivate access." />
        </div>
      </section>
    </div>
  );
}

function StatsGrid({ stats }: { stats: DashboardStats }) {
  const cards = [
    ["Total products", stats.totalProducts], ["Active products", stats.activeProducts],
    ["Total students", stats.totalStudents], ["Active students", stats.activeStudents],
    ["Total licenses", stats.totalLicenses], ["Active licenses", stats.activeLicenses],
    ["Total tokens", stats.totalTokens], ["Active tokens", stats.activeTokens],
    ["Paid purchases", stats.paidPurchases],
  ] as const;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}</div>;
}

function StatCard({ label, value }: { label: string; value: number }) {
  const display = Number.isFinite(value) ? value.toLocaleString("en-NG") : "—";
  return <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{display}</p></CardContent></Card>;
}

function QuickLink({ href, icon: Icon, title, description }: { href: string; icon: ComponentType<{ className?: string }>; title: string; description: string }) {
  return <Link href={href} className={cn("group rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/40", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground"><Icon className="h-5 w-5" /></span><span className="font-medium text-foreground">{title}</span></div><p className="mt-2 text-sm text-muted-foreground">{description}</p></Link>;
}
