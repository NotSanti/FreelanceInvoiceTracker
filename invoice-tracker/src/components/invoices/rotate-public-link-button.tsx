"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { rotatePublicInvoiceLink } from "@/app/(dashboard)/invoices/actions";
import { Button } from "@/components/ui/button";

export function RotatePublicLinkButton({ invoiceId }: { invoiceId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          "Rotate this public link? The old URL in emails will stop working immediately.",
        );
        if (!confirmed) {
          return;
        }

        startTransition(async () => {
          const result = await rotatePublicInvoiceLink(invoiceId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Public link rotated.");
        });
      }}
    >
      {pending ? "Rotating…" : "Rotate link"}
    </Button>
  );
}
