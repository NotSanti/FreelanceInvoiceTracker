import { PAYMENT_PROVIDERS, type PaymentProvider, type PaymentProviderConnection, type ProviderConnectionStatus, isUsableProviderConnection } from "@/lib/payments/types";

export type PaymentCardStatus =
  | "connected"
  | "needs_attention"
  | "not_connected"
  | "setup_required"
  | "coming_soon";

export type PaymentConnectionSummary = {
  status: ProviderConnectionStatus;
  displayName: string | null;
  email: string | null;
};

export type PaymentProviderCard = {
  provider: PaymentProvider;
  label: string;
  status: PaymentCardStatus;
  statusLabel: string;
  accountLine: string | null;
  canConnect: boolean;
  canDisconnect: boolean;
};

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  square: "Square",
};

export function paymentCardStatusLabel(status: PaymentCardStatus) {
  if (status === "connected") {
    return "Connected";
  }
  if (status === "needs_attention") {
    return "Needs attention";
  }
  if (status === "setup_required") {
    return "Setup required";
  }
  if (status === "coming_soon") {
    return "Coming soon";
  }
  return "Not connected";
}

export function formatPaymentAccountLine(
  provider: PaymentProvider,
  connection: PaymentConnectionSummary | null,
) {
  if (!connection || connection.status === "disconnected") {
    return null;
  }
  const name = connection.displayName?.trim() || connection.email?.trim();
  if (!name) {
    return null;
  }
  return provider === "square" ? `Business: ${name}` : `Account: ${name}`;
}

export function derivePaymentProviderCard(input: {
  provider: PaymentProvider;
  connection: PaymentConnectionSummary | null;
  connectReady: boolean;
}): PaymentProviderCard {
  const connection = input.connection;
  const usableStatus = connection?.status ?? "disconnected";
  const hasActiveRow =
    Boolean(connection) && usableStatus !== "disconnected";

  let status: PaymentCardStatus = "not_connected";
  if (input.provider === "paypal" && !hasActiveRow) {
    status = "coming_soon";
  } else if (usableStatus === "connected") {
    status = "connected";
  } else if (usableStatus === "pending" || usableStatus === "restricted" || usableStatus === "error") {
    status = "needs_attention";
  } else if (!input.connectReady) {
    status = "setup_required";
  }

  return {
    provider: input.provider,
    label: PAYMENT_PROVIDER_LABELS[input.provider],
    status,
    statusLabel: paymentCardStatusLabel(status),
    accountLine: formatPaymentAccountLine(input.provider, connection),
    canConnect: input.provider !== "paypal" && input.connectReady && !hasActiveRow,
    canDisconnect: hasActiveRow,
  };
}

export function canOfferProviderCheckout(
  connection: PaymentProviderConnection | null,
  options: { stripeTestMode?: boolean } = {},
) {
  if (!connection) {
    return false;
  }
  if (isUsableProviderConnection(connection)) {
    return true;
  }
  return Boolean(
    options.stripeTestMode &&
      connection.provider === "stripe" &&
      (connection.status === "pending" || connection.status === "restricted"),
  );
}

export function canOfferAnyProviderCheckout(
  connections: Array<PaymentProviderConnection | null>,
  options: { stripeTestMode?: boolean } = {},
) {
  return connections.some((connection) =>
    canOfferProviderCheckout(connection, options),
  );
}

export function listPaymentProviderCards(input: {
  connections: Partial<Record<PaymentProvider, PaymentConnectionSummary>>;
  isConnectReady: (provider: PaymentProvider) => boolean;
}): PaymentProviderCard[] {
  return PAYMENT_PROVIDERS.map((provider) =>
    derivePaymentProviderCard({
      provider,
      connection: input.connections[provider] ?? null,
      connectReady: input.isConnectReady(provider),
    }),
  );
}
