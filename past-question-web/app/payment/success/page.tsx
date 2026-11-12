"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { paymentApi } from "@/lib/services";
import { ApiRequestError, errorMessage } from "@/lib/api";
import { formatMoney } from "@/components/StoreCard";
import { readActivationToken, saveActivationToken } from "@/lib/activation-store";
import type { PaymentVerification } from "@/lib/types";

type ViewState =
  | { kind: "verifying" }
  | { kind: "confirmed"; purchase: PaymentVerification; token: string | null }
  | { kind: "pending"; message: string; reference: string; productId: string }
  | { kind: "signin" }
  | { kind: "invalid" };

/**
 * Shows a purchase as paid only after the backend confirms it. Nothing is read
 * from client storage to decide that: the page calls /payments/verify with the
 * reference it was given, and displays the backend's answer.
 */
export default function Success({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; productId?: string }>;
}) {
  const [state, setState] = useState<ViewState>({ kind: "verifying" });

  useEffect(() => {
    let active = true;
    void searchParams.then(async (params) => {
      const reference = params.reference ?? "";
      const productId = params.productId ?? "";
      if (!reference || !productId) {
        if (active) setState({ kind: "invalid" });
        return;
      }
      try {
        const result = await paymentApi.verify({ reference, productId });
        if (!active) return;
        if (result.status !== "PAID") {
          setState({ kind: "pending", message: "Your payment is not confirmed yet.", reference, productId });
          return;
        }
        // The backend returns the activation token only once. Keep it for this
        // browser session so a reload does not lose it.
        if (result.activationToken) saveActivationToken(reference, result.activationToken);
        console.log("Payment confirmed, showing purchase:", result.activationToken);
        setState({
          kind: "confirmed",
          purchase: result,
          token: result.activationToken ?? readActivationToken(reference),
        });
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiRequestError && err.status === 401) setState({ kind: "signin" });
        else setState({ kind: "pending", message: errorMessage(err, "We could not confirm your payment yet."), reference, productId });
      }
    });
    return () => {
      active = false;
    };
  }, [searchParams]);

  if (state.kind === "verifying") {
    return (
      <main className="auth-page">
        <div className="auth-card text-center">
          <div className="spinner mx-auto" />
          <p className="mt-4 text-slate-600">Confirming your payment…</p>
        </div>
      </main>
    );
  }

  if (state.kind === "signin") {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1 className="page-title">Log in to see your purchase</h1>
          <p className="mt-2 text-slate-600">Your session has ended. Log in with the account you used to pay.</p>
          <Link href="/auth/login" className="button-primary mt-6 w-full">Log in</Link>
        </div>
      </main>
    );
  }

  if (state.kind === "invalid") {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1 className="page-title">Payment reference missing</h1>
          <p className="mt-2 text-slate-600">We could not find a payment to confirm. Check your purchases for the status.</p>
          <Link href="/dashboard/purchases" className="button-primary mt-6 w-full">View purchases</Link>
        </div>
      </main>
    );
  }

  if (state.kind === "pending") {
    const retry = `/payment/success?reference=${encodeURIComponent(state.reference)}&productId=${encodeURIComponent(state.productId)}`;
    return (
      <main className="auth-page">
        <div className="auth-card">
          <p className="eyebrow">PAYMENT</p>
          <h1 className="page-title mt-3">Payment confirmation pending</h1>
          <p className="mt-2 text-slate-600">{state.message}</p>
          <Link href={retry} className="button-primary mt-6 w-full">Check again</Link>
          <Link href="/dashboard/purchases" className="button-secondary mt-3 w-full">View purchases</Link>
        </div>
      </main>
    );
  }

  const { purchase, token } = state;
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="success-icon">✓</div>
        <p className="eyebrow mt-6">PAYMENT CONFIRMED</p>
        <h1 className="page-title">Your purchase is confirmed.</h1>
        <p className="mt-2 text-slate-600">
          {purchase.product.title} · {formatMoney(purchase.amount, purchase.currency)}
        </p>
        {token ? (
          <div className="token-box">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Activation token</p>
            <code>{token}</code>
            <p className="mt-2 text-xs text-slate-500">
              Enter this token in the Tpaths mobile app. It is shown only once; keep it somewhere safe.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Your activation token was shown when this purchase was first confirmed. If you did not keep it, contact support.
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <Link href="/dashboard/purchases" className="button-primary flex-1">View purchase</Link>
          <Link href="/dashboard/activation" className="button-secondary flex-1">Mobile access</Link>
        </div>
      </div>
    </main>
  );
}
