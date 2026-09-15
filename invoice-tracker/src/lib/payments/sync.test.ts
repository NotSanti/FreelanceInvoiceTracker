import { describe, expect, it } from "vitest";

import { isInvoiceFullyPaid } from "@/lib/payments/totals";
import { syncInvoicePaidState } from "@/lib/payments/sync";

describe("syncInvoicePaidState", () => {
  it("marks a fully paid invoice paid", async () => {
    const updates: unknown[] = [];
    const supabase = {
      from() {
        return {
          update(values: unknown) {
            updates.push(values);
            return {
              eq() {
                return this;
              },
              neq() {
                return { error: null };
              },
            };
          },
        };
      },
    };

    await syncInvoicePaidState({
      supabase: supabase as never,
      invoiceId: "inv-1",
      userId: "user-1",
      totalCents: 1000,
      payments: [{ amountCents: 1000 }],
    });

    expect(isInvoiceFullyPaid(1000, [{ amountCents: 1000 }])).toBe(true);
    expect(updates[0]).toMatchObject({ status: "paid" });
  });
});
