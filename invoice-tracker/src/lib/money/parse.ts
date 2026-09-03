export function parseMoneyToCents(value: string) {
  const trimmed = value.trim().replace(/[$\s,]/g, "");
  if (!trimmed) {
    return { value: 0 } as const;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { error: "Enter an amount like 1500.00." } as const;
  }

  const [whole, fraction = ""] = trimmed.split(".");
  return {
    value: Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2)),
  } as const;
}

export function formatCentsForInput(cents: number) {
  if (cents === 0) {
    return "";
  }

  const dollars = cents / 100;
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
}
