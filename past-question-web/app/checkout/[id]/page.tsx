"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { productsApi, paymentApi } from "@/lib/services";
import { formatMoney } from "@/components/StoreCard";
import { useSession } from "@/components/SessionProvider";
import type { Product, PaymentVerification } from "@/lib/types";

declare global {
  interface Window {
    PaystackPop?: new () => {
      checkout: (
        options: Record<string, unknown>,
      ) => Promise<unknown> | unknown;
    };
  }
}
export default function Checkout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useSession();
  const router = useRouter();
  useEffect(() => {
    void params.then(({ id }) =>
      productsApi
        .get(id)
        .then(setProduct)
        .catch((e) => setError(e.message)),
    );
  }, [params]);
  const [paystackReady, setPaystackReady] = useState(false);
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => setPaystackReady(true);
    script.onerror = () => setError("Unable to load the payment provider.");
    document.body.appendChild(script);
    return () => script.remove();
  }, []);

  async function pay() {
    if (!product || !user)
      return router.push(`/auth/login?next=/checkout/${product?.id ?? ""}`);
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!key)
      return setError(
        "Payment configuration is missing. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.",
      );
    if (!paystackReady || !window.PaystackPop)
      return setError("Payment provider is still loading. Please try again.");
    setLoading(true);
    setError("");

    try {
      const Paystack = window.PaystackPop;
      const popup = new Paystack();
      await popup.checkout({
        key,
        email: user.email,
        amount: product.price,
        currency: product.currency,
        metadata: { productId: product.id },
        onSuccess: (response: { reference: string }) => {
          void paymentApi
            .verify({
              reference: response.reference,
              productId: product.id,
              amount: product.price,
            })
            .then((result: PaymentVerification) => {
              sessionStorage.setItem(
                "tpaths_last_purchase",
                JSON.stringify(result),
              );
              router.push("/payment/success");
            })
            .catch(() => {
              router.push(
                `/payment/pending?reference=${encodeURIComponent(response.reference)}&productId=${encodeURIComponent(product.id)}`,
              );
            });
        },
        onCancel: () => setError("Payment was cancelled."),
      });
    } catch (e) {
        console.log(e);
      setError(
        e instanceof Error ? e.message : "Payment could not be started.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!product)
    return (
      <div className="page-center">
        <div className="spinner" />
      </div>
    );
    
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href={`/store/${product.id}`} className="back-link">
        ← Product
      </Link>
      <div className="card mt-6 p-7">
        <p className="eyebrow">CHECKOUT</p>
        <h1 className="page-title mt-2">{product.title}</h1>
        <div className="mt-6 flex items-center justify-between border-y border-slate-200 py-5">
          <span className="text-slate-600">Total</span>
          <strong className="text-2xl">
            {formatMoney(product.price, product.currency)}
          </strong>
        </div>
        {error && <div className="alert-error mt-5">{error}</div>}
        <p className="mt-5 text-sm leading-6 text-slate-600">
          Payment is processed by the configured provider. Returning from the
          provider does not itself prove payment succeeded; Tpaths verifies the
          transaction with the backend before recording the purchase.
        </p>
        <button
          onClick={pay}
          disabled={loading || !user || !paystackReady}
          className="button-primary mt-6 w-full"
        >
          {loading
            ? "Opening payment…"
            : user
              ? "Pay securely"
              : "Log in to continue"}
        </button>
      </div>
    </main>
  );
}
