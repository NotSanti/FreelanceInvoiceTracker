"use client";

import { useActionState, useEffect, useState } from "react";

import {
  createClientInline,
  type QuickClientState,
} from "@/app/(dashboard)/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ClientListItem } from "@/types/database";

const initialState: QuickClientState = {};

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

function AddClientForm({
  onCreated,
}: {
  onCreated: (client: ClientListItem) => void;
}) {
  const [state, action, pending] = useActionState(createClientInline, initialState);

  useEffect(() => {
    if (state.client) {
      onCreated(state.client);
    }
  }, [onCreated, state.client]);

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4">
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="quick_client_name">Name</Label>
          <Input
            id="quick_client_name"
            name="name"
            required
            autoComplete="name"
            aria-invalid={state.fieldErrors?.name ? true : undefined}
          />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick_client_company">Company</Label>
          <Input
            id="quick_client_company"
            name="company_name"
            autoComplete="organization"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick_client_email">Email</Label>
          <Input
            id="quick_client_email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={state.fieldErrors?.email ? true : undefined}
          />
          <FieldError message={state.fieldErrors?.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick_client_phone">Phone</Label>
          <Input
            id="quick_client_phone"
            name="phone"
            type="tel"
            autoComplete="tel"
          />
        </div>
      </div>

      <SheetFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add client"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export function AddClientSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: ClientListItem) => void;
}) {
  const [formKey, setFormKey] = useState(0);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setFormKey((key) => key + 1);
        }
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add client</SheetTitle>
          <SheetDescription>
            The invoice you are working on stays as it is.
          </SheetDescription>
        </SheetHeader>
        <AddClientForm
          key={formKey}
          onCreated={(client) => {
            onCreated(client);
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
