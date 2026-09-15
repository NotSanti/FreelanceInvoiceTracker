import { describe, expect, it } from "vitest";

import { parseInvoiceDraft } from "@/lib/invoice/parse";

function draftForm(
  lineItems: Array<{
    description: string;
    date?: string;
    quantity: string;
    rate: string;
  }>,
) {
  const form = new FormData();
  form.set("client_id", "11111111-1111-1111-1111-111111111111");
  form.set("issue_date", "2026-09-14");
  form.set("currency", "CAD");
  form.set("line_items", JSON.stringify(lineItems));
  return form;
}

describe("parseInvoiceDraft line item dates", () => {
  it("keeps an optional ISO date on a line item", () => {
    const parsed = parseInvoiceDraft(
      draftForm([
        {
          description: "Studio session",
          date: "2026-09-10",
          quantity: "1",
          rate: "150",
        },
      ]),
    );

    expect(parsed.fieldErrors).toEqual({});
    expect(parsed.values?.items).toEqual([
      {
        description: "Studio session",
        serviceDate: "2026-09-10",
        quantity: 1,
        unitPriceCents: 15000,
        amountCents: 15000,
      },
    ]);
  });

  it("allows line items without a date", () => {
    const parsed = parseInvoiceDraft(
      draftForm([
        {
          description: "Retainer",
          quantity: "1",
          rate: "500",
        },
      ]),
    );

    expect(parsed.values?.items[0]?.serviceDate).toBeNull();
  });

  it("rejects an invalid line item date", () => {
    const parsed = parseInvoiceDraft(
      draftForm([
        {
          description: "Studio session",
          date: "09/10/2026",
          quantity: "1",
          rate: "150",
        },
      ]),
    );

    expect(parsed.values).toBeUndefined();
    expect(parsed.fieldErrors?.item_0_date).toBe("Enter a valid date.");
  });
});
