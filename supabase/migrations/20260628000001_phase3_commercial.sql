-- =====================================================================
-- Phase 3 — Commercial 1 ("Solicitar acceso", clientes 1-50)
--
-- Adds subscription state to businesses, a platform-level staff role,
-- public lead capture, and a billing audit log.
-- No payment gateway integration in this phase — payments are recorded
-- manually by staff via the admin console.
-- =====================================================================

-- ---------------------------------------------------------------------
-- businesses: subscription state
-- ---------------------------------------------------------------------
alter table public.businesses
  add column subscription_status text not null default 'trial'
    check (subscription_status in ('trial','active','past_due','suspended','cancelled')),
  add column trial_ends_at          timestamptz,
  add column current_period_ends_at timestamptz,
  add column monthly_price_dop      numeric(14,2),
  add column past_due_since         timestamptz,  -- when subscription_status flipped to past_due
  add column cancelled_at           timestamptz;

create index businesses_subscription_status_idx
  on public.businesses(subscription_status);
create index businesses_trial_ends_at_idx
  on public.businesses(trial_ends_at)
  where subscription_status = 'trial';
create index businesses_current_period_ends_at_idx
  on public.businesses(current_period_ends_at)
  where subscription_status = 'active';

-- ---------------------------------------------------------------------
-- staff_users: platform-level role (distinct from business_members.role)
-- ---------------------------------------------------------------------
create table public.staff_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'admin'
             check (role in ('admin','support')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- leads: public access requests
-- ---------------------------------------------------------------------
create table public.leads (
  id                    uuid primary key default gen_random_uuid(),
  business_name         text not null,
  contact_name          text not null,
  email                 text not null,
  phone                 text,
  rnc                   text,
  employees_band        text,
  current_tool          text,
  interest_note         text,
  status                text not null default 'pending'
                        check (status in ('pending','qualifying','approved','declined','converted','spam')),
  reviewed_by           uuid references auth.users(id),
  reviewed_at           timestamptz,
  review_notes          text,
  converted_business_id uuid references public.businesses(id),
  turnstile_ok          boolean not null default false,
  source_ip             inet,
  user_agent            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index leads_status_idx       on public.leads(status, created_at desc);
create index leads_email_idx        on public.leads(email);

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- billing_events: audit + reconciliation
-- ---------------------------------------------------------------------
create table public.billing_events (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete restrict,
  kind                text not null check (kind in (
                        'trial_started','trial_extended',
                        'manual_payment_recorded',
                        'subscription_activated','subscription_past_due',
                        'subscription_suspended','subscription_reactivated','subscription_cancelled'
                      )),
  amount_dop          numeric(14,2),
  period_extended_to  timestamptz,
  notes               text,
  actor_user_id       uuid references auth.users(id),
  occurred_at         timestamptz not null default now()
);
create index billing_events_business_idx
  on public.billing_events(business_id, occurred_at desc);

-- ---------------------------------------------------------------------
-- RLS for new tables (defense in depth — api uses service role anyway)
-- ---------------------------------------------------------------------
alter table public.staff_users    enable row level security;
alter table public.leads          enable row level security;
alter table public.billing_events enable row level security;

-- staff_users: only readable by service role (no policies = no row access via anon/authenticated)
-- leads: same (api reads via service role)
-- billing_events: same

-- ---------------------------------------------------------------------
-- Backfill: founder business and staff_users entry
-- ---------------------------------------------------------------------
-- Mark existing businesses as 'active' indefinitely (founder + any existing
-- test businesses won't be subject to trial enforcement).
update public.businesses
   set subscription_status     = 'active',
       current_period_ends_at  = now() + interval '50 years';

-- Insert the founder as platform staff (idempotent — picks the auth user
-- by email; safe to run multiple times because of primary key on user_id).
insert into public.staff_users (user_id, role)
select id, 'admin'
  from auth.users
 where email = 'ernesto.m0799@gmail.com'
on conflict (user_id) do nothing;
