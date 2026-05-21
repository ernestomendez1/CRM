-- =====================================================================
-- CRM + Invoicing — Initial schema
-- All domain tables include business_id for multi-tenancy.
-- RLS policies are defined in a separate migration.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------
create table public.businesses (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  legal_name      text,
  tax_id          text,                                 -- RNC
  email           text,
  phone           text,
  address         text,
  city            text,
  country         text default 'DO',
  logo_url        text,
  default_currency        text not null default 'DOP',
  default_tax_rate        numeric(5,4) not null default 0.18,    -- ITBIS 18%
  default_payment_terms_days integer not null default 30,
  invoice_prefix         text not null default 'INV-',
  invoice_next_number    integer not null default 1,
  quotation_prefix       text not null default 'QUO-',
  quotation_next_number  integer not null default 1,
  pdf_settings    jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- business_members  (user ↔ business with role)
-- ---------------------------------------------------------------------
create table public.business_members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner'
              check (role in ('owner','admin','accountant','viewer')),
  created_at  timestamptz not null default now(),
  unique (business_id, user_id)
);
create index business_members_user_idx on public.business_members(user_id);

-- ---------------------------------------------------------------------
-- shared trigger fn: keep updated_at fresh
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  name          text not null,
  company_name  text,
  tax_id        text,
  tax_id_type   text check (tax_id_type in ('rnc','cedula','passport','other')),
  email         text,
  phone         text,
  address       text,
  city          text,
  country       text default 'DO',
  notes         text,
  is_active     boolean not null default true,
  deleted_at    timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index customers_business_idx on public.customers(business_id) where deleted_at is null;
create index customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create index customers_tax_id_trgm on public.customers using gin (tax_id gin_trgm_ops);

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- products / services
-- ---------------------------------------------------------------------
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  name               text not null,
  description        text,
  unit_price         numeric(14,2) not null default 0,
  is_taxable         boolean not null default true,
  tax_rate_override  numeric(5,4),
  type               text not null default 'service' check (type in ('product','service')),
  sku                text,
  is_active          boolean not null default true,
  deleted_at         timestamptz,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (business_id, sku) deferrable initially deferred
);
create index products_business_idx on public.products(business_id) where deleted_at is null;
create index products_name_trgm on public.products using gin (name gin_trgm_ops);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- quotations
-- ---------------------------------------------------------------------
create table public.quotations (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  customer_id           uuid not null references public.customers(id) on delete restrict,
  quotation_number      text not null,
  issue_date            date not null default current_date,
  expiry_date           date,
  status                text not null default 'draft'
                        check (status in ('draft','sent','accepted','rejected','expired')),
  notes                 text,
  terms                 text,
  subtotal              numeric(14,2) not null default 0,
  discount_total        numeric(14,2) not null default 0,
  tax_total             numeric(14,2) not null default 0,
  total                 numeric(14,2) not null default 0,
  currency              text not null default 'DOP',
  converted_invoice_id  uuid,                                -- FK set after invoices table created
  deleted_at            timestamptz,
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (business_id, quotation_number)
);
create index quotations_business_idx on public.quotations(business_id) where deleted_at is null;
create index quotations_customer_idx on public.quotations(customer_id);

create trigger trg_quotations_updated_at
  before update on public.quotations
  for each row execute function public.set_updated_at();

create table public.quotation_items (
  id              uuid primary key default gen_random_uuid(),
  quotation_id    uuid not null references public.quotations(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  description     text not null,
  quantity        numeric(14,4) not null default 1,
  unit_price      numeric(14,2) not null default 0,
  discount_pct    numeric(5,4) not null default 0,
  tax_rate        numeric(5,4) not null default 0,
  line_subtotal   numeric(14,2) not null default 0,
  line_tax        numeric(14,2) not null default 0,
  line_total      numeric(14,2) not null default 0,
  sort_order      integer not null default 0
);
create index quotation_items_quotation_idx on public.quotation_items(quotation_id);

-- ---------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------
create table public.invoices (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  customer_id       uuid not null references public.customers(id) on delete restrict,
  quotation_id      uuid references public.quotations(id) on delete set null,
  invoice_number    text not null,
  issue_date        date not null default current_date,
  due_date          date,
  status            text not null default 'draft'
                    check (status in ('draft','issued','partially_paid','paid','overdue','cancelled')),
  notes             text,
  terms             text,
  subtotal          numeric(14,2) not null default 0,
  discount_total    numeric(14,2) not null default 0,
  tax_total         numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0,
  amount_paid       numeric(14,2) not null default 0,
  balance_due       numeric(14,2) not null default 0,
  currency          text not null default 'DOP',
  fiscal_metadata   jsonb not null default '{}'::jsonb,
  deleted_at        timestamptz,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (business_id, invoice_number)
);
create index invoices_business_idx on public.invoices(business_id) where deleted_at is null;
create index invoices_customer_idx on public.invoices(customer_id);
create index invoices_status_idx on public.invoices(status) where deleted_at is null;

create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- Add the deferred FK now that invoices exists.
alter table public.quotations
  add constraint quotations_converted_invoice_fk
  foreign key (converted_invoice_id) references public.invoices(id) on delete set null;

create table public.invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  description   text not null,
  quantity      numeric(14,4) not null default 1,
  unit_price    numeric(14,2) not null default 0,
  discount_pct  numeric(5,4) not null default 0,
  tax_rate      numeric(5,4) not null default 0,
  line_subtotal numeric(14,2) not null default 0,
  line_tax      numeric(14,2) not null default 0,
  line_total    numeric(14,2) not null default 0,
  sort_order    integer not null default 0
);
create index invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- ---------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  invoice_id    uuid not null references public.invoices(id) on delete restrict,
  payment_date  date not null default current_date,
  amount        numeric(14,2) not null,
  method        text not null check (method in ('cash','transfer','check','card','other')),
  reference     text,
  notes         text,
  deleted_at    timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
create index payments_invoice_idx on public.payments(invoice_id) where deleted_at is null;
create index payments_business_idx on public.payments(business_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------
create table public.expenses (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references public.businesses(id) on delete cascade,
  vendor_name             text not null,
  vendor_tax_id           text,
  expense_date            date not null default current_date,
  category                text,
  description             text,
  subtotal                numeric(14,2) not null default 0,
  tax_amount              numeric(14,2) not null default 0,
  total                   numeric(14,2) not null default 0,
  currency                text not null default 'DOP',
  has_fiscal_receipt      boolean not null default false,
  fiscal_receipt_number   text,
  receipt_file_url        text,
  payment_method          text check (payment_method in ('cash','transfer','card','credit','other')),
  deleted_at              timestamptz,
  created_by              uuid references auth.users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index expenses_business_idx on public.expenses(business_id) where deleted_at is null;
create index expenses_date_idx on public.expenses(expense_date) where deleted_at is null;

create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  entity_type   text not null,
  entity_id     uuid not null,
  action        text not null,
  actor_user_id uuid references auth.users(id),
  changes       jsonb,
  occurred_at   timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index audit_log_business_time_idx on public.audit_log(business_id, occurred_at desc);

-- ---------------------------------------------------------------------
-- Atomic invoice / quotation number allocator
-- ---------------------------------------------------------------------
create or replace function public.next_invoice_number(p_business_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_num integer;
begin
  update public.businesses
     set invoice_next_number = invoice_next_number + 1
   where id = p_business_id
   returning invoice_prefix, invoice_next_number - 1 into v_prefix, v_num;
  if not found then
    raise exception 'Business % not found', p_business_id;
  end if;
  return v_prefix || lpad(v_num::text, 5, '0');
end;
$$;

create or replace function public.next_quotation_number(p_business_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_num integer;
begin
  update public.businesses
     set quotation_next_number = quotation_next_number + 1
   where id = p_business_id
   returning quotation_prefix, quotation_next_number - 1 into v_prefix, v_num;
  if not found then
    raise exception 'Business % not found', p_business_id;
  end if;
  return v_prefix || lpad(v_num::text, 5, '0');
end;
$$;
