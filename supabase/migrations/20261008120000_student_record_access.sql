begin;

-- Students contain guardian contact information. Browser sessions receive only
-- the roster columns; private profile reads and all writes go through
-- Head Coach checked server code using the service role.
alter table public.student enable row level security;

create or replace function public.can_read_student_row(p_branch_id bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public."user" u
    where u.auth_id = auth.uid()
      and (
        u.role::text = 'head_coach'
        or (
          u.role::text = 'assistant_coach'
          and exists (
            select 1
            from public.class_schedule s
            where s.coach_id = u.id
              and s.branch_id = p_branch_id
              and s.date = (now() at time zone 'Asia/Manila')::date
              and s.status not in ('Cancelled', 'Draft')
          )
        )
      )
  );
$$;

revoke all on function public.can_read_student_row(bigint) from public, anon;
grant execute on function public.can_read_student_row(bigint) to authenticated, service_role;

-- Keep a permissive SELECT policy so row access is governed by the restrictive
-- policy below, even if older permissive policies remain on this table.
drop policy if exists student_authenticated_read on public.student;
create policy student_authenticated_read
  on public.student
  for select
  to authenticated
  using (true);

drop policy if exists student_current_roster_visibility on public.student;
create policy student_current_roster_visibility
  on public.student
  as restrictive
  for select
  to authenticated
  using (public.can_read_student_row(branch_id));

-- Revoke table-wide privileges before granting only the fields needed for
-- roster, attendance, dashboard, promotions, and branch reporting.
revoke all on table public.student from public, anon, authenticated;
grant select (
  id,
  first_name,
  middle_name,
  last_name,
  belt_level,
  branch_id,
  is_active,
  enrollment_date
) on table public.student to authenticated;
grant all on table public.student to service_role;

do $$
declare
  student_id_sequence text;
begin
  student_id_sequence := pg_get_serial_sequence('public.student', 'id');
  if student_id_sequence is not null then
    execute format('grant usage, select on sequence %s to service_role', student_id_sequence);
  end if;
end;
$$;

commit;
