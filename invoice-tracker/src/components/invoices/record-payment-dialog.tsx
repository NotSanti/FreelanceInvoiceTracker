"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  recordPayment,
  type RecordPaymentState,
} from "@/app/(dashboard)/invoices/actions";
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
import { MANUAL_PAYMENT_METHODS } from "@/config/payments";
import { todayISODate } from "@/lib/dates";
import { formatCurrency } from "@/lib/money/format";
import { formatCentsForInput } from "@/lib/money/parse";

const initialState: RecordPaymentState = {};

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

function RecordPaymentForm({
  invoiceId,
  remainingCents,
  currency,
  onSaved,
}: {
  invoiceId: string;
  remainingCents: number;
  currency: string;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(recordPayment, initialState);

  useEffect(() => {
    if (state.saved) {
      toast.success(
        state.paidInFull ? "Invoice marked as paid" : "Payment recorded",
      );
      onSaved();
    }
  }, [onSaved, state.paidInFull, state.saved]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={invoiceId} />
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>
          Remaining balance {formatCurrency(remainingCents, currency)}.
        </DialogDescription>
      </DialogHeader>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="decimal"
          defaultValue={formatCentsForInput(remainingCents)}
          required
          aria-invalid={state.fieldErrors?.amount ? true : undefined}
        />
        <FieldError message={state.fieldErrors?.amount} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paid_on">Date</Label>
        <Input
          id="paid_on"
          name="paid_on"
          type="date"
          defaultValue={todayISODate()}
          required
          aria-invalid={state.fieldErrors?.paid_on ? true : undefined}
        />
        <FieldError message={state.fieldErrors?.paid_on} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="method">Method</Label>
        <select
          id="method"
          name="method"
          defaultValue="e-transfer"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {MANUAL_PAYMENT_METHODS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors?.method} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reference">Reference</Label>
        <Input id="reference" name="reference" placeholder="Optional note" />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save payment"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RecordPaymentDialog({
  invoiceId,
  remainingCents,
  currency,
}: {
  invoiceId: string;
  remainingCents: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Record payment</Button>
      </DialogTrigger>
      <DialogContent>
        {open ? (
          <RecordPaymentForm
            invoiceId={invoiceId}
            remainingCents={remainingCents}
            currency={currency}
            onSaved={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
