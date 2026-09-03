import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { BrandMark } from "@/components/layout/brand-mark";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
};

function readSearchParam(
  value: string | string[] | undefined,
) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const initialState = {
    error: readSearchParam(params.error),
    notice: readSearchParam(params.notice),
  };

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <BrandMark />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This is a personal workspace. Use the email and password for this
          account.
        </p>

        <LoginForm initialState={initialState} />

        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/" className="underline-offset-4 hover:underline hover:text-foreground">
            Back to home
          </Link>
          <span className="mx-2 text-border">·</span>
          <Link href="/about" className="underline-offset-4 hover:underline hover:text-foreground">
            About
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/signup"
            className="underline-offset-4 hover:underline hover:text-foreground"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
