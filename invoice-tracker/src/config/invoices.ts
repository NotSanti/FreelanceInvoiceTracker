export const DEFAULT_INVOICE_DUE_DAYS = 14;

export const INVOICE_CURRENCIES = ["CAD", "USD"] as const;

export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number];

export const MAX_INVOICE_LINE_ITEMS = 40;

export const INVOICE_LIST_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
] as const;

export type InvoiceListFilter = (typeof INVOICE_LIST_FILTERS)[number]["value"];
