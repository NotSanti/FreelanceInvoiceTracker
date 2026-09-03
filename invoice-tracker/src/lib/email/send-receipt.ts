import { Resend } from "resend";

import {
  formatFromAddress,
  formatReplyToAddress,
  getEmailEnv,
} from "@/lib/email/env";

export async function sendClientReceiptEmail({
  businessName,
  replyTo,
  to,
  subject,
  text,
  html,
  filename,
  pdf,
}: {
  businessName: string;
  replyTo: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  filename: string;
  pdf: Buffer;
}) {
  const env = getEmailEnv();
  if ("error" in env) {
    return env;
  }

  const replyToAddress = formatReplyToAddress(businessName, replyTo);
  if (!replyToAddress) {
    return {
      error: "Add an account email before sending receipts.",
    } as const;
  }

  const resend = new Resend(env.apiKey);
  const { data, error } = await resend.emails.send({
    from: formatFromAddress(businessName, env.from),
    to,
    replyTo: replyToAddress,
    subject,
    text,
    html,
    attachments: [
      {
        filename,
        content: pdf,
      },
    ],
  });

  if (error) {
    return { error: error.message || "The receipt email could not be sent." } as const;
  }

  if (!data?.id) {
    return { error: "The receipt email could not be sent." } as const;
  }

  return { id: data.id } as const;
}
