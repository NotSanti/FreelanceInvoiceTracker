import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { PaymentError } from "@/lib/payments/errors";
import type { PaymentProvider } from "@/lib/payments/types";
import { isPaymentProvider } from "@/lib/payments/types";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type PaymentOAuthStateRecord = {
  hashedState: string;
  userId: string;
  provider: PaymentProvider;
  returnPath: string | null;
  expiresAt: string;
  consumedAt: string | null;
};

export type PaymentOAuthStateStore = {
  insert(record: Omit<PaymentOAuthStateRecord, "consumedAt">): Promise<void>;
  findByHashedState(hashedState: string): Promise<PaymentOAuthStateRecord | null>;
  markConsumed(hashedState: string, consumedAt: string): Promise<boolean>;
};

export function hashOAuthState(rawState: string) {
  return createHash("sha256").update(rawState).digest("hex");
}

export function createOAuthStateValue() {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hashed: hashOAuthState(raw) };
}

export function sanitizeOAuthReturnPath(returnPath: string | null | undefined) {
  if (!returnPath) {
    return null;
  }
  if (
    returnPath.length > 500 ||
    !returnPath.startsWith("/") ||
    returnPath.startsWith("//")
  ) {
    return null;
  }
  return returnPath;
}

export async function issueOAuthState(
  store: PaymentOAuthStateStore,
  params: {
    userId: string;
    provider: PaymentProvider;
    returnPath?: string | null;
    now?: Date;
    ttlMs?: number;
  },
) {
  const { raw, hashed } = createOAuthStateValue();
  const now = params.now ?? new Date();
  await store.insert({
    hashedState: hashed,
    userId: params.userId,
    provider: params.provider,
    returnPath: sanitizeOAuthReturnPath(params.returnPath),
    expiresAt: new Date(now.getTime() + (params.ttlMs ?? OAUTH_STATE_TTL_MS)).toISOString(),
  });
  return raw;
}

export async function consumeOAuthState(
  store: PaymentOAuthStateStore,
  params: {
    rawState: string;
    provider: string;
    now?: Date;
  },
) {
  if (!isPaymentProvider(params.provider) || !params.rawState) {
    throw new PaymentError("PAYMENT_OAUTH_STATE_INVALID");
  }

  const hashed = hashOAuthState(params.rawState);
  const record = await store.findByHashedState(hashed);
  if (!record) {
    throw new PaymentError("PAYMENT_OAUTH_STATE_INVALID");
  }

  const now = params.now ?? new Date();
  if (record.consumedAt) {
    throw new PaymentError("PAYMENT_OAUTH_STATE_INVALID");
  }
  if (Date.parse(record.expiresAt) <= now.getTime()) {
    throw new PaymentError("PAYMENT_OAUTH_STATE_INVALID");
  }
  if (record.provider !== params.provider) {
    throw new PaymentError("PAYMENT_OAUTH_STATE_INVALID");
  }

  const marked = await store.markConsumed(hashed, now.toISOString());
  if (!marked) {
    throw new PaymentError("PAYMENT_OAUTH_STATE_INVALID");
  }

  return {
    userId: record.userId,
    provider: record.provider,
    returnPath: record.returnPath,
  };
}
