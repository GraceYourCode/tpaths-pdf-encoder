import Link from "next/link";
import { KeyRound } from "lucide-react";
import { revokeTokenAction } from "@/app/actions/tokens";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listProducts } from "@/lib/api/products";
import { listTokens } from "@/lib/api/tokens";
import { TOKEN_STATUSES } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { firstStr, toPageNumber } from "@/lib/query";
import { RevokeButton } from "./revoke-button";
import { TokenGenerator } from "./token-generator";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function TokensPage(props: PageProps<"/tokens">) {
  const sp = await props.searchParams;
  const page = toPageNumber(sp.page);
  const status = firstStr(sp.status);
  const productId = firstStr(sp.productId);
  const filtersActive = Boolean(status || productId);

  // Tokens and products load independently: a failure to list products (for the
  // generator + filter) shouldn't blank out the tokens table, and vice versa.
  const [tokensRes, productsRes] = await Promise.allSettled([
    listTokens({
      page,
      status: status || undefined,
      productId: productId || undefined,
    }),
    listProducts({ pageSize: 100 }),
  ]);

  const tokensData = tokensRes.status === "fulfilled" ? tokensRes.value : null;
  const tokensError = tokensRes.status === "rejected" ? tokensRes.reason : null;
  const products =
    productsRes.status === "fulfilled" ? productsRes.value.items : [];
  const productTitles = new Map(products.map((p) => [p.id, p.title]));
  const productsError = productsRes.status === "rejected";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access tokens"
        description="Generate redemption codes and manage existing ones."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Generate tokens</CardTitle>
              <CardDescription>
                Create redemption codes for a product.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TokenGenerator
                products={products.map((p) => ({ id: p.id, title: p.title }))}
                productsError={productsError}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <form
            method="get"
            action="/tokens"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="sm:w-44">
              <label htmlFor="status" className="sr-only">
                Filter by status
              </label>
              <Select id="status" name="status" defaultValue={status}>
                <option value="">All statuses</option>
                {TOKEN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {cap(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:w-56">
              <label htmlFor="productId" className="sr-only">
                Filter by product
              </label>
              <Select
                id="productId"
                name="productId"
                defaultValue={productId}
                disabled={products.length === 0}
              >
                <option value="">All products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
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
                  href="/tokens"
                  className={buttonClasses({ variant: "ghost" })}
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>

          {tokensError ? (
            <ErrorState error={tokensError} action={<RefreshButton />} />
          ) : !tokensData || tokensData.items.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-5 w-5" />}
              title={filtersActive ? "No matching tokens" : "No tokens yet"}
              description={
                filtersActive
                  ? "No tokens match your current filters."
                  : "Generate your first batch of redemption codes using the form."
              }
            />
          ) : (
            <div className="space-y-4">
              <Table>
                <THead>
                  <TR>
                    <TH>Code</TH>
                    <TH>Product</TH>
                    <TH>Purchase</TH>
                    <TH>Status</TH>
                    <TH>Created</TH>
                    <TH>Expires</TH>
                    <TH className="text-right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {tokensData.items.map((token) => (
                    <TR key={token.id}>
                      <TD className="font-mono text-xs">{token.maskedCode}</TD>
                      <TD className="text-muted-foreground">
                        {token.productTitle || (token.productId ? productTitles.get(token.productId) : null) || "—"}
                      </TD>
                      <TD className="text-muted-foreground">
                        {token.purchaseId ? `Linked · ${token.purchaseId.slice(-8)}` : "Not linked"}
                      </TD>
                      <TD>
                        <StatusBadge status={token.status} />
                      </TD>
                      <TD className="text-muted-foreground">
                        {formatDate(token.createdAt)}
                      </TD>
                      <TD className="text-muted-foreground">
                        {token.expiresAt ? formatDate(token.expiresAt) : "—"}
                      </TD>
                      <TD className="text-right">
                        {token.status === "active" ? (
                          <div className="flex justify-end">
                            <RevokeButton
                              action={revokeTokenAction.bind(null, token.id)}
                            />
                          </div>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination
                page={tokensData.page}
                totalPages={tokensData.totalPages}
                basePath="/tokens"
                query={{
                  status: status || undefined,
                  productId: productId || undefined,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
