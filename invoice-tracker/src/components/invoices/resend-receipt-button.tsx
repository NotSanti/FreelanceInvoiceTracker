"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  resendReceipt,
  type ResendReceiptState,
} from "@/app/(dashboard)/invoices/actions";
import { Button } from "@/components/ui/button";

const initialState: ResendReceiptState = {};

export function ResendReceiptButton({
  invoiceId,
  clientEmail,
}: {
  invoiceId: string;
  clientEmail: string | null;
}) {
  const [state, action, pending] = useActionState(resendReceipt, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.sent && formRef.current) {
      formRef.current.reset();
    }
  }, [state.sent]);

  return (
    <form ref={formRef} action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={invoiceId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Sending…" : state.sent ? "Receipt sent" : "Send receipt"}
      </Button>
      {state.error ? (
        <p className="max-w-56 text-right text-xs text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.sent ? (
        <p className="max-w-56 text-right text-xs text-muted-foreground" role="status">
          Sent to {clientEmail}
        </p>
      ) : null}
    </form>
  );
}
