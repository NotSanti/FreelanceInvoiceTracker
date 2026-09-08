import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
];

const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // Report-only: Next.js still requires inline/bootstrap scripts until nonces are wired.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://js.stripe.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
  "worker-src 'self'",
  "manifest-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...baseSecurityHeaders,
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
          },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
      {
        source: "/invoice/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
