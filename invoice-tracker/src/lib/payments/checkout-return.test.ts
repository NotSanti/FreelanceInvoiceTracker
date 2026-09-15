import { describe, expect, it } from "vitest";

import { checkoutReturnFromSearchParam } from "@/lib/payments/checkout-return";

describe("checkoutReturnFromSearchParam", () => {
  it("accepts success and cancelled", () => {
    expect(checkoutReturnFromSearchParam("success")).toBe("success");
    expect(checkoutReturnFromSearchParam("cancelled")).toBe("cancelled");
  });

  it("ignores other values, including paid-looking ones", () => {
    expect(checkoutReturnFromSearchParam("paid")).toBeNull();
    expect(checkoutReturnFromSearchParam(["success", "cancelled"])).toBe("success");
    expect(checkoutReturnFromSearchParam(undefined)).toBeNull();
  });
});
