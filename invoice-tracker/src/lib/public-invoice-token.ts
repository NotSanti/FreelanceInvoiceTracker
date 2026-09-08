const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPublicToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

export function redactPublicInvoicePath(pathname: string) {
  return pathname.replace(
    /^(\/invoice\/)[0-9a-f-]{36}/i,
    "$1[redacted]",
  );
}
