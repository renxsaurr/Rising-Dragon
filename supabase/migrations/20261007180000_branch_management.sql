begin;

-- Keep closed locations for reports and foreign-key history instead of deleting them.
alter table public.branch
  add column if not exists is_active boolean not null default true;

-- Prevent two active locations from differing only by case or extra spaces.
do $$
begin
  if exists (
    select 1
    from public.branch
    where is_active
    group by lower(btrim(name))
    having count(*) > 1
  ) then
    raise exception 'Duplicate active branch names exist after trimming and lowercasing. Correct them before running this migration.';
  end if;
end;
$$;

create unique index if not exists branch_active_normalized_name_uidx
  on public.branch (lower(btrim(name)))
  where is_active;

-- Branch names are readable to signed-in staff, but all writes go through
-- Head Coach checked server actions using the service role.
alter table public.branch enable row level security;
drop policy if exists branch_authenticated_read on public.branch;
create policy branch_authenticated_read
  on public.branch
  for select
  to authenticated
  using (true);

revoke all on table public.branch from anon, authenticated;
revoke all on table public.branch from public;
grant select on table public.branch to authenticated;
grant all on table public.branch to service_role;

do $$
declare
  branch_id_sequence text;
begin
  branch_id_sequence := pg_get_serial_sequence('public.branch', 'id');
  if branch_id_sequence is not null then
    execute format('grant usage, select on sequence %s to service_role', branch_id_sequence);
  end if;
end;
$$;

-- The app uploads branch images through a Head Coach checked server endpoint.
-- Restrictive policies override any older permissive browser-write policies,
-- but leave public reads and service-role uploads unaffected.
drop policy if exists branch_photos_server_only_insert on storage.objects;
create policy branch_photos_server_only_insert
  on storage.objects
  as restrictive
  for insert
  to anon, authenticated
  with check (bucket_id <> 'branch-photos');

drop policy if exists branch_photos_server_only_update on storage.objects;
create policy branch_photos_server_only_update
  on storage.objects
  as restrictive
  for update
  to anon, authenticated
  using (bucket_id <> 'branch-photos')
  with check (bucket_id <> 'branch-photos');

drop policy if exists branch_photos_server_only_delete on storage.objects;
create policy branch_photos_server_only_delete
  on storage.objects
  as restrictive
  for delete
  to anon, authenticated
  using (bucket_id <> 'branch-photos');

commit;
