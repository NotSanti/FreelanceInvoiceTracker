-- Allow invoices without a hard due date.
alter table public.invoices
  alter column due_date drop not null;

comment on column public.invoices.due_date is
  'Optional payment due date. When null, the invoice is never treated as overdue.';
