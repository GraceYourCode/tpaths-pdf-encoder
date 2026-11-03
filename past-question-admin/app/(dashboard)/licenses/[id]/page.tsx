import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { setLicenseStatusAction } from "@/app/actions/licenses";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { getLicense } from "@/lib/api/finance";
import { formatDateTime } from "@/lib/format";
import { LicenseActions } from "./license-actions";

export default async function LicenseDetailPage(props: PageProps<"/licenses/[id]">) {
  const { id } = await props.params;

  const backLink = (
    <Link href="/licenses" className={buttonClasses({ variant: "ghost", size: "sm" })}>
      <ArrowLeft className="h-4 w-4" />
      Back to licenses
    </Link>
  );

  let license;
  try {
    license = await getLicense(id);
  } catch (err) {
    return (
      <div className="space-y-6">
        <PageHeader title="License" actions={backLink} />
        <ErrorState error={err} action={<RefreshButton />} />
      </div>
    );
  }

  const canSuspend = license.status === "active";
  const canRevoke = license.status === "active" || license.status === "suspended";
  const field = (label: string, value: string | null | undefined) => (
    <div className="flex justify-between gap-4 border-b border-border py-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground break-all">{value || "—"}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="License" description={license.productTitle || undefined} actions={backLink} />

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusBadge status={license.status} />
        <span>Issued {formatDateTime(license.createdAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Who holds this license and how it was issued.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              {field("Student", license.studentName ? `${license.studentName} · ${license.studentEmail}` : license.studentEmail)}
              {field("Product", license.productTitle)}
              {field("Purchase reference", license.purchaseReference)}
              {field("Device", license.deviceId ? "Bound to a device" : "Not yet bound")}
              {field("Activated", license.activatedAt ? formatDateTime(license.activatedAt) : null)}
              {field("Last validated", license.lastValidatedAt ? formatDateTime(license.lastValidatedAt) : null)}
              {field("Expires", license.expiresAt ? formatDateTime(license.expiresAt) : "Never")}
            </dl>
            {license.studentId ? (
              <p className="mt-4 text-sm">
                <Link href={`/students/${license.studentId}`} className="font-medium text-primary hover:underline">
                  Open student record
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Suspension can be reversed by the backend; revocation cannot.</CardDescription>
          </CardHeader>
          <CardContent>
            {canSuspend || canRevoke ? (
              <LicenseActions
                suspendAction={setLicenseStatusAction.bind(null, license.id, "suspend")}
                revokeAction={setLicenseStatusAction.bind(null, license.id, "revoke")}
                canSuspend={canSuspend}
                canRevoke={canRevoke}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                This license is {license.status}; no further changes are available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
