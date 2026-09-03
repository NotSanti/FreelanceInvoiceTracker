import { firstNameFrom } from "@/lib/invoice/email";

/** Warm light theme aligned with app globals.css (hex for email clients). */
const colors = {
  background: "#FAF9F7",
  surface: "#FFFFFF",
  foreground: "#1F1E1C",
  muted: "#6F6C67",
  border: "#E8E4DE",
  primary: "#2B2926",
  positive: "#2F6B4F",
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type ReceiptEmailTemplateInput = {
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  amountPaidLabel: string;
  paidOnLabel: string;
  methodLabel: string;
  isPaidInFull: boolean;
  remainingLabel: string;
};

export function buildReceiptEmailHtml({
  clientName,
  businessName,
  invoiceNumber,
  amountPaidLabel,
  paidOnLabel,
  methodLabel,
  isPaidInFull,
  remainingLabel,
}: ReceiptEmailTemplateInput) {
  const greeting = firstNameFrom(clientName);
  const statusLine = isPaidInFull
    ? `<p style="margin:20px 0 0;font-size:15px;line-height:1.5;font-weight:500;color:${colors.positive};">Invoice ${escapeHtml(invoiceNumber)} is paid in full.</p>`
    : `<p style="margin:20px 0 0;font-size:14px;line-height:1.5;color:${colors.muted};">Remaining balance: ${escapeHtml(remainingLabel)}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment received · ${escapeHtml(invoiceNumber)}</title>
  </head>
  <body style="margin:0;padding:0;background:${colors.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${colors.background};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px;border-bottom:1px solid ${colors.border};">
                <p style="margin:0 0 4px;font-size:13px;line-height:1.4;color:${colors.muted};letter-spacing:0.02em;text-transform:uppercase;">Payment received</p>
                <p style="margin:0;font-size:20px;line-height:1.3;font-weight:600;color:${colors.foreground};">${escapeHtml(businessName)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${colors.foreground};">Hi ${escapeHtml(greeting)},</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${colors.foreground};">
                  Thank you — we received your payment for invoice ${escapeHtml(invoiceNumber)}.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid ${colors.border};padding-top:24px;">
                  <tr>
                    <td style="padding-bottom:4px;">
                      <p style="margin:0;font-size:13px;color:${colors.muted};">Invoice</p>
                      <p style="margin:4px 0 0;font-size:15px;font-weight:500;color:${colors.foreground};font-variant-numeric:tabular-nums;">${escapeHtml(invoiceNumber)}</p>
                    </td>
                    <td align="right" style="padding-bottom:4px;">
                      <p style="margin:0;font-size:13px;color:${colors.muted};">Paid on</p>
                      <p style="margin:4px 0 0;font-size:15px;color:${colors.foreground};">${escapeHtml(paidOnLabel)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top:20px;">
                      <p style="margin:0;font-size:13px;color:${colors.muted};">Amount paid</p>
                      <p style="margin:6px 0 0;font-size:32px;line-height:1.1;font-weight:600;color:${colors.foreground};font-variant-numeric:tabular-nums;letter-spacing:-0.02em;">${escapeHtml(amountPaidLabel)}</p>
                      <p style="margin:10px 0 0;font-size:14px;color:${colors.muted};">${escapeHtml(methodLabel)}</p>
                      ${statusLine}
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${colors.muted};">A PDF receipt is attached to this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:${colors.background};border-top:1px solid ${colors.border};">
                <p style="margin:0;font-size:13px;line-height:1.5;color:${colors.muted};">
                  ${escapeHtml(businessName)} · Reply to this email with any questions.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
