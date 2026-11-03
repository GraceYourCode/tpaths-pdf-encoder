import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listPurchases, type PurchasePage } from "@/lib/api/finance";
import { formatDate, formatNaira } from "@/lib/format";
import { toPageNumber } from "@/lib/query";

const PAGE_SIZE = 20;

export default async function PurchasesPage(props: PageProps<"/purchases">) {
  const sp = await props.searchParams;
  const page = toPageNumber(sp.page);

  let data: PurchasePage | null = null;
  let error: unknown = null;
  try {
    data = await listPurchases({ page, pageSize: PAGE_SIZE });
  } catch (err) {
    error = err;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description="Every purchase, with the payment it was made through and the license it issued."
      />

      {error ? (
        <ErrorState error={error} action={<RefreshButton />} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title={page > 1 ? "No more purchases" : "No purchases yet"}
          description={
            page > 1
              ? "There are no purchases on this page."
              : "Purchases appear here once students pay for a product."
          }
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH>Product</TH>
                <TH>Reference</TH>
                <TH>Amount</TH>
                <TH>Purchase</TH>
                <TH>Payment</TH>
                <TH>License</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((p) => (
                <TR key={p.id}>
                  <TD>
                    {p.studentId ? (
                      <Link href={`/students/${p.studentId}`} className="font-medium text-primary hover:underline">
                        {p.studentName || p.studentEmail}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {p.studentEmail ? <span className="block text-xs text-muted-foreground">{p.studentEmail}</span> : null}
                  </TD>
                  <TD className="text-muted-foreground">{p.productTitle || "—"}</TD>
                  <TD className="font-mono text-xs text-muted-foreground">{p.reference}</TD>
                  <TD className="tabular-nums">{formatNaira(p.amountKobo, { fromKobo: true })}</TD>
                  <TD><StatusBadge status={p.status} /></TD>
                  <TD>{p.paymentStatus ? <StatusBadge status={p.paymentStatus} /> : <span className="text-muted-foreground">—</span>}</TD>
                  <TD>
                    {p.licenseStatus ? (
                      <Link href={`/licenses?status=${p.licenseStatus}`} className="hover:underline">
                        <StatusBadge status={p.licenseStatus} />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Not issued</span>
                    )}
                  </TD>
                  <TD className="text-muted-foreground">{formatDate(p.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Page {data.page}</p>
            <div className="flex gap-2">
              {data.page > 1 ? (
                <Link href={`/purchases?page=${data.page - 1}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
                  Previous
                </Link>
              ) : null}
              {data.hasNext ? (
                <Link href={`/purchases?page=${data.page + 1}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
                  Next
                </Link>
              ) : null}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
