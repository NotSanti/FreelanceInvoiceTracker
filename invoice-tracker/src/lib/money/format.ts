const DEFAULT_CURRENCY = "CAD";
const DEFAULT_LOCALE = "en-CA";

export function formatCurrency(
  amountCents: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}
