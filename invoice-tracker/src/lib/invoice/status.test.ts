import { describe, expect, it } from "vitest";

import { getDisplayStatus } from "@/lib/invoice/status";

describe("getDisplayStatus", () => {
  it("shows paid when a sent invoice has no remaining balance", () => {
    expect(
      getDisplayStatus({
        status: "sent",
        dueDate: "2026-09-01",
        totalCents: 1000,
        paidCents: 1000,
        today: "2026-09-10",
      }),
    ).toBe("paid");
  });

  it("keeps sent invoices overdue when a balance remains", () => {
    expect(
      getDisplayStatus({
        status: "sent",
        dueDate: "2026-09-01",
        totalCents: 1000,
        paidCents: 0,
        today: "2026-09-10",
      }),
    ).toBe("overdue");
  });
});
