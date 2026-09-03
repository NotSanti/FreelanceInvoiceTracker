import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    return { error: "Missing SUPABASE_SERVICE_ROLE_KEY." } as const;
  }
  return { key } as const;
}

export function createServiceClient() {
  const { url } = getSupabaseEnv();
  const service = getServiceRoleKey();
  if ("error" in service) {
    throw new Error(service.error);
  }

  return createClient<Database>(url, service.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
