export function formatInvoiceNumber(prefix: string, nextNumber: number) {
  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}
