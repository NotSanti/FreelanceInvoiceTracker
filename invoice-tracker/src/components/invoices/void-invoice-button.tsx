"use client";

import { Button } from "@/components/ui/button";

export function VoidInvoiceButton({ invoiceNumber }: { invoiceNumber: string }) {
  return (
    <Button
      type="submit"
      size="sm"
      variant="outline"
      onClick={(event) => {
        if (!window.confirm(`Void ${invoiceNumber}? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      Void
    </Button>
  );
}
