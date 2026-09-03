const QUANTITY_SCALE = 10_000;
const TAX_RATE_SCALE = 10_000;

export type InvoiceLineInput = {
  quantity: number;
  unitPriceCents: number;
};

export type InvoiceTotals = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

function assertSafeCents(value: number, label: string) {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of cents.`);
  }
}

export function lineAmountCents(quantity: number, unitPriceCents: number) {
  assertSafeCents(unitPriceCents, "Unit price");
  if (!(quantity > 0) || !Number.isFinite(quantity)) {
    throw new Error("Quantity must be a positive number.");
  }

  const quantityScaled = Math.round(quantity * QUANTITY_SCALE);
  return Math.round((quantityScaled * unitPriceCents) / QUANTITY_SCALE);
}

export function calculateTax(taxableCents: number, taxRatePercent: number) {
  assertSafeCents(taxableCents, "Taxable amount");
  if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
    throw new Error("Tax rate must be between 0 and 100.");
  }

  const rateScaled = Math.round(taxRatePercent * TAX_RATE_SCALE);
  return Math.round((taxableCents * rateScaled) / (TAX_RATE_SCALE * 100));
}

export function calculateInvoiceTotals({
  items,
  discountCents = 0,
  taxRatePercent,
}: {
  items: InvoiceLineInput[];
  discountCents?: number;
  taxRatePercent: number | null;
}): InvoiceTotals {
  assertSafeCents(discountCents, "Discount");

  const subtotalCents = items.reduce(
    (sum, item) => sum + lineAmountCents(item.quantity, item.unitPriceCents),
    0,
  );
  const appliedDiscountCents = Math.min(Math.max(discountCents, 0), subtotalCents);
  const taxableCents = subtotalCents - appliedDiscountCents;
  const taxCents =
    taxRatePercent === null || taxRatePercent === 0
      ? 0
      : calculateTax(taxableCents, taxRatePercent);

  return {
    subtotalCents,
    discountCents: appliedDiscountCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}

export function previewInvoiceTotals({
  items,
  discountCents = 0,
  taxRatePercent,
}: {
  items: Array<{ quantity: number; unitPriceCents: number }>;
  discountCents?: number;
  taxRatePercent: number | null;
}): InvoiceTotals {
  const validItems = items.filter(
    (item) =>
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      Number.isInteger(item.unitPriceCents) &&
      item.unitPriceCents >= 0,
  );
  const safeDiscount =
    Number.isInteger(discountCents) && discountCents >= 0 ? discountCents : 0;
  const safeRate =
    taxRatePercent === null ||
    (Number.isFinite(taxRatePercent) && taxRatePercent >= 0 && taxRatePercent <= 100)
      ? taxRatePercent
      : null;

  try {
    return calculateInvoiceTotals({
      items: validItems,
      discountCents: safeDiscount,
      taxRatePercent: safeRate,
    });
  } catch {
    return {
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: 0,
    };
  }
}

export function calculateBalanceRemaining(totalCents: number, paidCents: number) {
  assertSafeCents(totalCents, "Total");
  assertSafeCents(paidCents, "Paid amount");
  return Math.max(totalCents - paidCents, 0);
}

export function paidCentsFromStoredStatus(
  status: "draft" | "sent" | "paid" | "void",
  totalCents: number,
) {
  return status === "paid" ? totalCents : 0;
}
