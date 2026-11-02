"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import Brand from "@/components/Brand";
export default function Login() {
  const { login, user } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      if (u.status !== "ACTIVE" || !u.emailVerifiedAt)
        router.push("/auth/verify-email");
      else router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to log in.");
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
        {error && <div className="alert-error mt-5">{error}</div>}
        <label className="label">
          Email
          <input
            className="input"
            type="email"
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
