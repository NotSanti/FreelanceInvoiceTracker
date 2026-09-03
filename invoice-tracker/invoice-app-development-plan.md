# Personal Invoice Creator & Tracker
## Development + Product Design Plan for Cursor

> **Purpose:** Build a personal invoice creation, sending, tracking, and cash-flow dashboard app for a freelance photographer/videographer.
>
> **Primary stack:** Next.js + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Stripe
>
> **Product philosophy:** Simple, calm, premium, finance-first, and highly legible. The visual language should be strongly inspired by Wealthsimple's modern product UI: generous whitespace, strong typography, restrained colors, clear information hierarchy, subtle dividers, compact navigation, and financial data presented with minimal visual noise.
>
> **Important constraint:** This is **not** a CRM, bookkeeping suite, project management system, or full accounting product. Do not add features outside the invoice/payment/cash-flow scope unless a milestone explicitly asks for them.

---

# 1. Product Vision

Build a lightweight personal operating system for freelance invoicing.

The app should answer, immediately:

1. How much money have I received?
2. How much money am I still owed?
3. Which invoices are overdue?
4. What income should I expect this month/year?
5. What business expenses have I paid or still owe?
6. What is my actual and projected net income?
7. Which invoices need action?
8. What business income and expenses will I need to report for taxes?
9. How much GST/QST have I collected versus potentially recoverable on eligible expenses?
10. Roughly how much should I reserve for year-end income tax and QPP contributions?

The product should feel closer to a polished personal finance app than traditional accounting software.

The core workflow is:

```text
Create Invoice
    ↓
Save Draft
    ↓
Send Invoice by Email
    ↓
Invoice becomes "Sent"
    ↓
Client opens invoice
    ↓
Client optionally follows payment link
    ↓
Stripe Checkout
    ↓
Stripe webhook
    ↓
Invoice becomes "Paid"
```

Manual payments must remain supported for:

- Interac e-Transfer
- Cash
- Cheque
- Bank transfer
- Other

---

# 2. Non-Goals

Do NOT build the following during the initial roadmap:

- Full CRM
- Sales pipelines
- Lead management
- Contracts
- Proposals
- Photography galleries
- Appointment scheduling
- Payroll
- Double-entry accounting
- Tax filing
- Bank account syncing
- Expense receipt OCR
- Multi-user teams
- Inventory
- Client messaging system
- Complex bookkeeping reports
- Multiple payment providers
- Native mobile apps

These may be considered much later, but they must not delay the MVP.

---

# 3. Core Product Entities

The initial application should revolve around six entities:

```text
User
Client
Invoice
InvoiceItem
Payment
Expense
```

Optional later entity:

```text
EmailEvent
```

The relationship model:

```text
User
│
├── Clients
│    └── Invoices
│         ├── InvoiceItems
│         └── Payments
│
└── Expenses
```

---

# 4. Recommended Technical Stack

## Application

- Next.js
- App Router
- TypeScript
- React Server Components where appropriate
- Server Actions or Route Handlers for mutations requiring server credentials

## UI

- Tailwind CSS
- shadcn/ui
- Lucide icons
- Recharts for simple dashboard charts if needed

Avoid unnecessary animation libraries for MVP.

## Backend

Supabase:

- PostgreSQL database
- Authentication
- Row Level Security
- Storage for generated invoice PDFs or uploaded expense documents
- Optional realtime functionality later

## Email

Recommended:

- Resend

Use server-side sending only.

Never expose Resend credentials to the browser.

## Payments

Initial provider:

- Stripe

Use:

- Stripe Checkout or hosted payment flow
- Stripe webhooks
- Stripe test mode during development

Do not collect or store card details directly.

## Deployment

- Vercel
- Supabase hosted project
- Stripe
- Resend

---

# 5. Repository / Folder Structure

Use a clean feature-oriented structure.

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── callback/
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── invoices/
│   │   ├── clients/
│   │   ├── expenses/
│   │   └── settings/
│   │
│   ├── invoice/
│   │   └── [publicToken]/
│   │
│   └── api/
│       ├── invoices/
│       ├── stripe/
│       └── webhooks/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── dashboard/
│   ├── invoices/
│   ├── clients/
│   ├── expenses/
│   └── shared/
│
├── lib/
│   ├── supabase/
│   ├── stripe/
│   ├── email/
│   ├── invoice/
│   ├── money/
│   └── utils/
│
├── types/
│
└── config/
```

Do not over-abstract early.

Create reusable components only after duplication actually appears.

---

# 6. Product Navigation

Desktop navigation:

```text
Overview
Invoices
Clients
Expenses
Settings
```

Primary action:

```text
+ New invoice
```

Suggested left sidebar:

```text
[Logo]

Overview
Invoices
Clients
Expenses

────────────

Settings

[User]
```

On smaller widths use a compact sidebar or drawer.

Mobile can use:

```text
Overview
Invoices
Clients
More
```

Do not prioritize sophisticated mobile navigation until the main desktop experience works.

---

# 7. Design Direction

## Overall Inspiration

The interface should take strong visual inspiration from Wealthsimple's current product language without cloning proprietary layouts or branding.

The relevant design principles are:

- finance-first hierarchy
- calm visual density
- generous whitespace
- excellent typography
- minimal ornamentation
- restrained palette
- soft surfaces rather than heavy cards
- prominent financial totals
- small secondary labels
- clear status presentation
- tables that feel lightweight rather than spreadsheet-heavy
- simple charts with minimal grid noise
- contextual actions rather than permanent button clutter

The dashboard should feel like a financial snapshot.

Do not make it look like:

- an enterprise accounting application
- a generic shadcn dashboard template
- an admin panel
- a CRM
- a data warehouse
- a SaaS analytics dashboard with 20 cards

---

# 8. Design Tokens

Start with CSS variables so the UI can evolve without rewriting components.

Example semantic tokens:

```css
--background
--foreground

--surface
--surface-secondary

--border
--border-strong

--muted
--muted-foreground

--positive
--warning
--negative

--primary
--primary-foreground
```

## Color Philosophy

Primary interface:

- warm white / very light neutral background
- near-black text
- soft grey secondary surfaces
- subtle neutral borders

Financial state colors should be used sparingly.

Examples:

- Paid → green
- Sent → neutral / blue-grey
- Overdue → red
- Draft → grey
- Due soon → amber

Do not create large saturated status cards.

Use color primarily for:

- semantic state
- charts
- tiny status indicators
- key calls to action

---

# 9. Typography

Use a modern sans-serif.

Good initial choices:

- Geist
- Inter

Hierarchy:

```text
Page financial total:
32–44px / medium

Page title:
24–32px / semibold

Section title:
16–20px / semibold

Body:
14–16px

Secondary metadata:
12–14px
```

Financial values should use tabular numbers where practical.

Example:

```css
font-variant-numeric: tabular-nums;
```

Large numbers should visually dominate their label.

Example:

```text
$8,420.00
Received this month
```

not:

```text
Received this month
$8,420.00
```

---

# 10. Spacing & Surface Rules

Prefer whitespace before adding containers.

Avoid putting every section inside a card.

Use:

- page max-width
- strong vertical rhythm
- thin separators
- large section spacing
- subtle hover rows

Suggested page shell:

```text
max-width: 1440px
page padding: 24–40px desktop
page padding: 16px mobile
```

Cards should generally have:

- subtle 1px border OR slightly differentiated background
- moderate radius
- little or no shadow

Avoid:

- giant shadows
- glassmorphism
- gradients
- excessive rounding
- colorful dashboard widgets

---

# 11. Dashboard UX

The homepage should answer financial questions before showing operational detail.

Recommended hierarchy:

```text
Overview

$7,220
Projected net income
September 2026

+12.4% vs August

────────────────────────────────────

Received       Outstanding       Expenses
$4,820         $2,400            $1,250

────────────────────────────────────

Income overview
[chart]

────────────────────────────────────

Invoices needing attention

Overdue invoice...
Due soon...
Draft invoice...

────────────────────────────────────

Recent invoices
```

Avoid showing every possible statistic.

---

# 12. Invoice Status Model

Use a constrained enum:

```ts
type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "void";
```

Do not persist `overdue` if avoidable.

Prefer deriving overdue state:

```ts
status === "sent" &&
dueDate < now &&
balanceRemaining > 0
```

This prevents status data becoming inconsistent.

If the product later requires richer states, consider:

```text
viewed
partially_paid
```

but these are not required for initial MVP.

---

# 13. Money Rules

Never use floating point math for stored money.

Store monetary values as integer cents.

Example:

```text
$123.45 → 12345
```

Recommended DB names:

```text
subtotal_cents
tax_cents
discount_cents
total_cents
amount_cents
```

Create centralized helpers:

```ts
formatCurrency()
calculateInvoiceTotals()
calculateTax()
calculateBalanceRemaining()
```

All calculations should use integer arithmetic.

---

# 14. Suggested Database Schema

## profiles

```text
id uuid PK references auth.users
display_name text
business_name text
email text
phone text nullable
address_line_1 text nullable
address_line_2 text nullable
city text nullable
province text nullable
postal_code text nullable
country text default 'CA'
default_currency text default 'CAD'
default_tax_name text nullable
default_tax_rate numeric nullable
tax_registration_number text nullable
gst_registration_number text nullable
qst_registration_number text nullable
is_gst_qst_registered boolean default false
tax_residency_province text default 'QC'
invoice_prefix text default 'INV'
next_invoice_number integer default 1
created_at timestamptz
updated_at timestamptz
```

## clients

```text
id uuid PK
user_id uuid FK
name text
company_name text nullable
email text
phone text nullable
address_line_1 text nullable
address_line_2 text nullable
city text nullable
province text nullable
postal_code text nullable
country text nullable
notes text nullable
created_at timestamptz
updated_at timestamptz
```

## invoices

```text
id uuid PK
user_id uuid FK
client_id uuid FK

invoice_number text
public_token uuid

status text

currency text

issue_date date
due_date date

subtotal_cents bigint
discount_cents bigint default 0
tax_cents bigint default 0
total_cents bigint

notes text nullable
payment_instructions text nullable

sent_at timestamptz nullable
viewed_at timestamptz nullable
paid_at timestamptz nullable

stripe_checkout_session_id text nullable
stripe_payment_intent_id text nullable
stripe_payment_url text nullable

created_at timestamptz
updated_at timestamptz
```

Recommended uniqueness:

```text
UNIQUE(user_id, invoice_number)
UNIQUE(public_token)
```

## invoice_items

```text
id uuid PK
invoice_id uuid FK
description text
quantity numeric
unit_price_cents bigint
amount_cents bigint
position integer
created_at timestamptz
```

For MVP, quantity may allow decimals.

Examples:

```text
1 shoot day
3.5 editing hours
2 assistants
```

## payments

```text
id uuid PK
user_id uuid FK
invoice_id uuid FK

amount_cents bigint
currency text

method text
provider text nullable
provider_payment_id text nullable

paid_at timestamptz
notes text nullable

created_at timestamptz
```

Potential `method` values:

```text
stripe
etransfer
cash
cheque
bank_transfer
other
```

## expenses

```text
id uuid PK
user_id uuid FK

vendor text
description text nullable
category text nullable

amount_cents bigint
currency text

# Tax-analysis fields
subtotal_cents bigint nullable
gst_cents bigint default 0
qst_cents bigint default 0
is_tax_deductible boolean default true
business_use_percent numeric default 100
tax_category text nullable

expense_date date
due_date date nullable
paid_at timestamptz nullable

notes text nullable

created_at timestamptz
updated_at timestamptz
```

---

# 15. Supabase Security

Enable Row Level Security on every user-owned table.

Basic rule:

```text
auth.uid() = user_id
```

A user must never be able to query another user's:

- clients
- invoices
- payments
- expenses
- settings

Public invoice access must NOT bypass RLS using arbitrary invoice IDs.

Use `public_token` through a controlled server-side route or dedicated safe query.

Never expose the Supabase service role key to the browser.

---

# 16. Financial Metrics

## Received Income

Sum payments received during the selected period.

```text
received = SUM(payments.amount)
```

## Outstanding

```text
outstanding =
SUM(invoice total)
-
SUM(payments)
```

for invoices not voided.

## Expenses

Use paid expenses for actual expense calculation.

## Actual Net Income

```text
actual net =
payments received
-
expenses paid
```

## Projected Income

For MVP:

```text
projected income =
payments received this period
+
remaining balance of sent invoices due this period
```

## Projected Net Income

```text
projected net =
payments received
+
invoice balances expected this period
-
paid expenses
-
unpaid expenses due this period
```

Display clearly that projected figures are estimates.

---

# 17. Milestone Development Strategy

Every milestone must satisfy these rules:

1. The app must remain runnable after every milestone.
2. Do not begin future milestone functionality early.
3. Prefer the smallest useful implementation.
4. Do not introduce abstractions without a concrete need.
5. Do not redesign already accepted screens unless required.
6. Before coding each milestone, inspect the existing repository.
7. Preserve established components and tokens.
8. TypeScript errors are not acceptable.
9. Do not leave dead code.
10. Finish each milestone with a concise implementation summary.

---

# Milestone 0 — Project Foundation

## Goal

Create the application shell and engineering foundation.

No real business logic yet.

## Build

Set up:

- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- Supabase client
- ESLint
- formatting
- environment variable pattern
- base layout
- route groups

Install only dependencies needed now.

Create:

```text
/
├── login
└── authenticated dashboard shell
```

Dashboard navigation:

```text
Overview
Invoices
Clients
Expenses
Settings
```

Create a responsive shell.

## Design Work

Establish:

- typography
- spacing
- page widths
- background colors
- borders
- button styles
- status colors
- sidebar
- mobile navigation behavior

Create reusable:

```text
PageHeader
PageContainer
EmptyState
MoneyValue
StatusBadge
```

Do not build full screens yet.

## Acceptance Criteria

- app starts successfully
- TypeScript passes
- Tailwind works
- shadcn configured
- responsive shell exists
- visual tokens are centralized
- dashboard routes render placeholders
- no hardcoded secrets

## Cursor Prompt

```text
Implement Milestone 0 from this development plan.

First inspect the repository and existing configuration. Then create the minimum project foundation required for the Personal Invoice Creator & Tracker.

Use Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

Create a premium finance-oriented application shell inspired by Wealthsimple's visual principles: generous whitespace, near-black typography, subtle borders, restrained neutral surfaces, minimal shadows, strong financial-data hierarchy, and simple navigation. Do not directly copy Wealthsimple branded assets or proprietary layouts.

Required routes:
- Overview
- Invoices
- Clients
- Expenses
- Settings

Create responsive desktop navigation and a reasonable mobile fallback.

Establish design tokens and reusable structural components such as PageHeader, PageContainer, EmptyState, MoneyValue, and StatusBadge.

Do NOT implement invoices, clients, payments, charts, expenses, Stripe, or email functionality yet.

Keep dependencies minimal.

Before finishing:
- run lint
- run TypeScript checks
- remove dead code
- verify all routes render
- summarize files created/changed
```

---

# Milestone 1 — Authentication + Profile

## Goal

Allow only the owner to access the application.

## MVP

Implement Supabase authentication.

Preferred initial auth:

```text
Email + password
```

Magic link can be added later.

Create:

- login
- logout
- protected dashboard layout
- authenticated user profile
- basic settings screen

Settings should store:

```text
Display name
Business name
Email
Phone
Business address
Default currency
Tax label
Tax rate
Tax registration number
Invoice prefix
Payment instructions
```

## UX

This is a personal app.

Do not build:

- signup funnels
- organizations
- roles
- team invitations
- multi-tenancy UI

## Acceptance Criteria

- unauthenticated users are redirected to login
- authenticated user reaches dashboard
- logout works
- profile settings persist
- RLS exists
- user cannot access another user's records

## Cursor Prompt

```text
Implement Milestone 1: Authentication + Profile.

Use Supabase Auth with email/password.

Add:
- login page
- logout action
- protected dashboard layout
- profile table
- profile/settings page

Store business identity and invoice defaults:
- display name
- business name
- email
- phone
- address
- default currency
- default tax name
- default tax rate
- tax registration number
- invoice prefix
- default payment instructions

Add Supabase SQL migrations and Row Level Security.

This remains a single-owner personal application. Do not add organizations, teams, roles, invitations, or onboarding funnels.

Maintain the existing design system from Milestone 0.

Validate forms with an appropriate lightweight schema approach if already available in the project.

Do not implement invoices yet.

Finish by verifying auth protection, persistence, lint, TypeScript, and RLS policies.
```

---

# Milestone 2 — Client Management

## Goal

Create reusable invoice recipients.

## MVP Features

Clients page:

```text
Clients
[ + New client ]

Name
Company
Email
Phone
Total invoiced
Outstanding
```

For the first implementation, `Total invoiced` and `Outstanding` may be omitted until invoices exist.

Client actions:

- create
- view
- edit
- delete when safe

Client form:

```text
Name *
Company
Email *
Phone
Address
Notes
```

## UX

Client creation should also be usable later from the invoice builder.

Keep form components reusable.

## Empty State

```text
No clients yet.

Clients make it faster to create and send invoices.

[Add your first client]
```

## Acceptance Criteria

- create client
- edit client
- list clients
- client detail works
- delete client
- RLS applies
- empty/loading/error states exist

## Cursor Prompt

```text
Implement Milestone 2: Client Management.

Build the smallest complete client-management feature using Supabase.

Required:
- clients table + migration
- RLS
- clients list
- client detail
- create client
- edit client
- delete client
- loading, empty, and error states

Fields:
- name
- company name
- email
- phone
- address
- notes

Use the existing shadcn/Tailwind design system.

The clients UI should remain visually calm and lightweight rather than looking like a CRM.

Design forms so the client selector/creation experience can later be reused by the invoice builder.

Do not implement invoices or dashboard metrics yet.

Run lint/type checks and summarize the completed behavior.
```

---

# Milestone 3 — Invoice Data Model + Invoice List

## Goal

Create the core invoice domain before building the complete editor.

## Build

Create:

- invoices
- invoice_items

Implement invoice numbering.

Example:

```text
INV-001
INV-002
INV-003
```

Invoice list:

```text
Invoice     Client            Issued      Due         Amount      Status

INV-026     ACME              Aug 30      Sep 14      $1,800      Sent
INV-025     Jane Smith        Aug 20      Aug 30      $3,200      Paid
INV-024     Studio XYZ        Aug 01      Aug 15        $450      Overdue
```

Filters:

```text
All
Draft
Sent
Paid
Overdue
```

Search:

```text
invoice number
client name
company
```

## Important

Derive `overdue` whenever possible.

Do not store it as an independent source of truth.

## Invoice Detail MVP

Invoice detail can initially display:

- metadata
- client
- line items
- subtotal
- tax
- total
- status
- notes

No email or Stripe yet.

## Acceptance Criteria

- invoice schema exists
- item schema exists
- list renders real DB data
- filters work
- invoice detail renders
- status is visually clear
- money uses cents
- calculations centralized

## Cursor Prompt

```text
Implement Milestone 3: Invoice Domain + Invoice List.

Create Supabase migrations for invoices and invoice_items with appropriate RLS.

Money must be stored in integer cents. Do not store currency values as floating-point amounts.

Create centralized invoice calculation and currency-formatting helpers.

Implement automatic invoice numbering based on the user's invoice prefix and next invoice number.

Build:
- invoice list
- invoice detail
- invoice status display
- status filters
- search by invoice number/client

Use statuses:
- draft
- sent
- paid
- void

Derive overdue status from sent + due date + unpaid balance rather than creating a second conflicting source of truth.

Do not build sending, PDFs, payments, Stripe, or dashboard charts yet.

Keep tables visually lightweight and finance-oriented.

Finish with TypeScript/lint checks and a summary.
```

---

# Milestone 4 — Invoice Creator MVP

## Goal

Create complete invoices using a polished form.

This is the first major product milestone.

## Invoice Form

Sections:

### Client

```text
Bill to
[ Select client ]
```

Allow:

```text
+ Add client
```

without losing current invoice progress.

### Invoice Details

```text
Invoice #
Issue date
Due date
Currency
```

### Line Items

```text
Description        Quantity       Rate        Amount

Photography            1          $1500       $1500
Editing                 5          $100         $500

+ Add line item
```

Support:

- add
- edit
- reorder later
- remove

Reordering is not necessary for MVP.

### Totals

```text
Subtotal
Discount
Tax
Total
```

Tax defaults from profile but can be overridden per invoice.

### Additional Information

```text
Notes
Payment instructions
```

### Actions

```text
Cancel
Save Draft
```

Sending comes later.

## Autosave

Do NOT implement autosave initially.

Explicit Save Draft is enough.

## Validation

Require:

- client
- issue date
- due date
- at least one valid line item
- non-negative values
- valid quantity
- valid currency

## Acceptance Criteria

- invoice can be created
- multiple line items work
- totals calculate instantly
- taxes calculate correctly
- invoice saves
- invoice appears in list
- editing works
- duplicate invoice can be postponed

## Cursor Prompt

```text
Implement Milestone 4: Invoice Creator MVP.

Build a polished invoice creation/editing experience.

Required sections:
- client selection
- invoice metadata
- dynamic line items
- subtotal
- optional discount
- tax
- final total
- notes
- payment instructions

Money must remain integer-cent based in persistence and calculations.

Tax should default from profile settings but be overridable on an invoice.

Support adding/removing line items.

Do not add autosave yet. Use explicit Save Draft.

Preserve unsaved form data when creating a new client from inside the invoice workflow if reasonably achievable without adding large architectural complexity.

Validate the form and give clear inline errors.

Follow the established Wealthsimple-inspired visual language: large financial total, strong spacing, restrained controls, minimal borders, no generic admin-dashboard aesthetic.

Do not implement email, PDF generation, or Stripe.

Finish by testing invoice create/edit flows and running lint/type checks.
```

---

# Milestone 5 — Printable Invoice + PDF

## Goal

Turn an invoice into a professional document.

## Invoice Template

Create one excellent template instead of a template system.

Layout:

```text
Business identity                           INVOICE

Business name                              Invoice #
Address                                    Issue date
Email                                      Due date
Phone

────────────────────────────────────────────────────

BILL TO

Client
Company
Address
Email

────────────────────────────────────────────────────

Description               Qty         Rate         Amount

Photography                 1       $1,500       $1,500
Editing                      5         $100         $500

────────────────────────────────────────────────────

                               Subtotal      $2,000
                               GST              $100
                               TOTAL          $2,100

────────────────────────────────────────────────────

Notes

Payment instructions
```

## Requirements

- good printing
- Letter and A4-friendly
- works in CAD
- business tax ID when configured
- client information
- invoice number
- due date
- line items
- totals
- notes
- payment instructions

## Implementation Choice

Prefer the simplest reliable solution.

Potential approaches:

1. HTML invoice route + print stylesheet
2. Server-rendered PDF generation
3. React PDF

Choose based on repository constraints.

The MVP requirement is:

```text
Download PDF
```

Do not add a template editor.

## Acceptance Criteria

- invoice preview exists
- PDF can be downloaded
- layout is professional
- no dashboard UI appears in PDF
- totals match DB
- long descriptions do not break layout

## Cursor Prompt

```text
Implement Milestone 5: Invoice Preview + PDF.

Create one polished professional invoice template.

Do not build a template designer.

Required:
- invoice preview
- downloadable PDF
- business identity
- client identity
- invoice metadata
- line items
- subtotal/discount/tax/total
- notes
- payment instructions

Choose the simplest dependable PDF architecture appropriate for the existing Next.js project. Prefer server-side generation or a print-safe HTML route if that results in less complexity.

The visual invoice should be minimal, premium, neutral, and highly readable.

Ensure long line-item descriptions and multiple items do not break the document.

No email sending and no Stripe yet.

Verify generated totals exactly match application calculations.
```

---

# Milestone 6 — Send Invoice by Email

## Goal

Send real invoices and automatically track delivery state.

## Email Provider

Use Resend.

## Flow

```text
Invoice detail
    ↓
Send invoice
    ↓
Confirm recipient + message
    ↓
Server generates/loads PDF
    ↓
Resend sends email
    ↓
Success
    ↓
invoice.sent_at = now
status = sent
```

## Send Modal

```text
Send invoice INV-027

To
client@email.com

Subject
Invoice INV-027 from Studio Name

Message
Hi Jane,

Please find invoice INV-027 attached.

Thank you.

[Cancel] [Send invoice]
```

## Tracking

For MVP track:

```text
sent_at
```

Optional later:

```text
delivery status
opened_at
clicked_at
```

Do not make advanced email analytics part of the MVP.

## Safety

Only mark the invoice as sent after Resend confirms successful submission.

Never expose the Resend API key client-side.

## Acceptance Criteria

- invoice email can be sent
- PDF included or secure invoice link included
- sent timestamp persists
- invoice status changes
- failure does not mark sent
- resend action exists

## Cursor Prompt

```text
Implement Milestone 6: Invoice Email Sending.

Integrate Resend server-side.

From an invoice detail page, allow the user to open a Send Invoice dialog containing:
- recipient
- subject
- message

Default the recipient from the client.

Send either the generated invoice PDF as an attachment or a secure invoice URL plus PDF, selecting the simplest robust approach consistent with the existing PDF implementation.

Only update sent_at/status after Resend confirms successful submission.

Handle failures visibly and keep the invoice unsent when sending fails.

Add a Resend Invoice action for previously sent unpaid invoices.

Do not implement advanced email analytics or Stripe yet.

Never expose API credentials to the client.
```

---

# Milestone 7 — Dashboard MVP

## Goal

Make the home page genuinely useful.

## Primary Summary

Selected period:

```text
This month
This year
```

Metrics:

```text
Received
Outstanding
Expenses
Projected net
```

Hero value:

```text
Projected net income
$7,220
```

## Secondary Information

Show:

```text
Invoices needing attention
Recent invoices
```

Needs attention includes:

- overdue
- due soon
- old drafts

## Chart

One chart maximum.

Recommended:

```text
Monthly income vs expenses
```

or:

```text
Income over time
```

Keep it visually minimal.

Do not use pie charts unless they genuinely improve comprehension.

## Dashboard Definitions

Actual:

```text
received payments - paid expenses
```

Projected:

```text
received payments
+ unpaid invoice balances expected in period
- paid expenses
- unpaid expenses due in period
```

## Acceptance Criteria

- values come from real data
- month/year selector works
- totals are correct
- empty dashboard looks intentional
- no fake placeholder financial values
- responsive layout works

## Cursor Prompt

```text
Implement Milestone 7: Financial Dashboard MVP.

Replace the Overview placeholder with a useful financial snapshot.

Required metrics:
- received
- outstanding
- expenses
- projected net income

Allow switching between:
- current month
- current year

Create one subtle chart showing income/expense movement over time.

Add:
- invoices needing attention
- recent invoices

Define all metrics in shared calculation/query functions so financial logic is not duplicated in components.

Projected figures must be clearly labeled as projected.

Avoid creating a dashboard made from many independent cards. Use hierarchy, whitespace, separators, and typography inspired by premium personal finance interfaces.

Do not implement Stripe yet.

Verify financial calculations against sample data before finishing.
```

---

# Milestone 8 — Expense Tracking MVP

## Goal

Allow projected net income to account for outgoing business costs.

## Features

Expenses list:

```text
Vendor        Category       Date       Amount       Status

Camera Rental Equipment      Sep 02     $350         Paid
Assistant     Contractor     Sep 10     $500         Upcoming
```

Create/edit expense:

```text
Vendor *
Description
Category
Amount *
Expense date
Due date
Paid?
Notes
```

Actions:

```text
Mark paid
Edit
Delete
```

## Categories

Keep categories flexible.

Provide suggested defaults:

```text
Equipment
Rental
Travel
Software
Contractor
Insurance
Marketing
Meals
Other
```

But store a simple text/category value rather than building category administration.

## Acceptance Criteria

- expenses CRUD works
- paid/upcoming distinction works
- dashboard incorporates expenses
- month/year metrics update

## Cursor Prompt

```text
Implement Milestone 8: Expense Tracking MVP.

Create the expenses table, RLS, CRUD flows, and expenses list.

Fields:
- vendor
- description
- category
- amount
- expense date
- optional due date
- optional paid_at
- notes

Provide a small predefined category list while keeping the underlying implementation simple.

Support Mark Paid.

Update dashboard calculations so actual and projected net income incorporate expenses correctly.

Do not add receipts/OCR, recurring expenses, bookkeeping ledgers, bank syncing, or tax reporting.

Keep the UI finance-oriented and lightweight.
```

---


# Milestone 8.5 — Québec Tax Centre MVP

## Goal

Add a dedicated tax-planning view for a Québec self-employed sole proprietor.

This feature must help the user understand what their tracked freelance activity may imply at tax time, while clearly distinguishing:

1. **business income reporting**
2. **business expense deductions**
3. **GST/QST collection and remittance**
4. **estimated personal income-tax reserve**

This is a planning and record-summary feature, **not tax filing software** and not professional tax advice.

## Core Accounting Rule

Do not calculate tax-reporting totals only from payments received.

For a typical sole proprietorship, tax reporting generally uses the accrual method:

```text
Income → recognized when earned
Expense → recognized when incurred
```

Cash-flow analytics should continue to use actual payments.

Tax analytics should use accounting-period revenue and expenses.

Keep these concepts separate in code and UI.

Recommended terminology:

```text
Cash received
Outstanding invoices
Business revenue for tax purposes
Deductible expenses
Net business income
```

Never label an estimate as an official tax-return amount unless it can actually be supported from complete tax data.

## Tax Centre Route

Add:

```text
/taxes
```

Navigation may include:

```text
Overview
Invoices
Clients
Expenses
Taxes
Settings
```

The Taxes page should default to the current tax year and allow switching tax years.

## Tax Centre — Primary Summary

Suggested hierarchy:

```text
2026 Tax Estimate

$42,350
Estimated net business income

────────────────────────────────────

Gross business revenue        $51,200
Deductible expenses           $ 8,850
Estimated net business income $42,350

────────────────────────────────────

Sales taxes

GST collected                 $ 2,560
GST credits                     -$310
Estimated GST payable         $ 2,250

QST collected                 $ 5,107
QST refunds                     -$620
Estimated QST payable         $ 4,487

────────────────────────────────────

Estimated reserves

Income tax / QPP              $X,XXX
GST/QST remittance            $X,XXX

Suggested total reserve       $X,XXX
```

Use a visible label such as:

```text
Estimate only
```

with explanatory text.

## Québec GST/QST Defaults

For Québec taxable supplies, default rates should be configurable but initially use:

```text
GST: 5%
QST: 9.975%
Combined: 14.975%
```

Do not hardcode the rates throughout UI components.

Create year/jurisdiction-specific tax configuration in one location.

Example:

```ts
type TaxYearConfig = {
  year: number;
  jurisdiction: "QC";
  gstRate: number;
  qstRate: number;
  smallSupplierThresholdCents: number;
  federalBrackets: TaxBracket[];
  quebecBrackets: TaxBracket[];
  // additional contribution parameters when supported
};
```

This makes annual updates explicit.

## GST/QST Registration State

Profile settings should support:

```text
Registered for GST/QST? Yes / No
GST registration number
QST registration number
```

If not registered:

- do not add GST/QST to invoices by default
- show small-supplier threshold progress
- explain that registration requirements may change once taxable supplies exceed the applicable threshold

Taxable-supply threshold tracking should use sales before GST/QST.

Do not automatically register or make legal determinations for the user.

## $30,000 Small-Supplier Watch

The $30,000 small-supplier threshold applies to **GST/QST registration and collection**, not to whether self-employment/business income must be reported for income tax.

The app must never imply:

```text
Revenue under $30,000 = no income tax reporting
```

Business/professional income must still be included in the tax-reporting summary even when taxable supplies remain below the GST/QST small-supplier threshold.

Create a planning indicator based on tracked worldwide taxable supplies before GST/QST, subject to the normal small-supplier exclusions.

Example:

```text
GST/QST registration threshold

Rolling taxable supplies        $24,350
Threshold                       $30,000

81%
$5,650 remaining
```

### Threshold Calculation

Do NOT implement this as:

```text
annual revenue < $30,000
```

and do NOT simply reset the calculation every January 1.

The small-supplier logic must retain dated taxable supplies and evaluate:

1. whether taxable supplies exceed $30,000 in a **single calendar quarter**; and
2. whether taxable supplies exceed $30,000 across the applicable **four consecutive calendar-quarter** window.

The app should be capable of distinguishing the two cases because registration/collection timing can differ.

Create a centralized helper such as:

```ts
evaluateSmallSupplierStatus({
  taxableSupplies,
  asOfDate,
  thresholdCents
})
```

Suggested result:

```ts
type SmallSupplierStatus = {
  isSmallSupplier: boolean;
  thresholdCents: number;
  currentQuarterTaxableSuppliesCents: number;
  rollingFourQuarterTaxableSuppliesCents: number;
  remainingBeforeThresholdCents: number;
  thresholdExceededBy:
    | "none"
    | "single_quarter"
    | "rolling_four_quarters";
  estimatedRegistrationEffectiveDate?: string;
};
```

Do not attempt to make a binding legal determination. The UI should describe the result as based on transactions recorded in the app.

### Registration State Controls Tax Collection

The user's actual GST/QST registration state is separate from the threshold estimate.

If:

```text
Registered for GST/QST = No
```

and the app's tracked activity still indicates small-supplier status:

```text
GST collected                  $0
QST collected                  $0
GST/QST reserve                $0
```

by default, because the invoice builder should not automatically charge GST/QST.

However, the **income-tax reserve may still be greater than $0**.

Example:

```text
Freelance revenue              $20,000
Deductible expenses            -$3,000
────────────────────────────────────
Estimated net business income  $17,000

Estimated income-tax/QPP
reserve                         $X,XXX

GST/QST reserve                     $0
```

If:

```text
Registered for GST/QST = Yes
```

the app must track GST/QST collected and potential ITCs/ITRs even when taxable supplies are below $30,000, because a person can voluntarily register while still a small supplier.

Therefore:

```text
small-supplier status
```

and:

```text
GST/QST registration status
```

must be separate concepts in the data model and calculation layer.

### Warning States

Add warnings as tracked taxable supplies approach or cross the threshold.

Examples:

```text
Approaching GST/QST registration threshold
```

```text
Tracked taxable supplies exceeded $30,000 in this calendar quarter.
Review your GST/QST registration obligations.
```

```text
Tracked taxable supplies exceeded $30,000 across the applicable
consecutive-quarter window.
Review your GST/QST registration obligations.
```

These are informational only.

## Invoice Tax Breakdown

Every invoice should preserve its actual applied tax configuration.

Recommended invoice fields if not already represented:

```text
gst_rate
gst_cents

qst_rate
qst_cents

taxable_subtotal_cents
```

Do not rely exclusively on the user's current profile rate when rendering historical invoices.

Historical invoices must retain the rates used when they were created.

## Expense Tax Breakdown

Expand expenses so taxable business purchases can optionally capture:

```text
Subtotal
GST paid
QST paid
Total
Business-use %
Potentially deductible?
Tax category
```

The application can then summarize potential:

```text
GST Input Tax Credits (ITCs)
QST Input Tax Refunds (ITRs)
```

For MVP, do not attempt to encode every restriction or special tax rule.

Allow the user to mark an expense:

```text
Eligible for GST/QST recovery
Not eligible
Unsure
```

A conservative `unsure` state is preferable to silently assuming eligibility.

## Deductible Expense Tracking

Expenses should support:

```text
is_tax_deductible
business_use_percent
tax_category
```

Examples:

```text
Software
Equipment
Equipment rental
Contractor
Travel
Vehicle
Home office
Advertising
Professional fees
Meals & entertainment
Insurance
Bank/payment fees
Other
```

The app should calculate an estimated deductible portion:

```text
deductible amount =
expense before recoverable sales taxes
× business use %
× applicable deductibility rule
```

For the first MVP, do not encode complex statutory deduction limits.

Instead:

- use business-use percentage
- allow manual deductible/non-deductible classification
- flag categories with special tax treatment

Potential special-treatment categories should show:

```text
Review at tax time
```

rather than applying a confidently incorrect rule.

## Capital Purchases

Camera bodies, lenses, computers and similar long-lived equipment may not always be treated like ordinary current expenses.

For MVP add:

```text
Expense type:
- Operating expense
- Capital asset
```

Capital assets should be included in records but excluded from the simple operating-expense deduction total unless a future Capital Cost Allowance module is implemented.

Show:

```text
Capital asset — tax treatment requires review
```

Do not implement full CCA classes in this milestone.

## Tax Reporting Summary

Create a yearly export-style summary showing:

```text
Business revenue
Operating expenses
Estimated deductible operating expenses
Capital purchases
Net business income estimate

GST collected
Potential GST ITCs
Estimated net GST

QST collected
Potential QST ITRs
Estimated net QST
```

The purpose is to give the user organized numbers to bring into tax preparation.

## Income-Tax Reserve Estimate

Add an optional planning estimate.

This reserve is completely separate from the GST/QST reserve.

The app should model:

```text
Estimated income-tax/QPP reserve
+
Estimated GST/QST remittance reserve
=
Total suggested tax reserve
```

A user who is not registered for GST/QST and remains a small supplier may have:

```text
GST/QST reserve = $0
```

while still having:

```text
Income-tax/QPP reserve > $0
```

Do not use the $30,000 GST/QST threshold to suppress self-employment income reporting or the income-tax/QPP estimate.

The calculation should be driven by versioned tax-year configuration rather than permanent constants.

At minimum consider:

```text
Federal progressive income tax
Québec progressive income tax
Self-employed QPP estimate
```

The UI must call this:

```text
Estimated tax reserve
```

not:

```text
Taxes owed
```

because the app does not automatically know all of the user's:

- employment income
- investment income
- RRSP deductions
- tax credits
- tuition amounts
- medical credits
- spouse/family amounts
- taxes already withheld
- instalments already paid
- other deductions or contributions

## Optional Tax Profile Inputs

To make the estimate more useful without turning the product into tax software, allow optional annual inputs:

```text
Other taxable income
Income tax already withheld
Tax instalments already paid
Other deductible amounts
```

These should be clearly separated from invoice/business records.

Defaulting them to zero is acceptable.

## 2026 Configuration

For a 2026 Québec configuration, use official values from a centralized config.

Do not scatter bracket constants throughout calculation functions.

The initial config should support:

```text
Federal 2026 progressive brackets
Québec 2026 progressive brackets
QPP 2026 pensionable-income parameters
GST 5%
QST 9.975%
```

Add comments with the official source URL/date next to each annual config definition.

Create tests around each tax bracket boundary.

## Important Tax Disclaimer UX

Include unobtrusive explanatory copy such as:

```text
These estimates are based only on information recorded in this app and
selected tax-year assumptions. They are intended for planning and record
organization and may differ from your final tax return.
```

Do not use alarming legal-warning styling.

## Tax Dashboard Cards

The general Overview page may gain only two compact tax-related surfaces:

```text
Tax reserve
$X,XXX estimated

GST/QST to set aside
$X,XXX
```

Detailed calculations belong in `/taxes`.

Do not overload the main dashboard.

## Acceptance Criteria

- dedicated Taxes page exists
- selected tax year works
- tax reporting uses accrual-oriented invoice/expense dates rather than payment dates
- gross business revenue is calculated
- deductible expense estimate is calculated
- estimated net business income is calculated
- GST collected is tracked
- QST collected is tracked
- expense GST/QST can be captured
- potential ITCs/ITRs are summarized
- estimated GST/QST payable is shown
- small-supplier status evaluates both a single calendar quarter and the applicable four-consecutive-quarter window
- the threshold does not simply reset on January 1
- GST/QST registration status is modeled separately from small-supplier status
- being below $30,000 does not suppress business-income reporting or the income-tax/QPP reserve
- an unregistered small supplier defaults to a $0 GST/QST collection/remittance reserve while still receiving an income-tax estimate
- a voluntarily registered small supplier still tracks GST/QST collection and potential ITCs/ITRs
- capital assets are separated from operating expenses
- optional estimated income-tax/QPP reserve is clearly labeled as an estimate
- tax rules/constants are versioned by tax year
- boundary tests exist for progressive brackets
- dashboard receives only compact tax-reserve summaries
- no tax filing/submission is attempted

## Cursor Prompt

```text
Implement Milestone 8.5: Québec Tax Centre MVP.

This is a planning and tax-record summary module for a self-employed sole proprietor in Québec. It is NOT tax-filing software.

Before coding, review the existing invoices, payments, expenses, profile settings, and financial dashboard.

Critical accounting distinction:
- cash-flow metrics use actual payments
- tax-reporting metrics should generally use income earned and expenses incurred for the applicable fiscal/tax period

Create `/taxes` with a tax-year selector.

Add tax reporting calculations for:
- gross business revenue
- estimated deductible operating expenses
- estimated net business income
- GST collected
- QST collected
- potential GST input tax credits
- potential QST input tax refunds
- estimated net GST payable
- estimated net QST payable
- $30,000 small-supplier threshold status

IMPORTANT:
The $30,000 threshold is a GST/QST small-supplier rule, NOT an income-tax reporting exemption.

Do not set the overall tax reserve to zero merely because business revenue/taxable supplies are below $30,000.

Model two separate reserves:
1. estimated income-tax/QPP reserve
2. estimated GST/QST remittance reserve

If the user is not GST/QST registered and remains a small supplier, the GST/QST reserve can be $0 while the income-tax/QPP reserve remains non-zero.

GST/QST registration status and small-supplier status must be separate fields/concepts. A voluntarily registered small supplier must still collect/track applicable GST/QST.

Do not calculate the $30,000 threshold as simple annual revenue and do not reset it on January 1.

Use dated taxable supplies to evaluate:
- exceeding $30,000 in a single calendar quarter
- exceeding $30,000 over the applicable four consecutive calendar quarters

Preserve enough information to distinguish these cases and surface a review warning because registration timing can differ.

Use configurable, versioned tax-year data. For the initial Québec configuration use current official 2026 values, including GST 5%, QST 9.975%, federal progressive income-tax brackets, Québec progressive income-tax brackets, and relevant QPP parameters.

Do not scatter rates and bracket values throughout components.

Update invoices so historical documents preserve the GST/QST rates and amounts actually applied at creation time.

Update expenses to optionally capture:
- subtotal
- GST
- QST
- business-use percentage
- tax deductibility classification
- tax category
- operating expense vs capital asset
- GST/QST recovery eligibility: eligible / not eligible / unsure

Do not implement full Capital Cost Allowance rules. Capital purchases should be recorded and separated from ordinary deductible operating expenses with a "review at tax time" state.

Add an optional Estimated Tax Reserve calculation using the tax-year configuration. Clearly label it as an estimate, not taxes owed.

Allow optional annual tax-profile adjustments:
- other taxable income
- tax already withheld
- instalments already paid
- other deductible amounts

Do not attempt to model every personal tax credit or deduction.

Add a compact tax-reserve and GST/QST set-aside summary to the main Overview without overloading it.

Add automated tests for:
- revenue-by-tax-year logic
- deductible expense calculations
- GST/QST calculations
- small-supplier single-quarter threshold calculations
- small-supplier rolling four-quarter calculations across calendar years
- no January 1 threshold reset
- unregistered-small-supplier GST/QST reserve = 0 behavior
- voluntarily registered small-supplier GST/QST behavior
- income-tax reserve remains independent of the GST/QST threshold
- progressive bracket boundaries
- business-use percentages
- exclusion of capital assets from simple operating-expense deductions

Use clear explanatory copy stating that results are planning estimates based on data recorded in the app.

Finish with lint, TypeScript, tests, and a summary of database migrations and assumptions.
```

---

# Milestone 9 — Manual Payment Tracking

## Goal

Correctly model payments independently from invoice status.

## Why

An invoice may be paid outside Stripe.

Examples:

- e-Transfer
- cheque
- cash
- bank transfer

Create a `payments` table.

## Invoice Detail

Show:

```text
Total          $2,100
Paid           $1,000
Remaining      $1,100
```

Payments:

```text
Aug 30   E-Transfer   $1,000
```

Action:

```text
+ Record payment
```

## Record Payment Modal

```text
Amount
Date
Method
Reference / notes
```

Automatically mark invoice paid once:

```text
SUM(payments) >= invoice total
```

This architecture prepares the app for partial Stripe payments later.

## Acceptance Criteria

- manual payments can be recorded
- payments appear in invoice history
- remaining balance is correct
- full payment marks invoice paid
- dashboard uses payments rather than invoice status for received income

## Cursor Prompt

```text
Implement Milestone 9: Manual Payment Tracking.

Create a dedicated payments table and RLS.

Add Record Payment to invoice detail.

Fields:
- amount
- date
- method
- notes/reference

Supported manual methods:
- e-Transfer
- cash
- cheque
- bank transfer
- other

Invoice financial state must be derived from payments:
- total
- amount paid
- remaining balance

When cumulative payments reach the invoice total, set paid_at or derive paid status consistently according to the existing architecture.

Update dashboard received-income calculations so they use actual payment records rather than assuming every "paid" invoice was paid on its issue date.

Prepare the model for Stripe payments but do not integrate Stripe yet.
```

---

# Milestone 10 — Public Invoice Page

## Goal

Create a safe page a client can open without an account.

Route:

```text
/invoice/[publicToken]
```

Never expose sequential internal invoice IDs.

## Page

Show:

- business
- client
- invoice number
- dates
- line items
- total
- amount paid
- amount remaining
- payment instructions
- payment status

If unpaid:

```text
Pay invoice
```

The button should remain disabled/hidden until Stripe is implemented.

## Optional Tracking

When first opened:

```text
viewed_at
```

This is acceptable if implementation is simple.

Do not implement invasive analytics.

## Security

Public endpoint must expose only invoice information needed by the recipient.

Never expose:

- user IDs
- internal notes
- unrelated invoices
- Stripe secrets
- Supabase secrets

## Acceptance Criteria

- public token route works
- token is unguessable
- paid/unpaid states render
- private internal data is absent
- invalid token returns safe 404

## Cursor Prompt

```text
Implement Milestone 10: Public Invoice Page.

Create a secure public invoice route using the existing public_token field.

The page must require no authentication.

Expose only information required to view the invoice:
- business identity
- invoice number/dates
- client
- line items
- totals
- amount paid
- balance remaining
- payment instructions
- status

Do not expose internal database IDs, private notes, user IDs, or unrelated data.

Optionally record viewed_at on first legitimate view if this can be implemented safely and simply.

Include the visual Pay Invoice location but do not activate Stripe yet.

Invalid tokens should safely return not found.
```

---

# Milestone 11 — Stripe Checkout MVP

## Goal

Allow a client to pay an invoice through Stripe without the app handling payment details.

## Architecture

```text
Public invoice
    ↓
Pay invoice
    ↓
POST server endpoint
    ↓
Create Stripe Checkout Session
    ↓
Redirect to Stripe
    ↓
Payment occurs
    ↓
Stripe webhook
    ↓
Create payment record
    ↓
Invoice becomes paid
```

## Important Principles

The app must never:

- collect card numbers
- store card numbers
- proxy raw payment credentials
- mark an invoice paid merely because checkout was opened
- trust redirect success alone

Stripe webhook is authoritative.

## Stripe Metadata

Associate checkout with:

```text
invoice_id
user_id
invoice_number
```

Do not trust client-submitted amount.

Server must calculate payment amount from the database.

## Webhook

Handle only required events initially.

Example:

```text
checkout.session.completed
```

Verify Stripe webhook signatures.

Webhook processing must be idempotent.

Prevent duplicate payment records.

## Payment Amount

MVP:

```text
pay full remaining invoice balance
```

Do not allow arbitrary partial payments through Stripe initially.

## Acceptance Criteria

- test checkout works
- amount comes from DB
- successful webhook creates payment
- invoice updates automatically
- duplicate webhook does not duplicate payment
- failed/cancelled checkout does not mark paid
- webhook signature verified

## Cursor Prompt

```text
Implement Milestone 11: Stripe Checkout MVP.

Integrate Stripe in test mode.

From the public invoice page, allow a recipient to pay the full remaining invoice balance through Stripe Checkout.

Architecture requirements:
- Checkout Session must be created server-side.
- Payment amount must be loaded from the database, never trusted from client input.
- Include invoice identifiers in Stripe metadata.
- Redirect the client to Stripe-hosted checkout.
- Implement a Stripe webhook.
- Verify webhook signatures.
- Treat the webhook as the source of truth.
- On successful payment, create a payments record and update invoice paid state.
- Webhook processing must be idempotent.
- Duplicate webhook delivery must not create duplicate payments.
- Opening checkout or returning through a success URL must never by itself mark the invoice paid.

Do not collect or store card details.

MVP supports paying only the full remaining balance.

Add clear paid, cancelled, and retry states on the public invoice page.

Use Stripe test mode and document the required environment variables.
```

---

# Milestone 12 — Payment UX + Email Integration

## Goal

Turn Stripe payment into a polished end-to-end flow.

## Invoice Email

When Stripe is enabled for an invoice:

```text
View & Pay Invoice
```

should link to the application's public invoice page.

The public page contains:

```text
Pay securely
```

which redirects to Stripe.

## Successful Payment

After webhook confirmation:

- invoice page displays Paid
- payment appears in owner dashboard
- paid timestamp appears
- dashboard metrics update

Optional:

Send owner:

```text
Invoice INV-027 was paid.
$2,100
Jane Doe
```

Optional:

Send customer payment confirmation.

## Acceptance Criteria

Complete path works:

```text
Create
→ Send
→ Open
→ Pay
→ Stripe
→ Webhook
→ Payment recorded
→ Dashboard updated
```

## Cursor Prompt

```text
Implement Milestone 12: End-to-End Payment UX.

Connect invoice email, public invoice viewing, Stripe Checkout, payment recording, and dashboard updates into one polished flow.

Invoice emails should link to the public invoice page.

Public unpaid invoices should prominently but calmly expose Pay securely.

After verified Stripe webhook payment:
- create payment record
- update invoice state
- show Paid on public page
- show payment on invoice detail
- update dashboard metrics

If straightforward using the existing Resend integration, send a concise payment notification to the owner. Customer payment confirmation may also be added if it does not meaningfully increase scope.

Do not add another payment provider.

Test the full workflow end to end using Stripe test mode.
```

---

# Milestone 13 — UX Polish

## Goal

Make the app feel finished rather than merely functional.

## Review

Audit:

- spacing
- hierarchy
- typography
- mobile behavior
- empty states
- loading states
- skeletons
- toasts
- dialogs
- destructive actions
- currency formatting
- dates
- focus states
- keyboard navigation
- accessibility

## Add

Useful actions:

```text
Duplicate invoice
Mark void
Resend invoice
Copy public link
Record payment
Download PDF
```

## Do Not Add

No large new features.

This milestone is refinement only.

## Cursor Prompt

```text
Implement Milestone 13: UX Polish.

Do not add new product domains.

Audit all completed screens for:
- typography
- spacing
- hierarchy
- responsive behavior
- accessibility
- empty states
- loading states
- error states
- destructive confirmation
- keyboard behavior
- focus styles
- currency/date consistency

Add only small high-value invoice actions if missing:
- duplicate
- void
- resend
- copy public link
- record payment
- download PDF

Refine the application toward a calm, premium, Wealthsimple-inspired financial experience.

Remove visual clutter and unnecessary card containers.

Do not redesign working flows solely for novelty.

Finish with a complete regression pass.
```

---

# Milestone 14 — Production Hardening

## Goal

Make the personal app safe enough for real use.

## Security Checklist

- Supabase RLS verified
- service role server-only
- Stripe secret server-only
- Resend secret server-only
- webhook signature verified
- public invoice tokens random
- public page exposes minimal data
- server validates invoice ownership
- server never trusts payment amounts from browser

## Reliability

Handle:

- duplicate webhook
- deleted client relationships
- invoice with zero balance
- invalid email
- failed email
- cancelled Stripe checkout
- deleted invoice
- invalid public token
- invoice already paid
- webhook retry
- stale browser state

## Database

Add indexes for:

```text
user_id
client_id
invoice_number
issue_date
due_date
public_token
paid_at
```

where appropriate.

## Backups

Document Supabase backup expectations for the selected plan.

## Cursor Prompt

```text
Implement Milestone 14: Production Hardening.

Do not add product features.

Perform a security and reliability review of the completed application.

Specifically audit:
- Supabase RLS
- server/client environment variable boundaries
- invoice ownership checks
- public invoice token security
- Stripe webhook verification
- Stripe webhook idempotency
- payment amount integrity
- Resend error handling

Test edge cases:
- already-paid invoice
- zero balance
- duplicate webhook
- invalid token
- cancelled checkout
- failed email
- missing client
- stale UI data

Add appropriate database indexes.

Run:
- lint
- TypeScript
- production build

Fix all material issues before considering the MVP production-ready.

Write a short SECURITY.md describing the trust boundaries and sensitive environment variables.
```

---

# 18. MVP Completion Definition

The core MVP is complete after **Milestone 9**.

At that point the app can:

```text
✓ authenticate
✓ manage business profile
✓ manage clients
✓ create invoices
✓ edit invoices
✓ generate invoice PDFs
✓ email invoices
✓ track sent invoices
✓ manually record payments
✓ track expenses
✓ calculate actual net income
✓ calculate projected net income
✓ show monthly/yearly dashboard metrics
✓ summarize annual business revenue and deductible expenses
✓ track GST/QST collected and potential recoverable tax
✓ estimate GST/QST amounts to set aside
✓ monitor the small-supplier registration threshold
✓ provide an estimated Québec/federal income-tax reserve
```

The **online payment MVP** is complete after **Milestone 12**.

Then:

```text
✓ clients can open a hosted invoice
✓ clients can pay with Stripe
✓ the app does not handle card credentials
✓ Stripe reports payment through webhook
✓ payment is recorded automatically
✓ dashboard reflects payment
```

---

# 19. Suggested Core Screens

Keep the product to roughly these screens.

## Authentication

```text
/login
```

## Overview

```text
/
```

## Invoices

```text
/invoices
/invoices/new
/invoices/[id]
/invoices/[id]/edit
```

## Public Invoice

```text
/invoice/[publicToken]
```

## Clients

```text
/clients
/clients/[id]
```

## Expenses

```text
/expenses
```

## Taxes

```text
/taxes
```

## Settings

```text
/settings
```

Avoid creating more navigation until necessary.

---

# 20. Invoice Detail Screen

Recommended hierarchy:

```text
INV-027                        [Sent]

Jane Doe
Due Sep 14, 2026

$2,100.00
Total invoice

Paid          $0
Remaining     $2,100

[Send / Resend] [Record payment] [...]

────────────────────────────────────

Invoice

Photography         1 × $1,500     $1,500
Editing              5 × $100         $500

Subtotal                           $2,000
GST                                  $100

Total                              $2,100

────────────────────────────────────

Activity

Aug 31  Invoice created
Aug 31  Invoice sent
Sep 01  Invoice viewed
```

Activity can initially be generated from timestamps rather than requiring a full activity-event architecture.

---

# 21. Invoice List Design

Avoid visually heavy table borders.

Suggested:

```text
Invoices                                      + New invoice

[All] [Draft] [Sent] [Paid] [Overdue]     Search...

────────────────────────────────────────────────────────────

INV-027
Jane Doe                     Sep 14        $2,100      Sent

INV-026
ACME                         Sep 10        $1,800      Paid

INV-025
Studio XYZ                   Aug 15          $450      Overdue
```

Use:

- row separators
- whitespace
- subtle hover
- status text/pill
- tabular numbers

Avoid boxed cells.

---

# 22. Empty States

## Dashboard

```text
Your finances will appear here.

Create your first invoice to start tracking income.

[Create invoice]
```

## Invoices

```text
No invoices yet.

Create your first invoice and start tracking what you're owed.

[Create invoice]
```

## Clients

```text
No clients yet.

Save clients to make future invoices faster.

[Add client]
```

## Expenses

```text
No expenses recorded.

Add expenses when you want them included in your net-income projections.

[Add expense]
```

---

# 23. Loading Strategy

Prefer:

- route-level loading states
- skeletons for dashboard metrics
- skeleton rows for lists

Avoid full-page blocking spinners whenever possible.

Buttons should indicate mutation state.

Example:

```text
Send invoice
→
Sending…
```

Disable repeat action while mutation is active.

---

# 24. Error Strategy

User-facing errors should explain the action that failed.

Bad:

```text
Something went wrong.
```

Better:

```text
We couldn't send this invoice.
Your invoice is still saved as a draft.
```

Log technical details server-side where appropriate.

Never expose provider secrets or raw backend stack traces.

---

# 25. Responsive Strategy

Desktop is primary, but every MVP screen should work on mobile.

Desktop:

```text
sidebar + content
```

Mobile:

```text
compact header/navigation
single-column forms
stacked summary metrics
invoice table → invoice rows/cards
```

The public invoice/payment screen should be particularly strong on mobile because clients may open it from email on their phones.

---

# 26. Accessibility

At minimum:

- semantic labels
- keyboard-accessible menus
- visible focus rings
- sufficient contrast
- statuses not communicated through color alone
- dialogs trap focus properly
- errors tied to form inputs
- mobile touch targets are comfortable

shadcn primitives should be retained where they help accessibility.

---

# 27. Data Fetching Rules

Prefer server-side queries where appropriate.

Use client components only for:

- interactive forms
- live calculations
- dialogs
- filters requiring browser state
- charts

Do not turn the entire app into client-side React unnecessarily.

After mutations, use appropriate Next.js revalidation/refetching.

Avoid installing a global state library unless a real cross-page state problem appears.

---

# 28. Form Rules

Use consistent form architecture.

Forms should support:

- validation
- loading state
- server error
- field error
- cancel
- submit

Invoice calculation should update in real time client-side.

The server must independently validate persisted totals where security or payment behavior depends on them.

---

# 29. Stripe Security Rules

These rules are mandatory.

Never:

```text
receive raw card data
store card data
accept invoice amount from browser as authoritative
mark paid from redirect URL
skip webhook signature verification
```

Always:

```text
load invoice server-side
calculate balance server-side
create checkout server-side
verify webhook
deduplicate webhook processing
record provider payment ID
```

Stripe checkout should be treated as an external payment surface.

---

# 30. Environment Variables

Expected example:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

RESEND_API_KEY=
EMAIL_FROM=

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=
```

Document actual environment variables in:

```text
.env.example
```

Never commit `.env.local`.

---

# 31. Suggested Development Seed Data

Create local/dev seed fixtures.

## Clients

```text
Jane Doe
ACME Creative
Studio XYZ
```

## Invoices

```text
Draft
Sent
Paid
Overdue-derived
```

## Expenses

```text
Adobe Creative Cloud
Camera rental
Second shooter
Travel
```

This allows design/testing without fake hardcoded UI values.

---

# 32. Testing Priorities

This personal MVP does not require enormous test coverage.

Prioritize testing logic where mistakes matter financially.

High-value unit tests:

```text
invoice subtotal
discount
tax
total
partial payment
remaining balance
overdue derivation
actual income
projected income
actual net
projected net
GST calculation
QST calculation
ITC/ITR summaries
tax-year revenue recognition
deductible business-use percentage
small-supplier threshold tracking
progressive income-tax bracket boundaries
```

Integration tests later:

```text
invoice create
send invoice
record payment
Stripe webhook idempotency
```

Do not spend early milestones building a huge test harness.

---

# 33. Stretch Goals

Only consider after Milestone 14.

## Tier 1

- recurring clients
- saved invoice line-item presets
- duplicate invoice
- customizable invoice logo
- payment reminder email
- overdue reminder
- CSV export
- downloadable annual summary
- client invoice history
- invoice tags

## Tier 2

- partial Stripe payments
- deposits
- Stripe Connect if the product ever becomes multi-user
- Square
- PayPal
- additional invoice templates
- recurring invoices
- expense attachments
- receipt upload
- tax summaries

## Tier 3

Only if the product evolves beyond personal use:

- organizations
- team members
- user onboarding
- subscription billing
- custom domains
- client accounts
- multi-business profiles
- multi-currency reporting
- audit logs

---

# 34. Features Specific to Photography / Videography

These should remain lightweight.

Potential reusable invoice line-item presets:

```text
Shoot day
Half-day shoot
Editing
Retouching
Colour grading
Second shooter
Assistant
Equipment rental
Travel
Drone operator
Usage/licensing
Rush delivery
Additional revision
Overtime
```

Do not create a separate photography workflow engine.

The app should remain generic enough to invoice other freelance work.

---

# 35. Canada / Québec-Specific Considerations

The initial product can assume:

```text
Default currency: CAD
Country: Canada
Province: Québec
```

But currency should still be stored per invoice.

Profile should support:

```text
GST registration status
GST registration number
QST registration status
QST registration number
```

Keep these concepts separate:

```text
Income-tax reporting
≠
GST/QST registration
```

The $30,000 small-supplier threshold must never be treated as an exemption from reporting self-employment/business income.

For GST/QST threshold monitoring, preserve dated taxable supplies and evaluate calendar-quarter windows rather than using a simple annual-revenue counter.

Do not attempt automated tax filing.

Tax behavior should remain configurable and versioned because registration rules, rates, brackets, contribution parameters, and other tax rules can change.

---

# 36. Design Review Checklist for Cursor

Before considering any screen complete, inspect it against these questions:

```text
Is the most important financial value visually obvious?

Can any card/container be removed?

Is there enough whitespace?

Are there unnecessary borders?

Are there too many buttons visible simultaneously?

Does secondary information look secondary?

Do monetary values align cleanly?

Are statuses understandable without relying only on color?

Does this look like a financial product rather than an admin dashboard?

Would the page still be understandable with no chart?

Does mobile preserve the same information hierarchy?
```

---

# 37. Cursor General Rules

Include these rules in Cursor project instructions.

```text
1. Read the current repository before modifying architecture.

2. Implement only the requested milestone.

3. Do not anticipate future milestones with unnecessary abstractions.

4. Keep the application runnable after every milestone.

5. Reuse existing components instead of rebuilding similar ones.

6. Maintain strict TypeScript typing.

7. Never use `any` unless absolutely necessary and documented.

8. Financial amounts must use integer cents.

9. All sensitive provider actions must execute server-side.

10. Supabase tables containing user data require RLS.

11. Do not expose service-role credentials.

12. Stripe webhook events are authoritative for Stripe payment success.

13. Never trust a payment amount sent by the browser.

14. Keep the UI visually minimal.

15. Avoid installing packages when the platform or existing dependencies already solve the problem.

16. Do not introduce global state management unless required.

17. Preserve accessible shadcn primitives.

18. Add loading, empty, and error states for every asynchronous screen.

19. Run lint and TypeScript checks after each milestone.

20. At the end of each milestone, summarize:
    - files changed
    - database changes
    - behavior implemented
    - environment variables added
    - known limitations
```

---

# 38. Initial Cursor Bootstrap Prompt

Use this before Milestone 0 if starting from an empty/new repository.

```text
You are building a personal invoice creator and financial tracker for a freelance photographer/videographer.

Read DEVELOPMENT_PLAN.md completely before making architectural decisions.

The product is intentionally small.

Its core responsibilities are:
1. create invoices
2. generate professional invoice documents
3. email invoices
4. track invoice status
5. record payments
6. track basic business expenses
7. display actual/projected net income
8. summarize Québec freelance tax-reporting data and estimated tax reserves
9. eventually allow invoice payment through Stripe-hosted Checkout

It is NOT:
- a CRM
- accounting software
- project management software
- a gallery platform
- a scheduling platform

Stack:
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Resend
- Stripe
- Vercel

Visual direction:
Use Wealthsimple as strong product-design inspiration without copying branded assets or proprietary layouts.

Prioritize:
- generous whitespace
- strong typography
- minimal surfaces
- subtle dividers
- restrained neutral colors
- clear money hierarchy
- very limited decorative UI
- excellent responsive behavior
- fast, simple interactions

Work milestone-by-milestone.

Do not implement a later milestone until the current milestone is complete and stable.

When implementing a milestone:
1. inspect the repository
2. state the relevant existing architecture
3. implement the smallest complete solution
4. run checks
5. fix issues
6. summarize the completed changes
```

---

# 39. Recommended Build Order

```text
M0  Foundation
 ↓
M1  Authentication / Profile
 ↓
M2  Clients
 ↓
M3  Invoice Data + List
 ↓
M4  Invoice Creator
 ↓
M5  PDF
 ↓
M6  Email
 ↓
M7  Dashboard
 ↓
M8  Expenses
 ↓
M8.5 Québec Tax Centre
 ↓
M9  Manual Payments
 ─────────────────────
 CORE PERSONAL MVP
 ↓
M10 Public Invoice
 ↓
M11 Stripe Checkout
 ↓
M12 Payment UX
 ─────────────────────
 ONLINE PAYMENT MVP
 ↓
M13 UX Polish
 ↓
M14 Production Hardening
```

The critical product principle is:

> **Do not build accounting software. Build the fastest, clearest way to know what was invoiced, what was paid, what is still owed, and what income is expected.**

That principle should be used whenever there is ambiguity about whether a feature belongs in the application.
