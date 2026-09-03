import { createClient } from "@/lib/supabase/server";
import { createServiceClient, getServiceRoleKey } from "@/lib/supabase/service";
import { paidCentsFromPayments } from "@/lib/payments/totals";
import type { Json } from "@/types/database";

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPublicToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

export type PublicInvoiceRecord = {
  invoice: {
    invoice_number: string;
    public_token: string;
    status: "sent" | "paid";
    currency: string;
    issue_date: string;
    due_date: string | null;
    subtotal_cents: number;
    discount_cents: number;
    tax_cents: number;
    tax_name: string | null;
    tax_rate: number | null;
    gst_rate: number | null;
    gst_cents: number;
    qst_rate: number | null;
    qst_cents: number;
    total_cents: number;
    payment_instructions: string | null;
    paid_at: string | null;
  };
  profile: {
    business_name: string;
    display_name: string;
    email: string;
    phone: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    country: string | null;
    tax_registration_number: string | null;
    is_gst_qst_registered: boolean;
    gst_registration_number: string | null;
    qst_registration_number: string | null;
  };
  client: {
    name: string;
    company_name: string | null;
    email: string;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    country: string | null;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit_price_cents: number;
    amount_cents: number;
    position: number;
  }>;
  payments: Array<{
    amount_cents: number;
    paid_on: string;
    method: string;
  }>;
};

function asRecord(value: Json | null): PublicInvoiceRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as unknown as PublicInvoiceRecord;
}

export async function getPublicInvoice(publicToken: string) {
  if (!isPublicToken(publicToken)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_invoice", {
    p_token: publicToken,
  });

  if (error) {
    throw new Error("We could not load this invoice.");
  }

  const record = asRecord(data);
  if (!record?.invoice) {
    return null;
  }

  const paidCents = paidCentsFromPayments(
    (record.payments ?? []).map((payment) => ({
      amountCents: Number(payment.amount_cents),
    })),
  );

  return {
    ...record,
    paidCents,
    remainingCents: Math.max(Number(record.invoice.total_cents) - paidCents, 0),
  };
}

export async function markPublicInvoiceViewed(publicToken: string) {
  if (!isPublicToken(publicToken)) {
    return;
  }

  const supabase = await createClient();
  await supabase.rpc("mark_public_invoice_viewed", { p_token: publicToken });
}

export type InvoiceCheckoutState = {
  invoice_id: string;
  user_id: string;
  invoice_number: string;
  currency: string;
  total_cents: number;
  status: "sent" | "paid";
  paid_cents: number;
};

export async function getInvoiceCheckoutState(publicToken: string) {
  if (!isPublicToken(publicToken)) {
    return null;
  }

  if ("error" in getServiceRoleKey()) {
    return null;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_invoice_checkout_state", {
    p_token: publicToken,
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const row = data as Record<string, unknown>;
  if (typeof row.invoice_id !== "string") {
    return null;
  }

  return {
    invoice_id: row.invoice_id,
    user_id: String(row.user_id),
    invoice_number: String(row.invoice_number),
    currency: String(row.currency),
    total_cents: Number(row.total_cents),
    status: row.status === "paid" ? "paid" : "sent",
    paid_cents: Number(row.paid_cents),
  } satisfies InvoiceCheckoutState;
}
