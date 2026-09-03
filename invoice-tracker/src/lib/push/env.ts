export function getPushEnv() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "mailto:notifications@independentpocket.app";

  if (!publicKey || !privateKey) {
    return {
      error: "Push notifications aren't configured yet.",
    } as const;
  }

  return { publicKey, privateKey, subject } as const;
}

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? null;
}
