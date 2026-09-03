"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  buildInvoiceEmailPreview,
  type InvoiceEmailPreviewFields,
} from "@/lib/email/invoice-email-preview";

export type InvoiceEmailPreviewProps = InvoiceEmailPreviewFields & {
  fromLabel: string;
  to: string;
};

export function InvoiceEmailPreviewFrame({
  fromLabel,
  to,
  subject,
  html,
}: {
  fromLabel: string;
  to: string;
  subject: string;
  html: string;
}) {
  return (
    <div className="space-y-3">
      <dl className="space-y-2 text-sm">
        <div className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">From</dt>
          <dd className="min-w-0 truncate">{fromLabel}</dd>
          <dt className="text-muted-foreground">To</dt>
          <dd className="min-w-0 truncate">{to}</dd>
          <dt className="text-muted-foreground">Subject</dt>
          <dd className="min-w-0 wrap-break-word font-medium">{subject}</dd>
        </div>
      </dl>
      <iframe
        key={html}
        title="Invoice email preview"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={html}
        className="h-[min(32rem,55vh)] w-full rounded-lg border border-border bg-[#FAF9F7]"
        suppressHydrationWarning
      />
      <p className="text-xs text-muted-foreground">
        A PDF copy is attached when this email is sent.
      </p>
    </div>
  );
}

export function InvoiceEmailPreviewDialog({
  fromLabel,
  to,
  ...fields
}: InvoiceEmailPreviewProps) {
  const [open, setOpen] = useState(false);
  const preview = open ? buildInvoiceEmailPreview(fields) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Preview email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Email preview</DialogTitle>
          <DialogDescription>
            This is how the invoice email will look in the client&apos;s inbox.
          </DialogDescription>
        </DialogHeader>
        {preview ? (
          <InvoiceEmailPreviewFrame
            fromLabel={fromLabel}
            to={to}
            subject={preview.subject}
            html={preview.html}
          />
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
