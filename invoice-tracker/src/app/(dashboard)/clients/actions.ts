"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AnalyticsEvent, trackEvent } from "@/lib/analytics";
import { emptyToNull, isValidEmail, readTrimmed } from "@/lib/form";
import { requireUser } from "@/lib/auth/session";
import { isClientId } from "@/lib/clients/queries";
import { countInvoicesForClient } from "@/lib/invoices/queries";
import type { ClientListItem } from "@/types/database";

export type ClientFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  saved?: boolean;
};

export type QuickClientState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  client?: ClientListItem;
};

type ClientFields = {
  name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
};

function parseClientFields(formData: FormData): {
  fieldErrors: NonNullable<ClientFormState["fieldErrors"]>;
  values?: ClientFields;
} {
  const name = readTrimmed(formData, "name");
  const email = readTrimmed(formData, "email");
  const fieldErrors: NonNullable<ClientFormState["fieldErrors"]> = {};

  if (!name) {
    fieldErrors.name = "Enter a name.";
  }
  if (!email) {
    fieldErrors.email = "Enter an email.";
  } else if (!isValidEmail(email)) {
    fieldErrors.email = "Enter a valid email.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return {
    fieldErrors: {},
    values: {
      name,
      email,
      company_name: emptyToNull(readTrimmed(formData, "company_name")),
      phone: emptyToNull(readTrimmed(formData, "phone")),
      address_line_1: emptyToNull(readTrimmed(formData, "address_line_1")),
      address_line_2: emptyToNull(readTrimmed(formData, "address_line_2")),
      city: emptyToNull(readTrimmed(formData, "city")),
      province: emptyToNull(readTrimmed(formData, "province")),
      postal_code: emptyToNull(readTrimmed(formData, "postal_code")),
      country: emptyToNull(readTrimmed(formData, "country")),
      notes: emptyToNull(readTrimmed(formData, "notes")),
    },
  };
}

function revalidateClientPaths(id?: string) {
  revalidatePath("/clients");
  revalidatePath("/invoices");
  revalidatePath("/invoices/new");
  if (id) {
    revalidatePath(`/clients/${id}`);
  }
}

export async function createClient(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const { supabase, user } = await requireUser();
  const parsed = parseClientFields(formData);

  if (!parsed.values) {
    return {
      error: "Check the highlighted fields and try again.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      ...parsed.values,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "We couldn't save this client. Your changes were not stored." };
  }

  revalidateClientPaths(data.id);
  trackEvent(AnalyticsEvent.ClientCreated);
  redirect(`/clients/${data.id}`);
}

export async function createClientInline(
  _previous: QuickClientState,
  formData: FormData,
): Promise<QuickClientState> {
  const { supabase, user } = await requireUser();
  const parsed = parseClientFields(formData);

  if (!parsed.values) {
    return {
      error: "Check the highlighted fields and try again.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      ...parsed.values,
    })
    .select("id, name, company_name, email, phone")
    .single();

  if (error || !data) {
    return { error: "We couldn't save this client. Your changes were not stored." };
  }

  revalidateClientPaths(data.id);
  trackEvent(AnalyticsEvent.ClientCreated);
  return { client: data };
}

export async function updateClient(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const { supabase, user } = await requireUser();
  const id = readTrimmed(formData, "id");

  if (!isClientId(id)) {
    return { error: "This client could not be found." };
  }

  const parsed = parseClientFields(formData);

  if (!parsed.values) {
    return {
      error: "Check the highlighted fields and try again.",
      fieldErrors: parsed.fieldErrors,
    };
  }

  const { data, error } = await supabase
    .from("clients")
    .update(parsed.values)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "We couldn't save this client. Your changes were not stored." };
  }

  if (!data) {
    return { error: "This client could not be found." };
  }

  revalidateClientPaths(id);
  return { saved: true };
}

export async function deleteClient(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const { supabase, user } = await requireUser();
  const id = readTrimmed(formData, "id");

  if (!isClientId(id)) {
    return { error: "This client could not be found." };
  }

  const invoiceCount = await countInvoicesForClient(id);
  if (invoiceCount > 0) {
    return {
      error: "This client has invoices and cannot be deleted.",
    };
  }

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23503") {
      return { error: "This client has invoices and cannot be deleted." };
    }
    return { error: "We couldn't delete this client." };
  }

  if (!data) {
    return { error: "This client could not be found." };
  }

  revalidateClientPaths(id);
  redirect("/clients");
}
