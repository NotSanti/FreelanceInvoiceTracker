"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";

import {
  createInvoice,
  updateInvoice,
  type InvoiceFormState,
} from "@/app/(dashboard)/invoices/actions";
import { AddClientSheet } from "@/components/invoices/add-client-sheet";
import { MoneyValue } from "@/components/shared/money-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  INVOICE_CURRENCIES,
  MAX_INVOICE_LINE_ITEMS,
} from "@/config/invoices";
import { parseQuantity, parseTaxRate } from "@/lib/form";
import { lineAmountCents, previewInvoiceTotals } from "@/lib/invoice/totals";
import { parseMoneyToCents } from "@/lib/money/parse";
import type { ClientListItem } from "@/types/database";

const initialState: InvoiceFormState = {};

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type LineItemDraft = {
  key: string;
  description: string;
  quantity: string;
  rate: string;
};

export type InvoiceEditorDefaults = {
  invoiceId?: string;
  invoiceNumber: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxName: string;
  taxRate: string;
  discount: string;
  notes: string;
  paymentInstructions: string;
  items: Array<{
    description: string;
    quantity: string;
    rate: string;
  }>;
};

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

function newLine(key: string): LineItemDraft {
  return {
    key,
    description: "",
    quantity: "1",
    rate: "",
  };
}

function clientOptionLabel(client: ClientListItem) {
  return client.company_name
    ? `${client.name} · ${client.company_name}`
    : client.name;
}

function previewLineAmount(quantity: string, rate: string) {
  if (!quantity.trim() || !rate.trim()) {
    return null;
  }

  const parsedQuantity = parseQuantity(quantity);
  const parsedRate = parseMoneyToCents(rate);
  if ("error" in parsedQuantity || "error" in parsedRate) {
    return null;
  }

  try {
    return lineAmountCents(parsedQuantity.value, parsedRate.value);
  } catch {
    return null;
  }
}

export function InvoiceEditor({
  mode,
  clients: initialClients,
  defaults,
  showTaxFields = true,
}: {
  mode: "create" | "edit";
  clients: ClientListItem[];
  defaults: InvoiceEditorDefaults;
  showTaxFields?: boolean;
}) {
  const action = mode === "edit" ? updateInvoice : createInvoice;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [clients, setClients] = useState(initialClients);
  const [clientId, setClientId] = useState(defaults.clientId);
  const [clientSheetOpen, setClientSheetOpen] = useState(false);
  const [currency, setCurrency] = useState(defaults.currency);
  const [taxName, setTaxName] = useState(defaults.taxName);
  const [taxRate, setTaxRate] = useState(defaults.taxRate);
  const [discount, setDiscount] = useState(defaults.discount);
  const lineKey = useRef(Math.max(defaults.items.length, 1));
  const [items, setItems] = useState<LineItemDraft[]>(() =>
    defaults.items.length > 0
      ? defaults.items.map((item, index) => ({ ...item, key: `line-${index}` }))
      : [newLine("line-0")],
  );

  const totals = useMemo(() => {
    const parsedDiscount = parseMoneyToCents(discount);
    const parsedRate = parseTaxRate(taxRate);
    return previewInvoiceTotals({
      items: items.flatMap((item) => {
        const quantity = parseQuantity(item.quantity);
        const rate = parseMoneyToCents(item.rate);
        if (
          !item.rate.trim() ||
          "error" in quantity ||
          "error" in rate
        ) {
          return [];
        }

        return [{ quantity: quantity.value, unitPriceCents: rate.value }];
      }),
      discountCents: "error" in parsedDiscount ? 0 : parsedDiscount.value,
      taxRatePercent:
        showTaxFields && !("error" in parsedRate) ? parsedRate.value : null,
    });
  }, [discount, items, showTaxFields, taxRate]);

  const taxLabel = taxName.trim() || "Tax";
  const cancelHref = mode === "edit" && defaults.invoiceId
    ? `/invoices/${defaults.invoiceId}`
    : "/invoices";

  function updateItem(key: string, patch: Partial<LineItemDraft>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(key: string) {
    setItems((current) => {
      const remaining = current.filter((item) => item.key !== key);
      return remaining.length > 0 ? remaining : [newLine(`line-${lineKey.current++}`)];
    });
  }

  return (
    <>
      <form action={formAction} className="max-w-3xl space-y-10">
        {defaults.invoiceId ? (
          <input type="hidden" name="id" value={defaults.invoiceId} />
        ) : null}
        <input
          type="hidden"
          name="line_items"
          value={JSON.stringify(
            items.map(({ description, quantity, rate }) => ({
              description,
              quantity,
              rate,
            })),
          )}
        />

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-base font-medium">Bill to</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setClientSheetOpen(true)}
            >
              <Plus />
              Add client
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <select
              id="client_id"
              name="client_id"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className={selectClassName}
              aria-invalid={state.fieldErrors?.client_id ? true : undefined}
            >
              <option value="">
                {clients.length === 0 ? "Add a client first" : "Select a client"}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {clientOptionLabel(client)}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.client_id} />
          </div>
        </section>

        <div className="border-t border-border" />

        <section className="space-y-5">
          <h2 className="text-base font-medium">Invoice details</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice #</Label>
              <Input
                id="invoice_number"
                value={defaults.invoiceNumber}
                readOnly
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                name="currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className={selectClassName}
                aria-invalid={state.fieldErrors?.currency ? true : undefined}
              >
                {INVOICE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.currency} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue date</Label>
              <Input
                id="issue_date"
                name="issue_date"
                type="date"
                defaultValue={defaults.issueDate}
                aria-invalid={state.fieldErrors?.issue_date ? true : undefined}
              />
              <FieldError message={state.fieldErrors?.issue_date} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input
                id="due_date"
                name="due_date"
                type="date"
                defaultValue={defaults.dueDate}
                aria-invalid={state.fieldErrors?.due_date ? true : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Optional. Leave blank if this invoice has no hard due date.
              </p>
              <FieldError message={state.fieldErrors?.due_date} />
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        <section className="space-y-5">
          <h2 className="text-base font-medium">Line items</h2>
          {state.fieldErrors?.items ? (
            <FieldError message={state.fieldErrors.items} />
          ) : null}

          <div className="space-y-6">
            {items.map((item, index) => {
              const amount = previewLineAmount(item.quantity, item.rate);

              return (
                <div
                  key={item.key}
                  className="grid gap-3 md:grid-cols-[minmax(0,1fr)_5.5rem_7rem_7rem_auto] md:items-start"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`item_${index}_description`}>
                      Description
                    </Label>
                    <Input
                      id={`item_${index}_description`}
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.key, { description: event.target.value })
                      }
                      placeholder="Photography"
                      aria-invalid={
                        state.fieldErrors?.[`item_${index}_description`]
                          ? true
                          : undefined
                      }
                    />
                    <FieldError
                      message={state.fieldErrors?.[`item_${index}_description`]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`item_${index}_quantity`}>Qty</Label>
                    <Input
                      id={`item_${index}_quantity`}
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.key, { quantity: event.target.value })
                      }
                      className="text-right tabular-nums"
                      aria-invalid={
                        state.fieldErrors?.[`item_${index}_quantity`]
                          ? true
                          : undefined
                      }
                    />
                    <FieldError
                      message={state.fieldErrors?.[`item_${index}_quantity`]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`item_${index}_rate`}>Rate</Label>
                    <Input
                      id={`item_${index}_rate`}
                      inputMode="decimal"
                      value={item.rate}
                      onChange={(event) =>
                        updateItem(item.key, { rate: event.target.value })
                      }
                      placeholder="1500"
                      className="text-right tabular-nums"
                      aria-invalid={
                        state.fieldErrors?.[`item_${index}_rate`] ? true : undefined
                      }
                    />
                    <FieldError
                      message={state.fieldErrors?.[`item_${index}_rate`]}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Amount</span>
                    <div className="flex h-8 items-center justify-end">
                      {amount === null ? (
                        <span className="text-sm tabular-nums text-muted-foreground">
                          —
                        </span>
                      ) : (
                        <MoneyValue
                          amountCents={amount}
                          currency={currency}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span
                      className="invisible block text-sm leading-none font-medium"
                      aria-hidden
                    >
                      Remove
                    </span>
                    <div className="flex h-8 items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.key)}
                        disabled={items.length === 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {items.length < MAX_INVOICE_LINE_ITEMS ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  newLine(`line-${lineKey.current++}`),
                ])
              }
            >
              <Plus />
              Add line item
            </Button>
          ) : null}
        </section>

        <div className="border-t border-border" />

        <section className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <MoneyValue
              amountCents={totals.totalCents}
              currency={currency}
              size="hero"
              className="mt-2"
            />
          </div>

          <dl className="max-w-sm space-y-3 text-sm">
            <div className="flex items-center justify-between gap-8">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>
                <MoneyValue
                  amountCents={totals.subtotalCents}
                  currency={currency}
                  size="sm"
                />
              </dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-start gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount">Discount</Label>
                <Input
                  id="discount"
                  name="discount"
                  inputMode="decimal"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  placeholder="0"
                  className="max-w-40 tabular-nums"
                  aria-invalid={state.fieldErrors?.discount ? true : undefined}
                />
                <FieldError message={state.fieldErrors?.discount} />
              </div>
              <dd className="pt-7">
                <MoneyValue
                  amountCents={totals.discountCents}
                  currency={currency}
                  size="sm"
                />
              </dd>
            </div>
            {showTaxFields ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tax_name">Tax name</Label>
                    <Input
                      id="tax_name"
                      name="tax_name"
                      value={taxName}
                      onChange={(event) => setTaxName(event.target.value)}
                      placeholder="GST/QST"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_rate">Tax rate %</Label>
                    <Input
                      id="tax_rate"
                      name="tax_rate"
                      inputMode="decimal"
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                      placeholder="14.975"
                      className="tabular-nums"
                      aria-invalid={state.fieldErrors?.tax_rate ? true : undefined}
                    />
                    <FieldError message={state.fieldErrors?.tax_rate} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <dt className="text-muted-foreground">{taxLabel}</dt>
                  <dd>
                    <MoneyValue
                      amountCents={totals.taxCents}
                      currency={currency}
                      size="sm"
                    />
                  </dd>
                </div>
              </>
            ) : (
              <>
                <input type="hidden" name="tax_name" value="" />
                <input type="hidden" name="tax_rate" value="" />
              </>
            )}
            <div className="flex items-center justify-between gap-8 border-t border-border pt-3 font-medium">
              <dt>Total</dt>
              <dd>
                <MoneyValue
                  amountCents={totals.totalCents}
                  currency={currency}
                  size="sm"
                />
              </dd>
            </div>
          </dl>
        </section>

        <div className="border-t border-border" />

        <section className="space-y-5">
          <h2 className="text-base font-medium">Additional information</h2>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={defaults.notes}
              placeholder="Visible on the invoice."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_instructions">Payment instructions</Label>
            <Textarea
              id="payment_instructions"
              name="payment_instructions"
              defaultValue={defaults.paymentInstructions}
              placeholder="e-Transfer, bank details, or other payment notes."
            />
          </div>
        </section>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save draft"}
          </Button>
          <Link
            href={cancelHref}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>

      <AddClientSheet
        open={clientSheetOpen}
        onOpenChange={setClientSheetOpen}
        onCreated={(client) => {
          setClients((current) =>
            [...current.filter((existing) => existing.id !== client.id), client].sort(
              (a, b) => a.name.localeCompare(b.name, "en-CA"),
            ),
          );
          setClientId(client.id);
        }}
      />
    </>
  );
}
