"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const initialState: LoginFormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <>
      <form action={formAction} className="space-y-6" noValidate>
        <div className="mb-8 flex flex-col gap-4">
          <div className="space-y-1.5">
            <p className="text-xl text-muted-foreground font-semibold">
              Sign in to continue to the admin console.
            </p>
          </div>
        </div>

        {state.error ? (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger-bg/50 px-3 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        ) : null}

        {next ? <input type="hidden" name="next" value={next} /> : null}

        <Field
          label="Email"
          htmlFor="email"
          error={state.fieldErrors?.email}
          required
        >
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={state.values?.email ?? ""}
            placeholder="you@example.com"
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={state.fieldErrors?.password}
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Button type="submit" loading={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Authorized administrators only.
      </p>
    </>
  );
}
