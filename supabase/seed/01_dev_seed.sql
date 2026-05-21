-- =====================================================================
-- Dev seed: run after creating an auth.users row in the Supabase dashboard
-- (Authentication → Users → Add user).
-- Replace SEED_USER_EMAIL below with the email you registered.
-- =====================================================================

do $$
declare
  v_user_id uuid;
  v_business_id uuid;
begin
  select id into v_user_id from auth.users where email = 'SEED_USER_EMAIL@example.com';
  if v_user_id is null then
    raise notice 'No user found for SEED_USER_EMAIL; skipping seed.';
    return;
  end if;

  insert into public.businesses (name, legal_name, tax_id, email, country)
       values ('My Business', 'My Business SRL', '000-00000-0', 'hello@mybusiness.com', 'DO')
    returning id into v_business_id;

  insert into public.business_members (business_id, user_id, role)
       values (v_business_id, v_user_id, 'owner');
end $$;
