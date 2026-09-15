import { describe, expect, it } from "vitest";

import { createHostedCheckout, type CheckoutStore } from "@/lib/payments/checkout.server";
import { PaymentError } from "@/lib/payments/errors";
import { createFakePaymentAdapter } from "@/lib/payments/providers/fake";
import { createPaymentProviderRegistry } from "@/lib/payments/registry";
import type {
  CheckoutInvoiceRecord,
  PaymentProvider,
  PaymentProviderConnection,
} from "@/lib/payments/types";

function connection(overrides: Partial<PaymentProviderConnection> = {}): PaymentProviderConnection {
  return {
    id: "conn-a",
    userId: "user-a",
    provider: "stripe",
    providerAccountId: "acct_a",
    status: "connected",
    displayName: "A",
    email: null,
    country: null,
    defaultCurrency: "CAD",
    chargesEnabled: true,
    payoutsEnabled: true,
    ...overrides,
  };
}

function invoice(overrides: Partial<CheckoutInvoiceRecord> = {}): CheckoutInvoiceRecord {
  return {
    id: "inv-1",
    userId: "user-a",
    invoiceNumber: "INV-001",
    status: "sent",
    currency: "CAD",
    totalCents: 10_000,
    paidCents: 2_500,
    ...overrides,
  };
}

function createStore(options: {
  invoice?: CheckoutInvoiceRecord | null;
  connection?: PaymentProviderConnection | null;
  methodEnabled?: boolean;
}): CheckoutStore & { insertedAmount: number | null } {
  const store = {
    insertedAmount: null as number | null,
    async getInvoiceByPublicToken() {
      return options.invoice ?? invoice();
    },
    async getConnection() {
      return options.connection === undefined ? connection() : options.connection;
    },
    async isProviderEnabledOnInvoice() {
      return options.methodEnabled ?? true;
    },
    async insertCheckout(row: {
      amountCents: number;
      currency: string;
      provider: PaymentProvider;
    }) {
      store.insertedAmount = row.amountCents;
      return { id: "chk-1" };
    },
    async saveProviderCheckoutDetails() {},
  };
  return store;
}

describe("hosted checkout", () => {
  it("charges the outstanding balance from server invoice data", async () => {
    const adapter = createFakePaymentAdapter("stripe");
    const store = createStore({ invoice: invoice({ totalCents: 10_000, paidCents: 2_500 }) });
    const result = await createHostedCheckout(
      {
        publicInvoiceToken: "550e8400-e29b-41d4-a716-446655440000",
        provider: "stripe",
        successUrl: "https://independentpocket.com/invoice/x?checkout=success",
        cancelUrl: "https://independentpocket.com/invoice/x?checkout=cancelled",
      },
      {
        store,
        registry: createPaymentProviderRegistry([adapter], () => true),
      },
    );
    expect(result.amountCents).toBe(7_500);
    expect(store.insertedAmount).toBe(7_500);
    expect(adapter.lastCheckoutOutstandingCents).toBe(7_500);
  });

  it("rejects a disabled provider", async () => {
    const adapter = createFakePaymentAdapter("paypal");
    await expect(
      createHostedCheckout(
        {
          publicInvoiceToken: "550e8400-e29b-41d4-a716-446655440000",
          provider: "paypal",
          successUrl: "https://example.test/ok",
          cancelUrl: "https://example.test/cancel",
        },
        {
          store: createStore({}),
          registry: createPaymentProviderRegistry([adapter], () => false),
        },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_DISABLED" });
  });

  it("rejects an owner/connection mismatch", async () => {
    const adapter = createFakePaymentAdapter("stripe");
    await expect(
      createHostedCheckout(
        {
          publicInvoiceToken: "550e8400-e29b-41d4-a716-446655440000",
          provider: "stripe",
          successUrl: "https://example.test/ok",
          cancelUrl: "https://example.test/cancel",
        },
        {
          store: createStore({
            connection: connection({ userId: "user-b" }),
          }),
          registry: createPaymentProviderRegistry([adapter], () => true),
        },
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_OWNER_MISMATCH" });
  });

  it("rejects a fully paid invoice", async () => {
    const adapter = createFakePaymentAdapter("stripe");
    await expect(
      createHostedCheckout(
        {
          publicInvoiceToken: "550e8400-e29b-41d4-a716-446655440000",
          provider: "stripe",
          successUrl: "https://example.test/ok",
          cancelUrl: "https://example.test/cancel",
        },
        {
          store: createStore({ invoice: invoice({ paidCents: 10_000 }) }),
          registry: createPaymentProviderRegistry([adapter], () => true),
        },
      ),
    ).rejects.toBeInstanceOf(PaymentError);
  });
});
