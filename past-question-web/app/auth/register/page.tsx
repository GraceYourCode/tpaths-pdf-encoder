"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import Brand from "@/components/Brand";
import { isValidWhatsapp, normalizeWhatsapp } from "@/lib/phone";
import { passwordProblem } from "@/lib/password";
import { errorMessage } from "@/lib/api";

export default function Register() {
  const { register } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    whatsapp: "",
    password: "",
    confirm: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problem = passwordProblem(form.password);
    if (problem) return setError(problem);
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");
    const whatsapp = normalizeWhatsapp(form.whatsapp);
    if (!isValidWhatsapp(whatsapp))
      return setError(
        "Enter a valid WhatsApp number with country code, for example +2348012345678.",
      );
    setLoading(true);

    try {
      const r = await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        whatsapp,
      });
      // Development only: the backend returns the token outside production so testers can continue.
      if (r.verificationToken)
        sessionStorage.setItem("tpaths_dev_verification_token", r.verificationToken);
      router.push(
        `/auth/verify-email?email=${encodeURIComponent(form.email.trim())}`,
      );
    } catch (e) {
      setError(errorMessage(e, "Unable to create account."));
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
        {error && <div role="alert" className="alert-error mt-5">{error}</div>}
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
          WhatsApp number
          <input
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="+2348012345678"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          />
          <span className="hint">
            Include your country code, for example +234 for Nigeria.
          </span>
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
