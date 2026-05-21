-- =====================================================================
-- Storage buckets + policies for logos and expense receipts.
-- File paths are namespaced by business_id:
--   logos/{business_id}/{uuid}.{ext}
--   expense-receipts/{business_id}/{uuid}.{ext}
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', true, 1048576,
   array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('expense-receipts', 'expense-receipts', false, 10485760,
   array['image/png','image/jpeg','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

-- Logos: members of the business may upload/update/delete their logo.
-- Everyone with the link can read (public bucket).
create policy "logos: members can insert"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and (split_part(name, '/', 1))::uuid in (select public.user_business_ids())
  );

create policy "logos: members can update"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and (split_part(name, '/', 1))::uuid in (select public.user_business_ids())
  );

create policy "logos: members can delete"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and (split_part(name, '/', 1))::uuid in (select public.user_business_ids())
  );

-- Expense receipts: members of the business have full CRUD.
create policy "receipts: members can read"
  on storage.objects for select
  using (
    bucket_id = 'expense-receipts'
    and (split_part(name, '/', 1))::uuid in (select public.user_business_ids())
  );

create policy "receipts: members can insert"
  on storage.objects for insert
  with check (
    bucket_id = 'expense-receipts'
    and (split_part(name, '/', 1))::uuid in (select public.user_business_ids())
  );

create policy "receipts: members can update"
  on storage.objects for update
  using (
    bucket_id = 'expense-receipts'
    and (split_part(name, '/', 1))::uuid in (select public.user_business_ids())
  );

create policy "receipts: members can delete"
  on storage.objects for delete
  using (
    bucket_id = 'expense-receipts'
    and (split_part(name, '/', 1))::uuid in (select public.user_business_ids())
  );
