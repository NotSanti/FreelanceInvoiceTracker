const TIME_ZONE = "America/Toronto";

export function todayISODate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return parseISODate(value).toISOString().slice(0, 10) === value;
}

export function addDaysISO(isoDate: string, days: number) {
  const date = parseISODate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatISODate(
  isoDate: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  },
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    ...options,
  }).format(parseISODate(isoDate));
}

export function formatISODateLong(isoDate: string) {
  return formatISODate(isoDate, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function toAppISODate(value: string | Date) {
  if (typeof value === "string" && isISODate(value)) {
    return value;
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.");
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfMonthISO(isoDate: string) {
  return `${isoDate.slice(0, 7)}-01`;
}

export function endOfMonthISO(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return formatParts(year, month, lastDay);
}

export function startOfYearISO(isoDate: string) {
  return `${isoDate.slice(0, 4)}-01-01`;
}

export function endOfYearISO(isoDate: string) {
  return `${isoDate.slice(0, 4)}-12-31`;
}

export function addMonthsISO(isoDate: string, months: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = date.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return formatParts(nextYear, nextMonth, Math.min(day, lastDay));
}

export function isDateInRange(isoDate: string, start: string, end: string) {
  return isoDate >= start && isoDate <= end;
}

export function formatMonthYear(isoDate: string) {
  return formatISODate(isoDate, { month: "long", year: "numeric" });
}

export function formatMonthShort(isoDate: string) {
  return formatISODate(isoDate, { month: "short" });
}

function formatParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseISODate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
