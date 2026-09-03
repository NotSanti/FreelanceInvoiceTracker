"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AnalyticsEvent, trackEvent } from "@/lib/analytics";
import { getAppUrl } from "@/lib/app-url";
import { isValidEmail, readTrimmed } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  notice?: string;
};

function credentialsFromForm(formData: FormData) {
  const email = readTrimmed(formData, "email").toLowerCase();
  const password =
    typeof formData.get("password") === "string"
      ? (formData.get("password") as string)
      : "";

  if (!isValidEmail(email) || password.length === 0) {
    return { error: "Enter a valid email and password." } as const;
  }

  return { email, password } as const;
}

export async function signIn(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsFromForm(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    return {
      error: "We couldn't sign you in. Check your email and password.",
    };
  }

  revalidatePath("/", "layout");
  trackEvent(AnalyticsEvent.SignIn);
  redirect("/");
}

export async function createAccount(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsFromForm(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  if (parsed.password.length < 8) {
    return { error: "Use a password with at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      // Used by our custom confirmation email template to build the correct
      // token exchange URL (avoids Supabase SiteURL mismatches like localhost).
      emailRedirectTo: getAppUrl(),
    },
  });

  if (error) {
    console.error("createAccount failed", error.message);
    if (error.code === "email_address_invalid") {
      return { error: "That email address isn't allowed. Use a real inbox address." };
    }
    return {
      error: "We couldn't create this account. Try a different email.",
    };
  }

  trackEvent(AnalyticsEvent.AccountCreated);

  if (!data.session) {
    return {
      notice:
        "Account created. Check your inbox for the verification email, then use the link to finish signing in.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
