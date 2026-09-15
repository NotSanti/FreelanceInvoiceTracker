alter table public.payments
  drop constraint if exists payments_method_allowed;

alter table public.payments
  add constraint payments_method_allowed check (
    method in (
      'e-transfer',
      'cash',
      'cheque',
      'bank_transfer',
      'other',
      'stripe',
      'square',
      'paypal'
    )
  );
