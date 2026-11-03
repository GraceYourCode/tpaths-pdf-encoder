import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { revokeStudentDeviceAction, setStudentStatusAction } from "@/app/actions/students";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listProducts } from "@/lib/api/products";
import { getStudentDetail } from "@/lib/api/students";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { StudentStatusToggle } from "../student-status-toggle";
import { RevokeDeviceButton } from "./revoke-device-button";

export default async function StudentDetailPage(props: PageProps<"/students/[id]">) {
  const { id } = await props.params;

  // Product titles are optional decoration: a failed product lookup must not
  // hide the student record, so it settles independently.
  const [studentRes, productsRes] = await Promise.allSettled([
    getStudentDetail(id),
    listProducts({ pageSize: 100 }),
  ]);

  const backLink = (
    <Link href="/students" className={buttonClasses({ variant: "ghost", size: "sm" })}>
      <ArrowLeft className="h-4 w-4" />
      Back to students
    </Link>
  );

  if (studentRes.status === "rejected") {
    return (
      <div className="space-y-6">
        <PageHeader title="Student" actions={backLink} />
        <ErrorState error={studentRes.reason} action={<RefreshButton />} />
      </div>
    );
  }

  const student = studentRes.value;
  const productTitles = new Map(
    productsRes.status === "fulfilled" ? productsRes.value.items.map((p) => [p.id, p.title]) : [],
  );
  const titleOf = (productId: string) =>
    productTitles.get(productId) ?? `Product ···${productId.slice(-6)}`;
  const displayName = student.name || student.email;
  const nextStatus = student.status === "active" ? "suspended" : "active";

  return (
    <div className="space-y-6">
      <PageHeader
        title={displayName}
        description={student.email}
        actions={backLink}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusBadge status={student.status} />
        <span>Joined {formatDate(student.createdAt)}</span>
        <span>Updated {formatDateTime(student.updatedAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Account status and verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Email verified</dt>
                <dd className="text-foreground">
                  {student.emailVerifiedAt ? formatDate(student.emailVerifiedAt) : "Not verified"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Purchases</dt>
                <dd className="tabular-nums text-foreground">{student.purchases.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Devices</dt>
                <dd className="tabular-nums text-foreground">{student.devices.length}</dd>
              </div>
            </dl>
            {student.status === "pending" ? (
              <p className="text-muted-foreground">
                This account is pending and cannot change status from here.
              </p>
            ) : (
              <div className="flex justify-start">
                <StudentStatusToggle
                  action={setStudentStatusAction.bind(null, student.id, nextStatus)}
                  currentStatus={student.status}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Purchases</CardTitle>
              <CardDescription>Payments this student made, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {student.purchases.length === 0 ? (
                <EmptyState title="No purchases" description="This student has not bought anything yet." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Product</TH>
                      <TH>Reference</TH>
                      <TH>Status</TH>
                      <TH>Date</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {student.purchases.map((p) => (
                      <TR key={p.id}>
                        <TD>{titleOf(p.productId)}</TD>
                        <TD className="font-mono text-xs text-muted-foreground">{p.reference}</TD>
                        <TD><StatusBadge status={p.status} /></TD>
                        <TD className="text-muted-foreground">{formatDate(p.createdAt)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Licenses</CardTitle>
              <CardDescription>Entitlements granted by purchases.</CardDescription>
            </CardHeader>
            <CardContent>
              {student.licenses.length === 0 ? (
                <EmptyState title="No licenses" description="Licenses appear once a purchase is activated." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Product</TH>
                      <TH>Status</TH>
                      <TH>Issued</TH>
                      <TH className="text-right"><span className="sr-only">Open</span></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {student.licenses.map((l) => (
                      <TR key={l.id}>
                        <TD>{titleOf(l.productId)}</TD>
                        <TD><StatusBadge status={l.status} /></TD>
                        <TD className="text-muted-foreground">{formatDate(l.createdAt)}</TD>
                        <TD className="text-right">
                          <Link href={`/licenses/${l.id}`} className="text-sm font-medium text-primary hover:underline">
                            View
                          </Link>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Devices</CardTitle>
              <CardDescription>Registered devices. Revoking one blocks it from opening purchased packs.</CardDescription>
            </CardHeader>
            <CardContent>
              {student.devices.length === 0 ? (
                <EmptyState title="No devices" description="The student has not registered a device yet." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Platform</TH>
                      <TH>App version</TH>
                      <TH>Last seen</TH>
                      <TH>Status</TH>
                      <TH className="text-right"><span className="sr-only">Actions</span></TH>
                    </TR>
                  </THead>
                  <TBody>
                    {student.devices.map((d) => (
                      <TR key={d.id}>
                        <TD className="capitalize">{d.platform}</TD>
                        <TD className="text-muted-foreground">{d.appVersion || "—"}</TD>
                        <TD className="text-muted-foreground" title={formatDateTime(d.lastSeenAt)}>
                          {formatRelativeTime(d.lastSeenAt)}
                        </TD>
                        <TD><StatusBadge status={d.status} /></TD>
                        <TD className="text-right">
                          {d.status === "active" ? (
                            <div className="flex justify-end">
                              <RevokeDeviceButton
                                action={revokeStudentDeviceAction.bind(null, student.id, d.id)}
                              />
                            </div>
                          ) : null}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
