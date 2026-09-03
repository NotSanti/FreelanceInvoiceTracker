"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  updateProfile,
  type ProfileFormState,
} from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/types/database";

const initialState: ProfileFormState = {};

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

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, initialState);
  const [taxesEnabled, setTaxesEnabled] = useState(profile.taxes_enabled);
  const [gstQstRegistered, setGstQstRegistered] = useState(
    profile.is_gst_qst_registered,
  );
  const taxRateDefault =
    profile.default_tax_rate === null || profile.default_tax_rate === undefined
      ? ""
      : String(profile.default_tax_rate);

  useEffect(() => {
    if (state.savedAt) {
      toast.success("Settings saved");
    }
  }, [state.savedAt]);

  return (
    <form action={action} className="space-y-10">
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <section className="space-y-5">
        <h2 className="text-base font-medium">Identity</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name}
              required
              aria-invalid={state.fieldErrors?.display_name ? true : undefined}
            />
            <FieldError message={state.fieldErrors?.display_name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input
              id="business_name"
              name="business_name"
              defaultValue={profile.business_name}
              required
              aria-invalid={state.fieldErrors?.business_name ? true : undefined}
            />
            <FieldError message={state.fieldErrors?.business_name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={profile.email}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Email comes from your sign-in account.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile.phone ?? ""}
            />
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      <section className="space-y-5">
        <h2 className="text-base font-medium">Business address</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_line_1">Address line 1</Label>
            <Input
              id="address_line_1"
              name="address_line_1"
              defaultValue={profile.address_line_1 ?? ""}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_line_2">Address line 2</Label>
            <Input
              id="address_line_2"
              name="address_line_2"
              defaultValue={profile.address_line_2 ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={profile.city ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Input
              id="province"
              name="province"
              defaultValue={profile.province ?? ""}
              placeholder="QC"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">Postal code</Label>
            <Input
              id="postal_code"
              name="postal_code"
              defaultValue={profile.postal_code ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" name="country" defaultValue={profile.country} />
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      <section className="space-y-5">
        <h2 className="text-base font-medium">Invoice defaults</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invoice_prefix">Invoice prefix</Label>
            <Input
              id="invoice_prefix"
              name="invoice_prefix"
              defaultValue={profile.invoice_prefix}
              required
              aria-invalid={state.fieldErrors?.invoice_prefix ? true : undefined}
            />
            <FieldError message={state.fieldErrors?.invoice_prefix} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_currency">Currency</Label>
            <select
              id="default_currency"
              name="default_currency"
              defaultValue={profile.default_currency}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
            <FieldError message={state.fieldErrors?.default_currency} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center gap-3">
              <Switch
                id="taxes_enabled"
                checked={taxesEnabled}
                onCheckedChange={setTaxesEnabled}
              />
              <input
                type="hidden"
                name="taxes_enabled"
                value={taxesEnabled ? "on" : "off"}
              />
              <Label htmlFor="taxes_enabled" className="font-normal">
                Include tax on invoices
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              When off, tax label and rate stay unused and are hidden on new
              invoices.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_tax_name">Tax label</Label>
            <Input
              id="default_tax_name"
              name="default_tax_name"
              defaultValue={profile.default_tax_name ?? ""}
              placeholder="GST/QST"
              disabled={!taxesEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_tax_rate">Tax rate (%)</Label>
            <Input
              id="default_tax_rate"
              name="default_tax_rate"
              inputMode="decimal"
              defaultValue={taxRateDefault}
              placeholder="14.975"
              disabled={!taxesEnabled}
              aria-invalid={state.fieldErrors?.default_tax_rate ? true : undefined}
            />
            <FieldError message={state.fieldErrors?.default_tax_rate} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tax_registration_number">Tax registration number</Label>
            <Input
              id="tax_registration_number"
              name="tax_registration_number"
              defaultValue={profile.tax_registration_number ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Optional display ID on invoices if GST and QST numbers are blank.
            </p>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      <section className="space-y-5">
        <h2 className="text-base font-medium">GST/QST</h2>
        <div className="flex items-center gap-3">
          <Switch
            id="is_gst_qst_registered"
            checked={gstQstRegistered}
            onCheckedChange={setGstQstRegistered}
          />
          <input
            type="hidden"
            name="is_gst_qst_registered"
            value={gstQstRegistered ? "on" : "off"}
          />
          <Label htmlFor="is_gst_qst_registered" className="font-normal">
            Registered for GST/QST
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          When off, GST and QST tracking is hidden from Taxes and invoices.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gst_registration_number">GST number</Label>
            <Input
              id="gst_registration_number"
              name="gst_registration_number"
              defaultValue={profile.gst_registration_number ?? ""}
              disabled={!gstQstRegistered}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qst_registration_number">QST number</Label>
            <Input
              id="qst_registration_number"
              name="qst_registration_number"
              defaultValue={profile.qst_registration_number ?? ""}
              disabled={!gstQstRegistered}
            />
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      <section className="space-y-5">
        <h2 className="text-base font-medium">Payment instructions</h2>
        <div className="space-y-2">
          <Label htmlFor="payment_instructions">Default payment instructions</Label>
          <Textarea
            id="payment_instructions"
            name="payment_instructions"
            defaultValue={profile.payment_instructions ?? ""}
            placeholder="e-Transfer to you@studio.com"
          />
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
