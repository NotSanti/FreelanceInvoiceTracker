import type { Metadata } from "next";

import { ProfileForm } from "@/app/(dashboard)/settings/profile-form";
import { PushNotificationSettings } from "@/components/settings/push-notification-settings";
import { PageContainer } from "@/components/shared/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { getProfile } from "@/lib/auth/session";
import { getVapidPublicKey } from "@/lib/push/env";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const profile = await getProfile();
  const vapidConfigured = Boolean(getVapidPublicKey());

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Settings"
        description="Business identity and invoice defaults."
      />

      <div className="border-t border-border" />

      <ProfileForm profile={profile} />

      <div className="border-t border-border" />

      <PushNotificationSettings vapidConfigured={vapidConfigured} />
    </PageContainer>
  );
}
