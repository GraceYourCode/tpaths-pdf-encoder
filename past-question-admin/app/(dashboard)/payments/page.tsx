import Link from "next/link";
import { CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listPurchases, type PurchasePage } from "@/lib/api/finance";
import { formatDateTime, formatNaira } from "@/lib/format";
import { toPageNumber } from "@/lib/query";

const PAGE_SIZE = 20;

/**
 * Payment ledger. The backend has no dedicated admin payments endpoint, so this
 * view reads each purchase's embedded payment record. Payments that never became
 * a purchase therefore do not appear here.
 */
export default async function PaymentsPage(props: PageProps<"/payments">) {
  const sp = await props.searchParams;
  const page = toPageNumber(sp.page);

  let data: PurchasePage | null = null;
  let error: unknown = null;
  try {
    data = await listPurchases({ page, pageSize: PAGE_SIZE });
  } catch (err) {
    error = err;
  }

  const withPayment = data?.items.filter((p) => p.paymentReference) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Payment references, amounts and outcomes, as recorded against each purchase."
      />

      {error ? (
        <ErrorState error={error} action={<RefreshButton />} />
      ) : withPayment.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-5 w-5" />}
          title={page > 1 ? "No more payments" : "No payments yet"}
          description={
            page > 1
              ? "There are no payments on this page."
              : "Payments appear here after a student completes checkout."
          }
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <THead>
              <TR>
                <TH>Payment reference</TH>
                <TH>Amount</TH>
                <TH>Payment</TH>
                <TH>Purchase</TH>
                <TH>Student</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <TBody>
              {withPayment.map((p) => (
                <TR key={p.id}>
                  <TD className="font-mono text-xs">{p.paymentReference}</TD>
                  <TD className="tabular-nums">{formatNaira(p.amountKobo, { fromKobo: true })}</TD>
                  <TD>{p.paymentStatus ? <StatusBadge status={p.paymentStatus} /> : "—"}</TD>
                  <TD><StatusBadge status={p.status} /></TD>
                  <TD className="text-muted-foreground">
                    {p.studentId ? (
                      <Link href={`/students/${p.studentId}`} className="text-primary hover:underline">
                        {p.studentEmail}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-muted-foreground">{formatDateTime(p.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Page {data?.page ?? page}</p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={`/payments?page=${page - 1}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
                  Previous
                </Link>
              ) : null}
              {data?.hasNext ? (
                <Link href={`/payments?page=${page + 1}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
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
