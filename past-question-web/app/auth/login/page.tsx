"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import Brand from "@/components/Brand";
import { ApiRequestError, errorMessage } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";

/**
 * The backend answers 403 for unverified email and inactive accounts. Its
 * exception filter currently drops the machine-readable `code`, so the message is
 * matched as well. Both paths are handled.
 */
function needsVerification(error: unknown) {
  if (!(error instanceof ApiRequestError)) return false;
  return error.code === "EMAIL_NOT_VERIFIED" || (error.status === 403 && /verify your email/i.test(error.message));
}

export default function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { login, user } = useSession();
  const router = useRouter();
  const [next, setNext] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void searchParams.then((p) => setNext(safeNext(p.next)));
  }, [searchParams]);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const signedIn = await login(email.trim(), password);
      if (signedIn.status !== "ACTIVE" || !signedIn.emailVerifiedAt) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      console.log("Login successful, redirecting to:", next);
      router.push(next);
    } catch (err) {
      if (needsVerification(err)) {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setError(errorMessage(err, "Unable to log in."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Brand />
        <h1 className="page-title mt-8">Welcome back</h1>
        <p className="mt-2 text-slate-600">Log in to manage your purchases.</p>
        {error && <div role="alert" className="alert-error mt-5">{error}</div>}
        <label className="label">
          Email
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="label">
          Password
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button disabled={loading} className="button-primary w-full">
          {loading ? "Logging in…" : "Log in"}
        </button>
        <div className="flex justify-between text-sm">
          <Link href="/auth/forgot-password" className="text-link">
            Forgot password?
          </Link>
          <Link href="/auth/register" className="text-link">
            Create account
          </Link>
        </div>
      </form>
    </main>
  );
}
