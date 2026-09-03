"use client";

import { useActionState } from "react";

import {
  createClient,
  updateClient,
  type ClientFormState,
} from "@/app/(dashboard)/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/types/database";

const initialState: ClientFormState = {};

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

export function ClientForm({ client }: { client?: Client }) {
  const action = client ? updateClient : createClient;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-10">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p className="text-sm text-positive" role="status">
          Client saved.
        </p>
      ) : null}

      <section className="space-y-5">
        <h2 className="text-base font-medium">Contact</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={client?.name ?? ""}
              required
              autoComplete="name"
              aria-invalid={state.fieldErrors?.name ? true : undefined}
            />
            <FieldError message={state.fieldErrors?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_name">Company</Label>
            <Input
              id="company_name"
              name="company_name"
              defaultValue={client?.company_name ?? ""}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={client?.email ?? ""}
              required
              autoComplete="email"
              aria-invalid={state.fieldErrors?.email ? true : undefined}
            />
            <FieldError message={state.fieldErrors?.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={client?.phone ?? ""}
              autoComplete="tel"
            />
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      <section className="space-y-5">
        <h2 className="text-base font-medium">Address</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_line_1">Address line 1</Label>
            <Input
              id="address_line_1"
              name="address_line_1"
              defaultValue={client?.address_line_1 ?? ""}
              autoComplete="address-line1"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_line_2">Address line 2</Label>
            <Input
              id="address_line_2"
              name="address_line_2"
              defaultValue={client?.address_line_2 ?? ""}
              autoComplete="address-line2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              name="city"
              defaultValue={client?.city ?? ""}
              autoComplete="address-level2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Input
              id="province"
              name="province"
              defaultValue={client?.province ?? ""}
              placeholder="QC"
              autoComplete="address-level1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">Postal code</Label>
            <Input
              id="postal_code"
              name="postal_code"
              defaultValue={client?.postal_code ?? ""}
              autoComplete="postal-code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              name="country"
              defaultValue={client?.country ?? ""}
              placeholder="CA"
              autoComplete="country"
            />
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      <section className="space-y-5">
        <h2 className="text-base font-medium">Notes</h2>
        <div className="space-y-2">
          <Label htmlFor="notes">Internal notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={client?.notes ?? ""}
            placeholder="Anything useful for the next invoice."
          />
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : client ? "Save client" : "Add client"}
      </Button>
    </form>
  );
}
