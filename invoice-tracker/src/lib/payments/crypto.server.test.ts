import { describe, expect, it } from "vitest";

import {
  decryptPaymentToken,
  encryptPaymentToken,
  parsePaymentTokenEncryptionKey,
} from "@/lib/payments/crypto.server";
import { PaymentError } from "@/lib/payments/errors";

const KEY = parsePaymentTokenEncryptionKey("ab".repeat(32));

describe("payment token encryption", () => {
  it("round-trips plaintext", () => {
    const envelope = encryptPaymentToken("seller-access-token", KEY);
    expect(decryptPaymentToken(envelope, { v1: KEY })).toBe("seller-access-token");
  });

  it("uses a unique IV for each encryption", () => {
    const first = JSON.parse(encryptPaymentToken("token", KEY)) as { iv: string };
    const second = JSON.parse(encryptPaymentToken("token", KEY)) as { iv: string };
    expect(first.iv).not.toBe(second.iv);
  });

  it("fails closed when ciphertext is tampered", () => {
    const envelope = JSON.parse(encryptPaymentToken("token", KEY)) as {
      ciphertext: string;
      iv: string;
      tag: string;
      v: number;
      alg: string;
      kid: string;
    };
    envelope.ciphertext = Buffer.from("tampered")
      .toString("base64");
    expect(() => decryptPaymentToken(JSON.stringify(envelope), { v1: KEY })).toThrow(
      PaymentError,
    );
    try {
      decryptPaymentToken(JSON.stringify(envelope), { v1: KEY });
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentError);
      if (error instanceof PaymentError) {
        expect(error.code).toBe("PAYMENT_CRYPTO_TAMPERED");
      }
    }
  });

  it("can decrypt with a rotated key id", () => {
    const nextKey = parsePaymentTokenEncryptionKey("cd".repeat(32));
    const envelope = encryptPaymentToken("rotated", nextKey, "v2");
    expect(decryptPaymentToken(envelope, { v1: KEY, v2: nextKey })).toBe("rotated");
  });
});
