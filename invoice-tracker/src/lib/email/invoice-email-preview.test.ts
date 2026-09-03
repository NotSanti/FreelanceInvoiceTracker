import { describe, expect, it } from "vitest";

import { buildInvoiceEmailPreview } from "@/lib/email/invoice-email-preview";

describe("invoice email preview", () => {
  const fields = {
    clientName: "Jane Moreau",
    businessName: "Studio North",
    invoiceNumber: "INV-001",
    totalLabel: "$1,150.00",
    dueDateLabel: "Sep 30, 2026",
    publicUrl: "http://localhost:3000/invoice/token",
  };

  it("renders the default message, amount, and pay link", () => {
    const preview = buildInvoiceEmailPreview(fields);

    expect(preview.subject).toBe("Invoice INV-001 from Studio North");
    expect(preview.html).toContain("Hi Jane");
    expect(preview.html).toContain("INV-001");
    expect(preview.html).toContain("$1,150.00");
    expect(preview.html).toContain("Sep 30, 2026");
    expect(preview.html).toContain("View &amp; pay invoice");
    expect(preview.html).toContain("http://localhost:3000/invoice/token");
  });

  it("uses a custom subject and message when provided", () => {
    const preview = buildInvoiceEmailPreview({
      ...fields,
      subject: "Custom subject",
      message: "Please pay this week.",
    });

    expect(preview.subject).toBe("Custom subject");
    expect(preview.html).toContain("Please pay this week.");
    expect(preview.html).not.toContain("Hi Jane");
  });
});
