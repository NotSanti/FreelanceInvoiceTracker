/**
 * Multi-user SaaS: public signup is on unless explicitly disabled.
 * Set NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP=false to lock registration.
 * Keep Supabase Auth "Allow new users" enabled to match.
 */
export function isPublicSignupAllowed() {
  return process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP !== "false";
}
