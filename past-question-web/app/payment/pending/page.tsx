"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy entry point kept so older links still work. Confirmation always happens
 * on the success route, which asks the backend to verify the reference, so this
 * page only forwards there.
 */
export default function Pending({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; productId?: string }>;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    void searchParams.then((p) => {
      if (!p.reference || !p.productId) {
        setTarget("/dashboard/purchases");
        return;
      }
      setTarget(`/payment/success?reference=${encodeURIComponent(p.reference)}&productId=${encodeURIComponent(p.productId)}`);
    });
  }, [searchParams]);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  return (
    <main className="auth-page">
      <div className="auth-card text-center">
        <div className="spinner mx-auto" />
        <p className="mt-4 text-slate-600">Checking your payment…</p>
        <Link href="/dashboard/purchases" className="text-link mt-4 inline-block text-sm">View purchases</Link>
      </div>
    </main>
  );
}
