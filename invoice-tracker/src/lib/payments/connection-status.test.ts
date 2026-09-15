import { describe, expect, it } from "vitest";

import {
  canOfferAnyProviderCheckout,
  canOfferProviderCheckout,
  derivePaymentProviderCard,
  listPaymentProviderCards,
} from "@/lib/payments/connection-status";
import { isPaymentProviderConnectReady } from "@/lib/payments/provider-setup";

describe("payment connection cards", () => {
  it("marks providers without a live adapter as setup required", () => {
    const cards = listPaymentProviderCards({
      connections: {},
      isConnectReady: () => false,
    });
    expect(cards.map((card) => [card.provider, card.statusLabel])).toEqual([
      ["stripe", "Setup required"],
      ["paypal", "Coming soon"],
      ["square", "Setup required"],
    ]);
    expect(cards.every((card) => !card.canConnect)).toBe(true);
  });

  it("shows last-known connected state without calling the provider", () => {
    const card = derivePaymentProviderCard({
      provider: "stripe",
      connectReady: false,
      connection: {
        status: "connected",
        displayName: "Atelier Studio",
        email: "pay@example.com",
      },
    });
    expect(card.statusLabel).toBe("Connected");
    expect(card.accountLine).toBe("Account: Atelier Studio");
    expect(card.canDisconnect).toBe(true);
    expect(card.canConnect).toBe(false);
  });

  it("uses Business for Square and hides secret identifiers", () => {
    const named = derivePaymentProviderCard({
      provider: "square",
      connectReady: true,
      connection: {
        status: "connected",
        displayName: "Cafe Nord",
        email: "hidden@example.com",
      },
    });
    expect(named.accountLine).toBe("Business: Cafe Nord");

    const unnamed = derivePaymentProviderCard({
      provider: "square",
      connectReady: true,
      connection: {
        status: "connected",
        displayName: null,
        email: null,
      },
    });
    expect(unnamed.accountLine).toBeNull();
    expect(unnamed.statusLabel).toBe("Connected");
  });

  it("shows PayPal as coming soon until the platform is approved", () => {
    const card = derivePaymentProviderCard({
      provider: "paypal",
      connectReady: false,
      connection: null,
    });
    expect(card.status).toBe("coming_soon");
    expect(card.statusLabel).toBe("Coming soon");
    expect(card.canConnect).toBe(false);
    expect(card.canDisconnect).toBe(false);
  });

  it("keeps PayPal coming soon even when sandbox credentials are present", () => {
    const card = derivePaymentProviderCard({
      provider: "paypal",
      connectReady: true,
      connection: null,
    });
    expect(card.status).toBe("coming_soon");
    expect(card.statusLabel).toBe("Coming soon");
    expect(card.canConnect).toBe(false);
  });

  it("flags restricted accounts as needing attention", () => {
    const card = derivePaymentProviderCard({
      provider: "paypal",
      connectReady: true,
      connection: {
        status: "restricted",
        displayName: "Seller",
        email: null,
      },
    });
    expect(card.statusLabel).toBe("Needs attention");
    expect(card.canDisconnect).toBe(true);
  });

  it("treats a disconnected row as not connected", () => {
    const card = derivePaymentProviderCard({
      provider: "stripe",
      connectReady: false,
      connection: {
        status: "disconnected",
        displayName: "Old account",
        email: null,
      },
    });
    expect(card.statusLabel).toBe("Setup required");
    expect(card.accountLine).toBeNull();
    expect(card.canDisconnect).toBe(false);
  });
});

describe("checkout availability", () => {
  const restrictedStripe = {
    id: "conn-a",
    userId: "user-a",
    provider: "stripe" as const,
    providerAccountId: "acct_a",
    status: "restricted" as const,
    displayName: "IndependentPocket",
    email: null,
    country: "CA",
    defaultCurrency: "CAD",
    chargesEnabled: false,
    payoutsEnabled: false,
  };

  it("offers Stripe checkout in test mode for a restricted connected account", () => {
    expect(canOfferProviderCheckout(restrictedStripe)).toBe(false);
    expect(canOfferProviderCheckout(restrictedStripe, { stripeTestMode: true })).toBe(true);
  });

  it("does not offer any checkout when no providers are connected", () => {
    expect(
      canOfferAnyProviderCheckout([null, null, null], { stripeTestMode: true }),
    ).toBe(false);
    expect(
      canOfferAnyProviderCheckout(
        [{ ...restrictedStripe, status: "disconnected" }, null, null],
        { stripeTestMode: true },
      ),
    ).toBe(false);
  });

  it("does not offer checkout after disconnect", () => {
    expect(
      canOfferProviderCheckout(
        { ...restrictedStripe, status: "disconnected" },
        { stripeTestMode: true },
      ),
    ).toBe(false);
  });

  it("does not offer PayPal checkout for an incomplete seller", () => {
    expect(
      canOfferProviderCheckout({
        ...restrictedStripe,
        provider: "paypal",
        status: "pending",
        chargesEnabled: false,
      }),
    ).toBe(false);
  });
});

describe("provider setup readiness", () => {
  it("requires Stripe Connect credentials, not only a platform secret", () => {
    expect(
      isPaymentProviderConnectReady(
        "stripe",
        { stripeSecretKey: "sk_test" },
        { isEnabled: () => true, isAdapterLive: () => true },
      ),
    ).toBe(false);
    expect(
      isPaymentProviderConnectReady(
        "stripe",
        { stripeSecretKey: "sk_test", stripeConnectClientId: "ca_test" },
        { isEnabled: () => true, isAdapterLive: () => true },
      ),
    ).toBe(true);
  });

  it("keeps Square closed until its adapter is live", () => {
    expect(
      isPaymentProviderConnectReady(
        "square",
        { squareApplicationId: "id", squareApplicationSecret: "secret" },
        { isEnabled: () => true, isAdapterLive: () => false },
      ),
    ).toBe(false);
  });

  it("enables Square when application credentials exist", () => {
    expect(
      isPaymentProviderConnectReady(
        "square",
        { squareApplicationId: "id", squareApplicationSecret: "secret" },
        { isEnabled: () => true },
      ),
    ).toBe(true);
  });

  it("enables Stripe Connect when credentials exist", () => {
    expect(
      isPaymentProviderConnectReady(
        "stripe",
        { stripeSecretKey: "sk_test", stripeConnectClientId: "ca_test" },
        { isEnabled: () => true },
      ),
    ).toBe(true);
  });

  it("keeps PayPal closed when the feature flag is off", () => {
    expect(
      isPaymentProviderConnectReady(
        "paypal",
        { paypalClientId: "id", paypalClientSecret: "secret" },
        { isEnabled: () => false, isAdapterLive: () => true },
      ),
    ).toBe(false);
  });

  it("enables PayPal when sandbox credentials exist and the flag is on", () => {
    expect(
      isPaymentProviderConnectReady(
        "paypal",
        { paypalClientId: "id", paypalClientSecret: "secret" },
        { isEnabled: () => true },
      ),
    ).toBe(true);
  });
});
