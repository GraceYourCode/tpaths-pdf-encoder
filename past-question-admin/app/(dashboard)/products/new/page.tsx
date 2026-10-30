import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createProductAction } from "@/app/actions/products";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "../product-form";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New product"
        description="Create the pack first; you can upload its PDF from the product page afterwards."
        actions={
          <Link
            href="/products"
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>
        }
      />
      <Card>
        <CardContent className="pt-5">
          <ProductForm action={createProductAction} submitLabel="Create product" />
        </CardContent>
      </Card>
    </div>
  );
}
