import { describe, expect, it } from "vitest";

import { PaymentError } from "@/lib/payments/errors";
import {
  consumeOAuthState,
  createOAuthStateValue,
  hashOAuthState,
  issueOAuthState,
  type PaymentOAuthStateRecord,
  type PaymentOAuthStateStore,
} from "@/lib/payments/oauth-state.server";

function createMemoryOAuthStore(): PaymentOAuthStateStore {
  const rows = new Map<string, PaymentOAuthStateRecord>();
  return {
    async insert(record) {
      rows.set(record.hashedState, { ...record, consumedAt: null });
    },
    async findByHashedState(hashedState) {
      return rows.get(hashedState) ?? null;
    },
    async markConsumed(hashedState, consumedAt) {
      const current = rows.get(hashedState);
      if (!current || current.consumedAt) {
        return false;
      }
      rows.set(hashedState, { ...current, consumedAt });
      return true;
    },
  };
}

describe("oauth state", () => {
  it("binds the consumed state to the issuing user and provider", async () => {
    const store = createMemoryOAuthStore();
    const raw = await issueOAuthState(store, {
      userId: "user-a",
      provider: "stripe",
      returnPath: "/settings",
    });
    const consumed = await consumeOAuthState(store, { rawState: raw, provider: "stripe" });
    expect(consumed.userId).toBe("user-a");
    expect(consumed.returnPath).toBe("/settings");
  });

  it("rejects a second consume of the same state", async () => {
    const store = createMemoryOAuthStore();
    const raw = await issueOAuthState(store, { userId: "user-a", provider: "square" });
    await consumeOAuthState(store, { rawState: raw, provider: "square" });
    await expect(consumeOAuthState(store, { rawState: raw, provider: "square" })).rejects.toBeInstanceOf(
      PaymentError,
    );
  });

  it("rejects expired state", async () => {
    const store = createMemoryOAuthStore();
    const now = new Date("2026-09-09T12:00:00.000Z");
    const raw = await issueOAuthState(store, {
      userId: "user-a",
      provider: "stripe",
      now,
      ttlMs: 1000,
    });
    await expect(
      consumeOAuthState(store, {
        rawState: raw,
        provider: "stripe",
        now: new Date("2026-09-09T12:00:02.000Z"),
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_OAUTH_STATE_INVALID" });
  });

  it("hashes raw state so the stored value is not the callback secret", () => {
    const { raw, hashed } = createOAuthStateValue();
    expect(hashed).toBe(hashOAuthState(raw));
    expect(hashed).not.toBe(raw);
  });
});
