"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import Brand from "@/components/Brand";

export default function Register() {
  const { register } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirm: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");
    setLoading(true);

    try {
      const r = await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      if (r.verificationToken)
        sessionStorage.setItem(
          "tpaths_dev_verification_token",
          r.verificationToken,
        );
      router.push(
        `/auth/verify-email?email=${encodeURIComponent(form.email.trim())}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create account.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Brand />
        <h1 className="page-title mt-8">Create your account</h1>
        <p className="mt-2 text-slate-600">
          Use the same account on the website and mobile app.
        </p>
        {error && <div className="alert-error mt-5">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">
            First name
            <input
              className="input"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </label>
          <label className="label">
            Last name
            <input
              className="input"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </label>
        </div>
        <label className="label">
          Email
          <input
            className="input"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="label">
          Password
          <input
            className="input"
            type="password"
            minLength={12}
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <span className="hint">
            At least 12 characters with uppercase, lowercase and a number.
          </span>
        </label>
        <label className="label">
          Confirm password
          <input
            className="input"
            type="password"
            required
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </label>
        <button disabled={loading} className="button-primary w-full">
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link href="/auth/login" className="text-link">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
