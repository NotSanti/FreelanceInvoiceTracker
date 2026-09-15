import { afterEach, describe, expect, it } from "vitest";

import { PaymentError } from "@/lib/payments/errors";
import { createFakePaymentAdapter } from "@/lib/payments/providers/fake";
import {
  createPaymentProviderRegistry,
  isPaymentProviderEnabled,
} from "@/lib/payments/registry";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env.PAYMENTS_STRIPE_ENABLED = originalEnv.PAYMENTS_STRIPE_ENABLED;
  process.env.PAYMENTS_SQUARE_ENABLED = originalEnv.PAYMENTS_SQUARE_ENABLED;
  process.env.PAYMENTS_PAYPAL_ENABLED = originalEnv.PAYMENTS_PAYPAL_ENABLED;
});

describe("payment provider registry", () => {
  it("returns a registered adapter", () => {
    const fake = createFakePaymentAdapter("square");
    const registry = createPaymentProviderRegistry([fake], () => true);
    expect(registry.get("square").provider).toBe("square");
  });

  it("rejects an invalid provider", () => {
    const registry = createPaymentProviderRegistry([], () => true);
    expect(() => registry.get("venmo")).toThrow(PaymentError);
    try {
      registry.get("venmo");
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentError);
      if (error instanceof PaymentError) {
        expect(error.code).toBe("PAYMENT_PROVIDER_INVALID");
      }
    }
  });

  it("rejects a disabled provider", () => {
    const fake = createFakePaymentAdapter("paypal");
    const registry = createPaymentProviderRegistry([fake], () => false);
    try {
      registry.get("paypal");
      throw new Error("expected disable");
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentError);
      if (error instanceof PaymentError) {
        expect(error.code).toBe("PAYMENT_PROVIDER_DISABLED");
      }
    }
  });

  it("defaults PayPal to disabled", () => {
    delete process.env.PAYMENTS_PAYPAL_ENABLED;
    expect(isPaymentProviderEnabled("paypal")).toBe(false);
    process.env.PAYMENTS_PAYPAL_ENABLED = "true";
    expect(isPaymentProviderEnabled("paypal")).toBe(true);
  });
});
