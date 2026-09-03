"use client";

import { useActionState } from "react";
import { useMemo, useState } from "react";

import { isValidEmail } from "@/lib/form";

import { createAccount, type AuthFormState } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyState: AuthFormState = {};

export function SignupForm() {
  const [serverState, formAction, pending] = useActionState(
    createAccount,
    emptyState,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });

  const emailValid = useMemo(() => isValidEmail(email), [email]);
  const passwordValid = password.length >= 8;
  const canSubmit = emailValid && passwordValid;

  const serverError = serverState.error;

  const emailError =
    touched.email && !emailValid ? "Enter a valid email address." : undefined;
  const passwordError =
    touched.password && !passwordValid
      ? "Use a password with at least 8 characters."
      : undefined;

  // Map server errors to the most relevant field (client-side blocks most cases).
  const serverEmailError =
    serverError && !/password/i.test(serverError) ? serverError : undefined;
  const serverPasswordError =
    serverError && /password/i.test(serverError) ? serverError : undefined;

  const effectiveEmailError = emailError ?? serverEmailError;
  const effectivePasswordError = passwordError ?? serverPasswordError;

  return (
    <form
      action={formAction}
      className="mt-8 space-y-5"
      onSubmit={(e) => {
        if (!canSubmit) {
          e.preventDefault();
          setTouched({ email: true, password: true });
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@studio.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setTouched((t) => ({ ...t, email: true }))}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          required
          aria-invalid={effectiveEmailError ? true : undefined}
          aria-describedby={effectiveEmailError ? "email-error" : undefined}
        />

        {effectiveEmailError ? (
          <p
            id="email-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {effectiveEmailError}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setTouched((t) => ({ ...t, password: true }))}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          required
          aria-invalid={effectivePasswordError ? true : undefined}
          aria-describedby={effectivePasswordError ? "password-error" : undefined}
        />

        {effectivePasswordError ? (
          <p
            id="password-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {effectivePasswordError}
          </p>
        ) : null}
      </div>

      {serverState.notice ? (
        <p
          id="auth-notice"
          className="text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {serverState.notice}
        </p>
      ) : null}

      <div className="space-y-3">
        <Button
          type="submit"
          className="w-full"
          disabled={!canSubmit || pending}
        >
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}

