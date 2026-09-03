import { todayISODate } from "@/lib/dates";

export function currentTaxYear(today = todayISODate()) {
  return Number(today.slice(0, 4));
}

export function readTaxYear(
  value: string | string[] | undefined,
  today = todayISODate(),
) {
  const raw = Array.isArray(value) ? value[0] : value;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return currentTaxYear(today);
  }
  return year;
}

export function availableTaxYears(today = todayISODate()) {
  const current = currentTaxYear(today);
  return [current - 1, current];
}
