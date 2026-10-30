import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  deleteDocumentAction,
  deleteProductAction,
  updateProductAction,
  uploadDocumentAction,
} from "@/app/actions/products";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshButton } from "@/components/ui/refresh-button";
import { ApiError } from "@/lib/api/errors";
import { getProduct } from "@/lib/api/products";
import type { Product } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { ProductForm } from "../product-form";
import { DeleteProduct } from "./delete-product";
import { DocumentManager } from "./document-manager";

export default async function ProductDetailPage(
  props: PageProps<"/products/[id]">,
) {
  const { id } = await props.params;

  let product: Product | null = null;
  let error: unknown = null;
  try {
    product = await getProduct(id);
  } catch (err) {
    // A genuinely missing product is a 404; anything else (backend down, endpoint
    // not implemented) is an honest, retryable error surface.
    if (err instanceof ApiError && err.kind === "not_found") notFound();
    error = err;
  }

  const backLink = (
    <Link
      href="/products"
      className={buttonClasses({ variant: "ghost", size: "sm" })}
    >
      <ArrowLeft className="h-4 w-4" />
      Back to products
    </Link>
  );

  if (error || !product) {
    return (
      <div className="space-y-6">
        <PageHeader title="Product" actions={backLink} />
        <ErrorState error={error} action={<RefreshButton />} />
      </div>
    );
  }

  const subtitle = [
    product.courseCode,
    product.institution,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.title}
        description={subtitle || undefined}
        actions={backLink}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusBadge status={product.status} />
        <span>Updated {formatDateTime(product.updatedAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Edit this product&apos;s information.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductForm
                action={updateProductAction.bind(null, product.id)}
                product={product}
                submitLabel="Save changes"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document</CardTitle>
              <CardDescription>The past-question PDF for this pack.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentManager
                uploadAction={uploadDocumentAction.bind(null, product.id)}
                deleteAction={product.document ? deleteDocumentAction.bind(null, product.document.id) : deleteDocumentAction.bind(null, "")}
                doc={product.document ?? null}
              />
            </CardContent>
          </Card>

          <Card className="border-danger/40">
            <CardHeader>
              <CardTitle className="text-danger">Danger zone</CardTitle>
              <CardDescription>
                Archive this product from active listings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteProduct
                action={deleteProductAction.bind(null, product.id)}
                productTitle={product.title}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
