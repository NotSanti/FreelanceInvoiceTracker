import type { Metadata } from "next";

import { ProfileForm } from "@/app/(dashboard)/settings/profile-form";
import { PaymentProviderSettings } from "@/components/settings/payment-provider-settings";
import { PushNotificationSettings } from "@/components/settings/push-notification-settings";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { getProfile } from "@/lib/auth/session";
import { getSettingsPaymentProviderCards } from "@/lib/payments/connections.server";
import { getVapidPublicKey } from "@/lib/push/env";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const [profile, paymentCards] = await Promise.all([
    getProfile(),
    getSettingsPaymentProviderCards(),
  ]);
  const vapidConfigured = Boolean(getVapidPublicKey());

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Settings"
        description="Business identity, payment providers, and invoice defaults."
      />

      <div className="border-t border-border" />

      <ProfileForm profile={profile} />

      <div className="border-t border-border" />

      <PaymentProviderSettings cards={paymentCards} />

      <div className="border-t border-border" />

      <PushNotificationSettings vapidConfigured={vapidConfigured} />
    </PageContainer>
  );
}
