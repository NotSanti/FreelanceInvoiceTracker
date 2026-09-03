import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

function applyAuthResponse(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });

  for (const header of ["cache-control", "expires", "pragma"] as const) {
    const value = from.headers.get(header);
    if (value) {
      to.headers.set(header, value);
    }
  }

  return to;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");
  const isPublicInvoice = pathname.startsWith("/invoice/");
  const isStripeWebhook = pathname.startsWith("/api/stripe/");
  const isMarketingAbout =
    pathname === "/about" || pathname.startsWith("/about/");
  const isMarketingWelcome =
    pathname === "/welcome" || pathname.startsWith("/welcome/");
  const isPublicStatic =
    pathname === "/manifest.webmanifest" || pathname === "/sw.js";
  const isPublicRoute =
    isLoginRoute ||
    isPublicInvoice ||
    isStripeWebhook ||
    isMarketingAbout ||
    isMarketingWelcome ||
    isPublicStatic;

  if (!user && pathname === "/") {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/welcome";
    return applyAuthResponse(
      supabaseResponse,
      NextResponse.rewrite(rewriteUrl),
    );
  }

  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return applyAuthResponse(supabaseResponse, NextResponse.redirect(redirectUrl));
  }

  if (user && isLoginRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return applyAuthResponse(supabaseResponse, NextResponse.redirect(redirectUrl));
  }

  if (user && isMarketingWelcome) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return applyAuthResponse(supabaseResponse, NextResponse.redirect(redirectUrl));
  }

  return supabaseResponse;
}
