import { cache } from "react";

import { requireUser } from "@/lib/auth/session";
import { getDisplayStatus } from "@/lib/invoice/status";
import { paidCentsFromPayments } from "@/lib/payments/totals";
import { todayISODate } from "@/lib/dates";
import type { InvoiceListFilter } from "@/config/invoices";
import type { Client, Invoice, InvoiceItem, InvoiceListRow, Payment } from "@/types/database";
import type { DisplayInvoiceStatus } from "@/types/invoice";

const INVOICE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInvoiceId(value: string) {
  return INVOICE_ID_PATTERN.test(value);
}

export type InvoiceListItem = InvoiceListRow & {
  displayStatus: DisplayInvoiceStatus;
  paidCents: number;
};

export type InvoiceDetail = Invoice & {
  clients: Pick<
    Client,
    | "id"
    | "name"
    | "company_name"
    | "email"
    | "phone"
    | "address_line_1"
    | "address_line_2"
    | "city"
    | "province"
    | "postal_code"
    | "country"
  >;
  invoice_items: InvoiceItem[];
  payments: Payment[];
  paidCents: number;
  displayStatus: DisplayInvoiceStatus;
};

function toNumber(value: number | string | null | undefined, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return typeof value === "number" ? value : Number(value);
}

function withNumericItem(item: InvoiceItem): InvoiceItem {
  return {
    ...item,
    quantity: toNumber(item.quantity),
    unit_price_cents: toNumber(item.unit_price_cents),
    amount_cents: toNumber(item.amount_cents),
  };
}

function withNumericInvoice<T extends Invoice>(invoice: T): T {
  return {
    ...invoice,
    subtotal_cents: toNumber(invoice.subtotal_cents),
    discount_cents: toNumber(invoice.discount_cents),
    tax_cents: toNumber(invoice.tax_cents),
    total_cents: toNumber(invoice.total_cents),
    taxable_subtotal_cents: toNumber(
      invoice.taxable_subtotal_cents,
      toNumber(invoice.subtotal_cents) - toNumber(invoice.discount_cents),
    ),
    gst_cents: toNumber(invoice.gst_cents),
    qst_cents: toNumber(invoice.qst_cents),
    gst_rate:
      invoice.gst_rate === null || invoice.gst_rate === undefined
        ? null
        : toNumber(invoice.gst_rate),
    qst_rate:
      invoice.qst_rate === null || invoice.qst_rate === undefined
        ? null
        : toNumber(invoice.qst_rate),
    tax_rate:
      invoice.tax_rate === null || invoice.tax_rate === undefined
        ? null
        : toNumber(invoice.tax_rate),
  };
}

function withNumericPayment(payment: Payment): Payment {
  return {
    ...payment,
    amount_cents: toNumber(payment.amount_cents),
  };
}

function invoicePayments(payments: Payment[] | null | undefined) {
  return [...(payments ?? [])]
    .map(withNumericPayment)
    .sort((a, b) => {
      if (a.paid_on !== b.paid_on) {
        return a.paid_on.localeCompare(b.paid_on);
      }
      return a.created_at.localeCompare(b.created_at);
    });
}

function matchesQuery(invoice: InvoiceListRow, query: string) {
  const haystack = [
    invoice.invoice_number,
    invoice.clients.name,
    invoice.clients.company_name ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export async function listInvoices({
  status = "all",
  query = "",
}: {
  status?: InvoiceListFilter;
  query?: string;
} = {}): Promise<InvoiceListItem[]> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "*, clients!inner(id, name, company_name), payments(*)",
    )
    .eq("user_id", user.id)
    .order("issue_date", { ascending: false })
    .order("invoice_number", { ascending: false });

  if (error) {
    throw new Error("We could not load your invoices.");
  }

  const today = todayISODate();
  const normalizedQuery = query.trim().toLowerCase();

  return (data ?? [])
    .map((row) => {
      const invoice = withNumericInvoice(row as InvoiceListRow);
      const payments = invoicePayments(invoice.payments);
      const paidCents = paidCentsFromPayments(
        payments.map((payment) => ({ amountCents: payment.amount_cents })),
      );
      return {
        ...invoice,
        payments,
        paidCents,
        displayStatus: getDisplayStatus({
          status: invoice.status,
          dueDate: invoice.due_date,
          totalCents: invoice.total_cents,
          paidCents,
          today,
        }),
      };
    })
    .filter((invoice) => {
      if (status !== "all" && invoice.displayStatus !== status) {
        return false;
      }
      if (normalizedQuery && !matchesQuery(invoice, normalizedQuery)) {
        return false;
      }
      return true;
    });
}

export const getInvoice = cache(
  async (id: string): Promise<InvoiceDetail | null> => {
    if (!isInvoiceId(id)) {
      return null;
    }

    const { supabase, user } = await requireUser();

    const { data, error } = await supabase
      .from("invoices")
      .select(
        "*, clients!inner(id, name, company_name, email, phone, address_line_1, address_line_2, city, province, postal_code, country), invoice_items(*), payments(*)",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error("We could not load this invoice.");
    }

    if (!data) {
      return null;
    }

    const invoice = withNumericInvoice(data as InvoiceDetail);
    const items = [...invoice.invoice_items]
      .map(withNumericItem)
      .sort((a, b) => a.position - b.position);
    const payments = invoicePayments(
      (data as InvoiceDetail).payments,
    );
    const paidCents = paidCentsFromPayments(
      payments.map((payment) => ({ amountCents: payment.amount_cents })),
    );

    return {
      ...invoice,
      invoice_items: items,
      payments,
      paidCents,
      displayStatus: getDisplayStatus({
        status: invoice.status,
        dueDate: invoice.due_date,
        totalCents: invoice.total_cents,
        paidCents,
        today: todayISODate(),
      }),
    };
  },
);

export async function countInvoicesForClient(clientId: string) {
  const { supabase, user } = await requireUser();

  const { count, error } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("client_id", clientId);

  if (error) {
    throw new Error("We could not check this client's invoices.");
  }

  return count ?? 0;
}
