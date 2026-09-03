import { cache } from "react";

import { requireUser } from "@/lib/auth/session";
import type { Client, ClientListItem } from "@/types/database";

const CLIENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isClientId(value: string) {
  return CLIENT_ID_PATTERN.test(value);
}

export async function listClients(): Promise<ClientListItem[]> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, company_name, email, phone")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("We could not load your clients.");
  }

  return data ?? [];
}

export const getClient = cache(async (id: string): Promise<Client | null> => {
  if (!isClientId(id)) {
    return null;
  }

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("We could not load this client.");
  }

  return data;
});
