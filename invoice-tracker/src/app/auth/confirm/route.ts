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

  const { url, publishableKey } = getSupabaseEnv();

  // We must create the response first so that setAll can write session cookies
  // onto it. But we also need to handle the error case, so we track success
  // and build the final redirect after verifyOtp completes.
  let response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Forward incoming request cookies so the supabase client sees them.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        // Rebuild the response to pick up the forwarded request cookies.
        response = NextResponse.redirect(redirectUrl);

        // Write session cookies onto the outgoing response.
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        // Forward any cache-control / auth headers the client emits.
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        }
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
