"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { productsApi, paymentApi } from "@/lib/services";
import { errorMessage, isConflict } from "@/lib/api";
import { formatMoney } from "@/components/StoreCard";
import { useSession } from "@/components/SessionProvider";
import type { Product } from "@/lib/types";

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction: (
        accessCode: string,
        options: {
          onSuccess?: (transaction: { reference?: string }) => void;
          onCancel?: () => void;
          onError?: (error: unknown) => void;
        },
      ) => void;
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
    let active = true;
    void params.then(({ id }) =>
      productsApi
        .get(id)
        .then((p) => active && setProduct(p))
        .catch((e) => active && setError(errorMessage(e, "This product is not available."))),
    );
    return () => {
      active = false;
    };
  }, [params]);
  const [paystackReady, setPaystackReady] = useState(false);
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => setPaystackReady(true);
    script.onerror = () => setError("Unable to load the payment provider. Check your connection and refresh the page.");
    document.body.appendChild(script);
    return () => script.remove();
  }, []);

  async function pay() {
    if (!product || !user)
      return router.push(`/auth/login?next=${encodeURIComponent(`/checkout/${product?.id ?? ""}`)}`);
    if (!paystackReady || !window.PaystackPop)
      return setError("Payment provider is still loading. Please try again.");
    setLoading(true);
    setError("");

    try {
      // The backend creates the PENDING purchase and the provider transaction, and
      // decides the amount and reference. The browser only resumes that transaction.
      const init = await paymentApi.initialize(product.id);
      const popup = new window.PaystackPop();
      const reference = init.reference;
      const confirmUrl = `/payment/success?reference=${encodeURIComponent(reference)}&productId=${encodeURIComponent(product.id)}`;

      popup.resumeTransaction(init.accessCode, {
        onSuccess: () => {
          // Returning from the provider is not proof of payment. The confirmation
          // page asks the backend to verify the transaction before showing anything.
          router.push(confirmUrl);
        },
        onCancel: () => {
          setError("Payment was cancelled. You have not been charged.");
          setLoading(false);
        },
        onError: () => {
          setError("The payment window reported a problem. If you were charged, your purchase will appear once the backend confirms it.");
          setLoading(false);
        },
      });
    } catch (e) {
      setError(
        isConflict(e)
          ? "You already own this material. Find it in your library."
          : errorMessage(e, "Payment could not be started."),
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
        {error && <div role="alert" className="alert-error mt-5">{error}</div>}
        <p className="mt-5 text-sm leading-6 text-slate-600">
          Payment is processed by the configured provider. Tpaths confirms the
          transaction with the backend before showing a purchase as paid.
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
