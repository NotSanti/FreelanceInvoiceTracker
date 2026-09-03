import { firstNameFrom } from "@/lib/invoice/email";

/** Warm light theme aligned with app globals.css (hex for email clients). */
const colors = {
  background: "#FAF9F7",
  surface: "#FFFFFF",
  foreground: "#1F1E1C",
  muted: "#6F6C67",
  border: "#E8E4DE",
  primary: "#2B2926",
  primaryForeground: "#FAF9F7",
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function messageParagraphs(message: string) {
  return message
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${colors.foreground};">${escapeHtml(block).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export type InvoiceEmailTemplateInput = {
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  totalLabel: string;
  dueDateLabel: string | null;
  publicUrl?: string;
  message: string;
};

export function buildInvoiceEmailHtml({
  clientName,
  businessName,
  invoiceNumber,
  totalLabel,
  dueDateLabel,
  publicUrl,
  message,
}: InvoiceEmailTemplateInput) {
  const greeting = firstNameFrom(clientName);
  const body =
    messageParagraphs(message) ||
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${colors.foreground};">Hi ${escapeHtml(greeting)},</p>
     <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${colors.foreground};">Please find invoice ${escapeHtml(invoiceNumber)} attached.</p>`;

  const payButton = publicUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
        <tr>
          <td align="center" style="border-radius:8px;background:${colors.primary};">
            <a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:500;line-height:1;color:${colors.primaryForeground};text-decoration:none;border-radius:8px;">View &amp; pay invoice</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:${colors.muted};">
        Or copy this link:<br />
        <a href="${escapeHtml(publicUrl)}" style="color:${colors.foreground};word-break:break-all;">${escapeHtml(publicUrl)}</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invoice ${escapeHtml(invoiceNumber)}</title>
  </head>
  <body style="margin:0;padding:0;background:${colors.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${colors.background};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:${colors.surface};border:1px solid ${colors.border};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px;border-bottom:1px solid ${colors.border};">
                <p style="margin:0 0 4px;font-size:13px;line-height:1.4;color:${colors.muted};letter-spacing:0.02em;text-transform:uppercase;">Invoice from</p>
                <p style="margin:0;font-size:20px;line-height:1.3;font-weight:600;color:${colors.foreground};">${escapeHtml(businessName)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                ${body}
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
                      ${
                        dueDateLabel
                          ? `<p style="margin:0;font-size:13px;color:${colors.muted};">Due</p>
                      <p style="margin:4px 0 0;font-size:15px;color:${colors.foreground};">${escapeHtml(dueDateLabel)}</p>`
                          : `<p style="margin:0;font-size:13px;color:${colors.muted};">Due</p>
                      <p style="margin:4px 0 0;font-size:15px;color:${colors.foreground};">No due date</p>`
                      }
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top:20px;">
                      <p style="margin:0;font-size:13px;color:${colors.muted};">Amount due</p>
                      <p style="margin:6px 0 0;font-size:32px;line-height:1.1;font-weight:600;color:${colors.foreground};font-variant-numeric:tabular-nums;letter-spacing:-0.02em;">${escapeHtml(totalLabel)}</p>
                    </td>
                  </tr>
                </table>
                ${payButton}
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${colors.muted};">A PDF copy is attached to this email.</p>
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
