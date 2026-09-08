import { LIMITS } from "@/config/limits";

export function parseMoneyToCents(value: string) {
  const trimmed = value.trim().replace(/[$\s,]/g, "");
  if (!trimmed) {
    return { value: 0 } as const;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { error: "Enter an amount like 1500.00." } as const;
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const cents =
    Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));

  if (!Number.isFinite(cents) || !Number.isSafeInteger(cents)) {
    return { error: "Amount is too large." } as const;
  }

  if (cents < 0 || cents > LIMITS.moneyMaxCents) {
    return { error: "Amount is out of range." } as const;
  }

  return { value: cents } as const;
}

export function formatCentsForInput(cents: number) {
  if (cents === 0) {
    return "";
  }

  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}
