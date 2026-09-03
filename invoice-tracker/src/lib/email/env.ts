export const DEFAULT_FROM_EMAIL = "invoices@independentpocket.com";

export function getEmailEnv() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM_EMAIL;

  if (!apiKey) {
    return {
      error: "Email sending isn't configured yet.",
    } as const;
  }

  return { apiKey, from } as const;
}

/** Pull a bare address from `email` or `Name <email>`. */
export function extractEmailAddress(from: string) {
  const angled = from.match(/<([^>]+)>/);
  if (angled?.[1]?.trim()) {
    return angled[1].trim();
  }
  return from.trim();
}

function formatDisplayName(name: string) {
  const cleaned = name.replace(/[<>\r\n]/g, "").trim() || "Independent Pocket";
  if (/[",]/.test(cleaned)) {
    return `"${cleaned.replace(/"/g, '\\"')}"`;
  }
  return cleaned;
}

/** Always send as `{business/user name} <invoices@…>` using the configured mailbox. */
export function formatFromAddress(businessName: string, from: string) {
  const email = extractEmailAddress(from) || DEFAULT_FROM_EMAIL;
  return `${formatDisplayName(businessName)} <${email}>`;
}

/** Reply-To uses the workspace owner's email so clients reach them directly. */
export function formatReplyToAddress(
  businessName: string,
  userEmail: string | null | undefined,
) {
  const email = userEmail?.trim();
  if (!email || !email.includes("@")) {
    return null;
  }
  return `${formatDisplayName(businessName)} <${email}>`;
}
