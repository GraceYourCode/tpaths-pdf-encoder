import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listProducts } from "@/lib/api/products";
import { PRODUCT_STATUSES, type Paginated, type Product } from "@/lib/api/types";
import { formatDate, formatNaira } from "@/lib/format";
import { firstStr, toPageNumber } from "@/lib/query";

export default async function ProductsPage(props: PageProps<"/products">) {
  const sp = await props.searchParams;
  const page = toPageNumber(sp.page);
  const search = firstStr(sp.search);
  const status = firstStr(sp.status);
  const filtersActive = Boolean(search || status);

  let data: Paginated<Product> | null = null;
  let error: unknown = null;
  try {
    data = await listProducts({
      page,
      search: search || undefined,
      status: status || undefined,
    });
  } catch (err) {
    error = err;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Past-question packs available to students."
        actions={
          <Link
            href="/products/new"
            className={buttonClasses({ size: "sm" })}
          >
            <Plus className="h-4 w-4" />
            New product
          </Link>
        }
      />

      <form
        method="get"
        action="/products"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Search products
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              name="search"
              defaultValue={search}
              placeholder="Search by title or course"
              className="pl-9"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <label htmlFor="status" className="sr-only">
            Filter by status
          </label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
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
              href="/products"
              className={buttonClasses({ variant: "ghost" })}
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <ErrorState error={error} action={<RefreshButton />} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title={filtersActive ? "No matching products" : "No products yet"}
          description={
            filtersActive
              ? "No products match your current search or status filter."
              : "Create your first past-question pack to get started."
          }
          action={
            filtersActive ? (
              <Link
                href="/products"
                className={buttonClasses({ variant: "outline", size: "sm" })}
              >
                Clear filters
              </Link>
            ) : (
              <Link
                href="/products/new"
                className={buttonClasses({ size: "sm" })}
              >
                <Plus className="h-4 w-4" />
                New product
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Course</TH>
                <TH>Price</TH>
                <TH>Status</TH>
                <TH>Document</TH>
                <TH>Updated</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((product) => (
                <TR key={product.id}>
                  <TD>
                    <Link
                      href={`/products/${product.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {product.title}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">
                    {product.courseCode || "—"}
                    {product.institution ? (
                      <span className="block text-xs">
                        {product.institution}
                      </span>
                    ) : null}
                  </TD>
                  <TD className="text-muted-foreground">
                    {product.priceKobo > 0
                      ? formatNaira(product.priceKobo, { fromKobo: true })
                      : <span className="text-warning">Not set</span>}
                  </TD>
                  <TD>
                    <StatusBadge status={product.status} />
                  </TD>
                  <TD className="text-muted-foreground">
                    {product.hasDocument === null ? "—" : product.hasDocument ? "PDF ready" : "No ready PDF"}
                  </TD>
                  <TD className="text-muted-foreground">
                    {formatDate(product.updatedAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            basePath="/products"
            query={{ search: search || undefined, status: status || undefined }}
          />
        </div>
      )}
    </div>
  );
}
