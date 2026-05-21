-- =====================================================================
-- RLS policies
-- Strategy: every domain row has a business_id. A user can act on a row
-- iff they have a row in business_members for that business_id.
-- =====================================================================

-- Helper: businesses the current user belongs to.
create or replace function public.user_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id
    from public.business_members
   where user_id = auth.uid();
$$;

-- Enable RLS on all domain tables.
alter table public.businesses        enable row level security;
alter table public.business_members  enable row level security;
alter table public.customers         enable row level security;
alter table public.products          enable row level security;
alter table public.quotations        enable row level security;
alter table public.quotation_items   enable row level security;
alter table public.invoices          enable row level security;
alter table public.invoice_items     enable row level security;
alter table public.payments          enable row level security;
alter table public.expenses          enable row level security;
alter table public.audit_log         enable row level security;

-- ---------------------------------------------------------------------
-- businesses: user must be a member to read; only owners/admins update.
-- ---------------------------------------------------------------------
create policy businesses_select on public.businesses
  for select using (id in (select public.user_business_ids()));

create policy businesses_update on public.businesses
  for update using (
    exists (
      select 1 from public.business_members bm
       where bm.business_id = businesses.id
         and bm.user_id = auth.uid()
         and bm.role in ('owner','admin')
    )
  );

-- Inserts/deletes of businesses are done via service-role only (onboarding).

-- ---------------------------------------------------------------------
-- business_members: a user can see their own memberships.
-- ---------------------------------------------------------------------
create policy business_members_select on public.business_members
  for select using (user_id = auth.uid()
                    or business_id in (select public.user_business_ids()));

-- Invites/role changes handled via service-role.

-- ---------------------------------------------------------------------
-- Generic per-business CRUD policies for the domain tables.
-- A small helper macro pattern via repeated DDL.
-- ---------------------------------------------------------------------

-- customers
create policy customers_select on public.customers
  for select using (business_id in (select public.user_business_ids()));
create policy customers_insert on public.customers
  for insert with check (business_id in (select public.user_business_ids()));
create policy customers_update on public.customers
  for update using (business_id in (select public.user_business_ids()));
create policy customers_delete on public.customers
  for delete using (business_id in (select public.user_business_ids()));

-- products
create policy products_select on public.products
  for select using (business_id in (select public.user_business_ids()));
create policy products_insert on public.products
  for insert with check (business_id in (select public.user_business_ids()));
create policy products_update on public.products
  for update using (business_id in (select public.user_business_ids()));
create policy products_delete on public.products
  for delete using (business_id in (select public.user_business_ids()));

-- quotations
create policy quotations_select on public.quotations
  for select using (business_id in (select public.user_business_ids()));
create policy quotations_insert on public.quotations
  for insert with check (business_id in (select public.user_business_ids()));
create policy quotations_update on public.quotations
  for update using (business_id in (select public.user_business_ids()));
create policy quotations_delete on public.quotations
  for delete using (business_id in (select public.user_business_ids()));

-- quotation_items (no direct business_id — join via quotation)
create policy quotation_items_select on public.quotation_items
  for select using (
    exists (select 1 from public.quotations q
             where q.id = quotation_items.quotation_id
               and q.business_id in (select public.user_business_ids()))
  );
create policy quotation_items_modify on public.quotation_items
  for all using (
    exists (select 1 from public.quotations q
             where q.id = quotation_items.quotation_id
               and q.business_id in (select public.user_business_ids()))
  )
  with check (
    exists (select 1 from public.quotations q
             where q.id = quotation_items.quotation_id
               and q.business_id in (select public.user_business_ids()))
  );

-- invoices
create policy invoices_select on public.invoices
  for select using (business_id in (select public.user_business_ids()));
create policy invoices_insert on public.invoices
  for insert with check (business_id in (select public.user_business_ids()));
create policy invoices_update on public.invoices
  for update using (business_id in (select public.user_business_ids()));
create policy invoices_delete on public.invoices
  for delete using (business_id in (select public.user_business_ids()));

-- invoice_items
create policy invoice_items_select on public.invoice_items
  for select using (
    exists (select 1 from public.invoices i
             where i.id = invoice_items.invoice_id
               and i.business_id in (select public.user_business_ids()))
  );
create policy invoice_items_modify on public.invoice_items
  for all using (
    exists (select 1 from public.invoices i
             where i.id = invoice_items.invoice_id
               and i.business_id in (select public.user_business_ids()))
  )
  with check (
    exists (select 1 from public.invoices i
             where i.id = invoice_items.invoice_id
               and i.business_id in (select public.user_business_ids()))
  );

-- payments
create policy payments_select on public.payments
  for select using (business_id in (select public.user_business_ids()));
create policy payments_insert on public.payments
  for insert with check (business_id in (select public.user_business_ids()));
create policy payments_update on public.payments
  for update using (business_id in (select public.user_business_ids()));
create policy payments_delete on public.payments
  for delete using (business_id in (select public.user_business_ids()));

-- expenses
create policy expenses_select on public.expenses
  for select using (business_id in (select public.user_business_ids()));
create policy expenses_insert on public.expenses
  for insert with check (business_id in (select public.user_business_ids()));
create policy expenses_update on public.expenses
  for update using (business_id in (select public.user_business_ids()));
create policy expenses_delete on public.expenses
  for delete using (business_id in (select public.user_business_ids()));

-- audit_log: read-only for members. Writes happen via triggers.
create policy audit_log_select on public.audit_log
  for select using (business_id in (select public.user_business_ids()));
