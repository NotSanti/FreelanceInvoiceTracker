import { LIMITS, hasControlChars, withinLength } from "@/config/limits";

export function readTrimmed(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function emptyToNull(value: string) {
  return value.length === 0 ? null : value;
}

export function isValidEmail(value: string) {
  if (!withinLength(value, LIMITS.email) || hasControlChars(value)) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseTaxRate(value: string) {
  if (!value) {
    return { value: null } as const;
  }

  if (!/^\d+(\.\d{1,4})?$/.test(value)) {
    return { error: "Enter a tax rate such as 14.975." } as const;
  }

  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { error: "Tax rate must be between 0 and 100." } as const;
  }

  return { value: rate } as const;
}

export function parsePercent(value: string, fallback = 100) {
  if (!value) {
    return { value: fallback } as const;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return { error: "Enter a percentage such as 100." } as const;
  }

  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { error: "Use a percentage between 0 and 100." } as const;
  }

  return { value: percent } as const;
}

export function parseQuantity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: "Enter a quantity." } as const;
  }

  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) {
    return { error: "Enter a quantity such as 1 or 3.5." } as const;
  }

  const quantity = Number(trimmed);
  if (!(quantity > 0) || !Number.isFinite(quantity)) {
    return { error: "Quantity must be greater than 0." } as const;
  }

  if (quantity > LIMITS.quantityMax) {
    return { error: "Quantity is too large." } as const;
  }

  return { value: quantity } as const;
}

export function boundOptionalText(
  value: string,
  max: number,
): { value: string | null } | { error: string } {
  if (!value) {
    return { value: null };
  }
  if (hasControlChars(value) && max < 500) {
    return { error: "Remove invalid characters." };
  }
  if (!withinLength(value, max)) {
    return { error: `Keep this under ${max} characters.` };
  }
  return { value };
}

export function boundRequiredText(
  value: string,
  max: number,
  emptyMessage: string,
): { value: string } | { error: string } {
  if (!value) {
    return { error: emptyMessage };
  }
  if (!withinLength(value, max)) {
    return { error: `Keep this under ${max} characters.` };
  }
  return { value };
}
