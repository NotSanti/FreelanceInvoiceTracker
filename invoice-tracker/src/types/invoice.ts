export type StoredInvoiceStatus = "draft" | "sent" | "paid" | "void";

export type DisplayInvoiceStatus = StoredInvoiceStatus | "overdue";

export type InvoiceStatus = DisplayInvoiceStatus | "due_soon";
