-- Applied directly to the BoatsandNotes Supabase project (xohodqluvqoonqrlamdz)
-- on September 27, 2026, to resolve two performance-advisor warnings.
-- Recorded here for history; does not change existing customer/boat/work-order data.

-- 1. Covering indexes for foreign keys flagged by the performance advisor
create index if not exists idx_boats_customer_id on public.boats (customer_id);
create index if not exists idx_service_records_boat_id on public.service_records (boat_id);
create index if not exists idx_parts_service_record_id on public.parts (service_record_id);
create index if not exists idx_work_order_jobs_service_record_id on public.work_order_jobs (service_record_id);
create index if not exists idx_customer_comm_log_customer_id on public.customer_comm_log (customer_id);
create index if not exists idx_service_photos_customer_id on public.service_photos (customer_id);
create index if not exists idx_service_photos_service_record_id on public.service_photos (service_record_id);
create index if not exists idx_scheduled_events_boat_id on public.scheduled_events (boat_id);
create index if not exists idx_scheduled_events_service_record_id on public.scheduled_events (service_record_id);

-- 2. Rewrite owner_only policies on public tables so auth.uid() is evaluated
--    once per query (via initplan) instead of once per row.
do $$
declare
  t text;
  owner_tables text[] := array[
    'activity_log','bbc_services','boats','catalog_tabs','common_jobs',
    'customer_comm_log','customers','labor_codes','parts','parts_catalog',
    'quote_requests','scheduled_events','service_photos','service_records',
    'status_history','work_order_jobs','work_order_templates'
  ];
begin
  foreach t in array owner_tables loop
    execute format('drop policy if exists owner_only on public.%I', t);
    execute format(
      'create policy owner_only on public.%I for all using ((select auth.uid()) = %L::uuid) with check ((select auth.uid()) = %L::uuid)',
      t, '77228746-e36f-4d72-84fd-d9c74aa532dc', '77228746-e36f-4d72-84fd-d9c74aa532dc'
    );
  end loop;
end $$;

-- 3. Same fix for bn_private tables' own_records policies
do $$
declare
  t text;
  priv_tables text[] := array['preferences','recovery_drafts','save_receipts'];
begin
  foreach t in array priv_tables loop
    execute format('drop policy if exists own_records on bn_private.%I', t);
    execute format(
      'create policy own_records on bn_private.%I for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
