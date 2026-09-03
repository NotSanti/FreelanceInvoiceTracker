import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "@/app/(auth)/signup/signup-form";
import { BrandMark } from "@/components/layout/brand-mark";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <BrandMark />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use your email and a password. We’ll send you a verification link.
        </p>

        <SignupForm />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="underline-offset-4 hover:underline hover:text-foreground"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

