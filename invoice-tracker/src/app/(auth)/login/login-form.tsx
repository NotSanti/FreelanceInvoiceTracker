"use client";

import { useActionState } from "react";

import { createAccount, signIn, type AuthFormState } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState,
  );
  const [createState, createAction, createPending] = useActionState(
    createAccount,
    initialState,
  );

  const pending = signInPending || createPending;
  const error = signInState.error || createState.error;
  const notice = signInState.notice || createState.notice;

  return (
    <form className="mt-8 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@studio.com"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "auth-error" : notice ? "auth-notice" : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "auth-error" : notice ? "auth-notice" : undefined}
        />
      </div>

      {error ? (
        <p id="auth-error" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p id="auth-notice" className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}

      <div className="space-y-3">
        <Button type="submit" className="w-full" formAction={signInAction} disabled={pending}>
          {signInPending ? "Signing in…" : "Sign in"}
        </Button>
        <Button
          type="submit"
          variant="ghost"
          className="w-full"
          formAction={createAction}
          disabled={pending}
        >
          {createPending ? "Creating account…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}
