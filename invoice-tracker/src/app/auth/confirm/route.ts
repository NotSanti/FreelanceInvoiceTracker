import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

const LOGIN_PATH = "/login";
const DEFAULT_NEXT_PATH = "/";

function sanitizeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return DEFAULT_NEXT_PATH;
  }

  return next;
}

function buildLoginUrl(request: NextRequest, key: "notice" | "error", message: string) {
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = "";
  url.searchParams.set(key, message);
  return url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = nextPath;
  redirectUrl.search = "";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      buildLoginUrl(
        request,
        "error",
        "That verification link is incomplete. Request a new account email and try again.",
      ),
    );
  }

  const response = NextResponse.redirect(redirectUrl);
  const { url, publishableKey } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      buildLoginUrl(
        request,
        "error",
        "That verification link has expired or is no longer valid. Create the account again to get a fresh email.",
      ),
    );
  }

  return response;
}
