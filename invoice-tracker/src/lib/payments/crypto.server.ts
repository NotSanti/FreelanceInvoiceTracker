import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { PaymentError } from "@/lib/payments/errors";

export type PaymentTokenEnvelopeV1 = {
  v: 1;
  alg: "A256GCM";
  kid: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const DEFAULT_KID = "v1";

export function parsePaymentTokenEncryptionKey(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) {
    throw new PaymentError("PAYMENT_CRYPTO_KEY_INVALID");
  }

  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }

  const asBase64 = Buffer.from(value, "base64");
  if (asBase64.length === KEY_LENGTH) {
    return asBase64;
  }

  throw new PaymentError("PAYMENT_CRYPTO_KEY_INVALID");
}

export function getPaymentTokenEncryptionKey() {
  return parsePaymentTokenEncryptionKey(process.env.PAYMENT_TOKEN_ENCRYPTION_KEY);
}

export function encryptPaymentToken(
  plaintext: string,
  key = getPaymentTokenEncryptionKey(),
  kid = DEFAULT_KID,
): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: PaymentTokenEnvelopeV1 = {
    v: 1,
    alg: "A256GCM",
    kid,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  return JSON.stringify(envelope);
}

export function decryptPaymentToken(
  serialized: string,
  keys: Record<string, Buffer> = { [DEFAULT_KID]: getPaymentTokenEncryptionKey() },
): string {
  let envelope: PaymentTokenEnvelopeV1;
  try {
    envelope = JSON.parse(serialized) as PaymentTokenEnvelopeV1;
  } catch {
    throw new PaymentError("PAYMENT_CRYPTO_TAMPERED");
  }

  if (envelope.v !== 1 || envelope.alg !== "A256GCM" || !envelope.iv || !envelope.tag || !envelope.ciphertext) {
    throw new PaymentError("PAYMENT_CRYPTO_TAMPERED");
  }

  const key = keys[envelope.kid] ?? keys[DEFAULT_KID];
  if (!key) {
    throw new PaymentError("PAYMENT_CRYPTO_KEY_INVALID");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new PaymentError("PAYMENT_CRYPTO_TAMPERED");
  }
}
