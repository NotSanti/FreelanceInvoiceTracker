-- SEC-10: Shared application/database field bounds.

alter table public.clients
  drop constraint if exists clients_name_length,
  drop constraint if exists clients_company_name_length,
  drop constraint if exists clients_email_length,
  drop constraint if exists clients_phone_length,
  drop constraint if exists clients_address_line_length,
  drop constraint if exists clients_city_length,
  drop constraint if exists clients_province_length,
  drop constraint if exists clients_postal_code_length,
  drop constraint if exists clients_country_length,
  drop constraint if exists clients_notes_length;

alter table public.clients
  add constraint clients_name_length check (char_length(name) <= 200),
  add constraint clients_company_name_length
    check (company_name is null or char_length(company_name) <= 200),
  add constraint clients_email_length check (char_length(email) <= 254),
  add constraint clients_phone_length
    check (phone is null or char_length(phone) <= 40),
  add constraint clients_address_line_length
    check (
      (address_line_1 is null or char_length(address_line_1) <= 300)
      and (address_line_2 is null or char_length(address_line_2) <= 300)
    ),
  add constraint clients_city_length
    check (city is null or char_length(city) <= 120),
  add constraint clients_province_length
    check (province is null or char_length(province) <= 120),
  add constraint clients_postal_code_length
    check (postal_code is null or char_length(postal_code) <= 32),
  add constraint clients_country_length
    check (country is null or char_length(country) <= 120),
  add constraint clients_notes_length
    check (notes is null or char_length(notes) <= 10000);

alter table public.invoices
  drop constraint if exists invoices_notes_length,
  drop constraint if exists invoices_payment_instructions_length,
  drop constraint if exists invoices_tax_name_length,
  drop constraint if exists invoices_money_safe_integer;

alter table public.invoices
  add constraint invoices_notes_length
    check (notes is null or char_length(notes) <= 10000),
  add constraint invoices_payment_instructions_length
    check (
      payment_instructions is null
      or char_length(payment_instructions) <= 10000
    ),
  add constraint invoices_tax_name_length
    check (tax_name is null or char_length(tax_name) <= 80),
  add constraint invoices_money_safe_integer
    check (
      subtotal_cents <= 9007199254740991
      and discount_cents <= 9007199254740991
      and tax_cents <= 9007199254740991
      and total_cents <= 9007199254740991
    );

alter table public.invoice_items
  drop constraint if exists invoice_items_description_length,
  drop constraint if exists invoice_items_money_safe_integer,
  drop constraint if exists invoice_items_quantity_max;

alter table public.invoice_items
  add constraint invoice_items_description_length
    check (char_length(description) <= 1000),
  add constraint invoice_items_money_safe_integer
    check (
      unit_price_cents <= 9007199254740991
      and amount_cents <= 9007199254740991
    ),
  add constraint invoice_items_quantity_max
    check (quantity <= 1000000);

alter table public.payments
  drop constraint if exists payments_reference_length,
  drop constraint if exists payments_amount_safe_integer;

alter table public.payments
  add constraint payments_reference_length
    check (reference is null or char_length(reference) <= 5000),
  add constraint payments_amount_safe_integer
    check (amount_cents <= 9007199254740991);

alter table public.profiles
  drop constraint if exists profiles_business_name_length,
  drop constraint if exists profiles_display_name_length,
  drop constraint if exists profiles_email_length;

alter table public.profiles
  add constraint profiles_business_name_length
    check (char_length(business_name) <= 200),
  add constraint profiles_display_name_length
    check (char_length(display_name) <= 200),
  add constraint profiles_email_length
    check (char_length(email) <= 254);
