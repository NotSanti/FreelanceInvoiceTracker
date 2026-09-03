import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function getProfile(): Promise<Profile> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("We could not load your profile.");
  }

  if (!data) {
    const email = user.email ?? "";
    const { data: created, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email,
        display_name: email.split("@")[0] ?? "",
      })
      .select("*")
      .single();

    if (insertError || !created) {
      throw new Error("We could not create your profile.");
    }

    return created;
  }

  if (user.email && data.email !== user.email) {
    const { data: updated } = await supabase
      .from("profiles")
      .update({ email: user.email })
      .eq("id", user.id)
      .select("*")
      .single();

    return updated ?? { ...data, email: user.email };
  }

  return data;
}

export function getAccountLabel(profile: Pick<Profile, "display_name" | "business_name" | "email">) {
  return profile.display_name || profile.business_name || profile.email;
}
