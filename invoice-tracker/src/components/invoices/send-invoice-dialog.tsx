"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  sendInvoice,
  type SendInvoiceState,
} from "@/app/(dashboard)/invoices/actions";
import { InvoiceEmailPreviewFrame } from "@/components/invoices/invoice-email-preview";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildInvoiceEmailPreview } from "@/lib/email/invoice-email-preview";
import { defaultInvoiceEmail } from "@/lib/invoice/email";

const initialState: SendInvoiceState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

function SendInvoiceForm({
  invoiceId,
  invoiceNumber,
  clientName,
  clientEmail,
  businessName,
  fromLabel,
  totalLabel,
  dueDateLabel,
  publicUrl,
  isResend,
  onSent,
}: {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  fromLabel: string;
  totalLabel: string;
  dueDateLabel: string | null;
  publicUrl?: string;
  isResend: boolean;
  onSent: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{
    to: string;
    subject: string;
    html: string;
  } | null>(null);
  const [state, action, pending] = useActionState(sendInvoice, initialState);
  const defaults = defaultInvoiceEmail({
    clientName,
    invoiceNumber,
    businessName,
    publicUrl,
  });
  const actionLabel = isResend ? "Resend invoice" : "Send invoice";

  useEffect(() => {
    if (state.sent) {
      toast.success(isResend ? "Invoice resent" : "Invoice sent");
      onSent();
    }
  }, [isResend, onSent, state.sent]);

  function showPreview() {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const data = new FormData(form);
    const to = String(data.get("to") ?? "").trim() || clientEmail;
    const subject = String(data.get("subject") ?? "");
    const message = String(data.get("message") ?? "");
    const built = buildInvoiceEmailPreview({
      clientName,
      businessName,
      invoiceNumber,
      totalLabel,
      dueDateLabel,
      publicUrl,
      subject,
      message,
    });

    setPreview({ to, subject: built.subject, html: built.html });
    setPreviewing(true);
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={() => setPreviewing(false)}
      className="grid gap-4"
    >
      <input type="hidden" name="id" value={invoiceId} />
      <DialogHeader>
        <DialogTitle>
          {previewing
            ? "Email preview"
            : `${isResend ? "Resend" : "Send"} invoice ${invoiceNumber}`}
        </DialogTitle>
        <DialogDescription>
          {previewing
            ? "This is how the invoice email will look in the client's inbox."
            : "Sends a styled email with the PDF attached and a pay link. Replies go to your account email."}
        </DialogDescription>
      </DialogHeader>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4" hidden={previewing}>
        <div className="space-y-2">
          <Label htmlFor="send_to">To</Label>
          <Input
            id="send_to"
            name="to"
            type="email"
            defaultValue={clientEmail}
            required
            autoComplete="email"
            aria-invalid={state.fieldErrors?.to ? true : undefined}
          />
          <FieldError message={state.fieldErrors?.to} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="send_subject">Subject</Label>
          <Input
            id="send_subject"
            name="subject"
            defaultValue={defaults.subject}
            required
            aria-invalid={state.fieldErrors?.subject ? true : undefined}
          />
          <FieldError message={state.fieldErrors?.subject} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="send_message">Message</Label>
          <Textarea
            id="send_message"
            name="message"
            defaultValue={defaults.message}
            required
            className="min-h-32"
            aria-invalid={state.fieldErrors?.message ? true : undefined}
          />
          <FieldError message={state.fieldErrors?.message} />
        </div>
      </div>

      {previewing && preview ? (
        <InvoiceEmailPreviewFrame
          fromLabel={fromLabel}
          to={preview.to}
          subject={preview.subject}
          html={preview.html}
        />
      ) : null}

      <DialogFooter>
        {previewing ? (
          <Button type="button" variant="outline" onClick={() => setPreviewing(false)}>
            Back to edit
          </Button>
        ) : (
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
        )}
        {previewing ? null : (
          <Button type="button" variant="outline" onClick={showPreview}>
            Preview email
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : actionLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SendInvoiceDialog({
  invoiceId,
  invoiceNumber,
  clientName,
  clientEmail,
  businessName,
  fromLabel,
  totalLabel,
  dueDateLabel,
  publicUrl,
  isResend,
}: {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  fromLabel: string;
  totalLabel: string;
  dueDateLabel: string | null;
  publicUrl?: string;
  isResend: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const actionLabel = isResend ? "Resend invoice" : "Send invoice";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setFormKey((key) => key + 1);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant={isResend ? "outline" : "default"}>
          {actionLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" showCloseButton>
        <SendInvoiceForm
          key={formKey}
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          clientName={clientName}
          clientEmail={clientEmail}
          businessName={businessName}
          fromLabel={fromLabel}
          totalLabel={totalLabel}
          dueDateLabel={dueDateLabel}
          publicUrl={publicUrl}
          isResend={isResend}
          onSent={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
