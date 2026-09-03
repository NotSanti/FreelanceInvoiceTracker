import {
  INVOICE_CURRENCIES,
  MAX_INVOICE_LINE_ITEMS,
  type InvoiceCurrency,
} from "@/config/invoices";
import { isISODate } from "@/lib/dates";
import { emptyToNull, parseQuantity, parseTaxRate, readTrimmed } from "@/lib/form";
import { isClientId } from "@/lib/clients/queries";
import {
  calculateInvoiceTotals,
  lineAmountCents,
  type InvoiceTotals,
} from "@/lib/invoice/totals";
import { parseMoneyToCents } from "@/lib/money/parse";
import { invoiceSalesTaxFromTotals, type SplitSalesTax } from "@/lib/tax/sales-tax";

export type InvoiceDraftItem = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
};

export type InvoiceDraftValues = {
  clientId: string;
  issueDate: string;
  dueDate: string | null;
  currency: InvoiceCurrency;
  discountCents: number;
  taxName: string | null;
  taxRate: number | null;
  notes: string | null;
  paymentInstructions: string | null;
  items: InvoiceDraftItem[];
  totals: InvoiceTotals;
  salesTax: SplitSalesTax;
};

export type InvoiceFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

type RawLineItem = {
  description?: unknown;
  quantity?: unknown;
  rate?: unknown;
};

function isCurrency(value: string): value is InvoiceCurrency {
  return INVOICE_CURRENCIES.some((currency) => currency === value);
}

function parseRateToCents(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: "Enter a rate." } as const;
  }

  return parseMoneyToCents(trimmed);
}

function parseLineItems(raw: string): {
  fieldErrors: NonNullable<InvoiceFormState["fieldErrors"]>;
  items?: InvoiceDraftItem[];
} {
  const fieldErrors: NonNullable<InvoiceFormState["fieldErrors"]> = {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { fieldErrors: { items: "Add at least one line item." } };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { fieldErrors: { items: "Add at least one line item." } };
  }

  if (parsed.length > MAX_INVOICE_LINE_ITEMS) {
    return {
      fieldErrors: {
        items: `Use ${MAX_INVOICE_LINE_ITEMS} line items or fewer.`,
      },
    };
  }

  const items: InvoiceDraftItem[] = [];

  parsed.forEach((entry, index) => {
    const line = entry as RawLineItem;
    const description = typeof line.description === "string" ? line.description.trim() : "";
    const quantityValue = typeof line.quantity === "string" ? line.quantity : "";
    const rateValue = typeof line.rate === "string" ? line.rate : "";
    const isEmpty = !description && !quantityValue.trim() && !rateValue.trim();

    if (isEmpty) {
      return;
    }

    if (!description) {
      fieldErrors[`item_${index}_description`] = "Enter a description.";
    }

    const quantity = parseQuantity(quantityValue);
    if ("error" in quantity) {
      fieldErrors[`item_${index}_quantity`] = quantity.error;
    }

    const rate = parseRateToCents(rateValue);
    if ("error" in rate) {
      fieldErrors[`item_${index}_rate`] = rate.error;
    }

    if (
      description &&
      !("error" in quantity) &&
      !("error" in rate)
    ) {
      items.push({
        description,
        quantity: quantity.value,
        unitPriceCents: rate.value,
        amountCents: lineAmountCents(quantity.value, rate.value),
      });
    }
  });

  if (items.length === 0 && Object.keys(fieldErrors).length === 0) {
    fieldErrors.items = "Add at least one line item.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return { fieldErrors: {}, items };
}

export function parseInvoiceDraft(formData: FormData): {
  fieldErrors: NonNullable<InvoiceFormState["fieldErrors"]>;
  values?: InvoiceDraftValues;
} {
  const clientId = readTrimmed(formData, "client_id");
  const issueDate = readTrimmed(formData, "issue_date");
  const dueDate = readTrimmed(formData, "due_date");
  const currency = readTrimmed(formData, "currency").toUpperCase();
  const taxRateResult = parseTaxRate(readTrimmed(formData, "tax_rate"));
  const discountResult = parseMoneyToCents(readTrimmed(formData, "discount"));
  const lineItems = parseLineItems(readTrimmed(formData, "line_items"));
  const fieldErrors: NonNullable<InvoiceFormState["fieldErrors"]> = {
    ...lineItems.fieldErrors,
  };

  if (!isClientId(clientId)) {
    fieldErrors.client_id = "Choose a client.";
  }
  if (!isISODate(issueDate)) {
    fieldErrors.issue_date = "Enter a valid issue date.";
  }
  if (dueDate) {
    if (!isISODate(dueDate)) {
      fieldErrors.due_date = "Enter a valid due date.";
    } else if (isISODate(issueDate) && dueDate < issueDate) {
      fieldErrors.due_date = "Due date must be on or after the issue date.";
    }
  }
  if (!isCurrency(currency)) {
    fieldErrors.currency = "Choose CAD or USD.";
  }
  if ("error" in taxRateResult) {
    fieldErrors.tax_rate = taxRateResult.error;
  }
  if ("error" in discountResult) {
    fieldErrors.discount = discountResult.error;
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !lineItems.items ||
    !isCurrency(currency) ||
    "error" in taxRateResult ||
    "error" in discountResult
  ) {
    return { fieldErrors };
  }

  const taxRate = taxRateResult.value;
  const totals = calculateInvoiceTotals({
    items: lineItems.items.map((item) => ({
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    discountCents: discountResult.value,
    taxRatePercent: taxRate,
  });
  const salesTax = invoiceSalesTaxFromTotals({
    issueDate,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    taxRatePercent: taxRate,
    taxCents: totals.taxCents,
  });

  return {
    fieldErrors: {},
    values: {
      clientId,
      issueDate,
      dueDate: dueDate || null,
      currency,
      discountCents: totals.discountCents,
      taxName: emptyToNull(readTrimmed(formData, "tax_name")),
      taxRate,
      notes: emptyToNull(readTrimmed(formData, "notes")),
      paymentInstructions: emptyToNull(readTrimmed(formData, "payment_instructions")),
      items: lineItems.items,
      totals,
      salesTax,
    },
  };
}
