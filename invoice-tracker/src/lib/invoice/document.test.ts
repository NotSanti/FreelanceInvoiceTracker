import { describe, expect, it } from "vitest";

import { buildPublicInvoiceDocument } from "@/lib/invoice/document";

const address = {
  address_line_1: "12 King St",
  address_line_2: null,
  city: "Toronto",
  province: "ON",
  postal_code: "M5V 1A1",
  country: "Canada",
};

function publicDocumentItems(
  items: Array<{ description: string; service_date?: string | null }>,
) {
  return buildPublicInvoiceDocument({
    invoice: {
      invoice_number: "INV-001",
      issue_date: "2026-09-14",
      due_date: null,
      currency: "CAD",
      subtotal_cents: 15000,
      discount_cents: 0,
      tax_cents: 0,
      tax_name: null,
      gst_cents: 0,
      gst_rate: null,
      qst_cents: 0,
      qst_rate: null,
      total_cents: 15000,
      payment_instructions: null,
    },
    profile: {
      ...address,
      business_name: "Studio North",
      display_name: "North",
      email: "studio@example.com",
      phone: null,
      tax_registration_number: null,
      gst_registration_number: null,
      qst_registration_number: null,
    },
    client: {
      ...address,
      name: "Jane Moreau",
      company_name: null,
      email: "jane@example.com",
    },
    items: items.map((item) => ({
      description: item.description,
      quantity: 1,
      unit_price_cents: 15000,
      amount_cents: 15000,
      service_date: item.service_date ?? null,
    })),
  });
}

describe("buildPublicInvoiceDocument line item dates", () => {
  it("shows a Date column when any item has a service date", () => {
    const document = publicDocumentItems([
      { description: "Session", service_date: "2026-09-10" },
    ]);

    expect(document.showItemDates).toBe(true);
    expect(document.items[0]?.dateLabel).toBe("Sep 10, 2026");
  });

  it("hides the Date column when no items have a date", () => {
    const document = publicDocumentItems([{ description: "Retainer" }]);

    expect(document.showItemDates).toBe(false);
    expect(document.items[0]?.dateLabel).toBeNull();
  });
});
