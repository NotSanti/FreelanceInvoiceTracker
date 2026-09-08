import { describe, expect, it } from "vitest";

import { parseMoneyToCents } from "@/lib/money/parse";
import { LIMITS } from "@/config/limits";
import {
  isPublicToken,
  redactPublicInvoicePath,
} from "@/lib/public-invoice-token";
import {
  validatePushEndpoint,
  validatePushKeys,
} from "@/lib/push/validate-endpoint";
import { consumeRateLimit } from "@/lib/security/rate-limit";

describe("parseMoneyToCents bounds", () => {
  it("accepts a normal amount", () => {
    expect(parseMoneyToCents("12.34")).toEqual({ value: 1234 });
  });

  it("rejects unsafe magnitudes", () => {
    const huge = `${"9".repeat(20)}.99`;
    expect(parseMoneyToCents(huge)).toEqual({ error: "Amount is too large." });
  });

  it("rejects values above the business max", () => {
    const over = String(Math.floor(LIMITS.moneyMaxCents / 100) + 1);
    const result = parseMoneyToCents(over);
    expect("error" in result).toBe(true);
  });
});

describe("public invoice token helpers", () => {
  it("validates uuid tokens", () => {
    expect(isPublicToken("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isPublicToken("not-a-token")).toBe(false);
  });

  it("redacts bearer paths", () => {
    expect(
      redactPublicInvoicePath("/invoice/550e8400-e29b-41d4-a716-446655440000"),
    ).toBe("/invoice/[redacted]");
  });
});

describe("push endpoint validation", () => {
  it("accepts an FCM https endpoint", () => {
    const result = validatePushEndpoint(
      "https://fcm.googleapis.com/fcm/send/abc123",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects http, localhost, and private hosts", () => {
    expect(validatePushEndpoint("http://fcm.googleapis.com/x").ok).toBe(false);
    expect(validatePushEndpoint("https://localhost/push").ok).toBe(false);
    expect(validatePushEndpoint("https://127.0.0.1/push").ok).toBe(false);
    expect(validatePushEndpoint("https://192.168.1.1/push").ok).toBe(false);
    expect(validatePushEndpoint("https://evil.example/push").ok).toBe(false);
  });

  it("rejects short keys", () => {
    expect(validatePushKeys("short", "short").ok).toBe(false);
  });
});

describe("rate limit", () => {
  it("blocks after the configured limit", () => {
    const key = `test-${Math.random()}`;
    expect(consumeRateLimit({ key, limit: 2, windowMs: 60_000 }).ok).toBe(true);
    expect(consumeRateLimit({ key, limit: 2, windowMs: 60_000 }).ok).toBe(true);
    const blocked = consumeRateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
