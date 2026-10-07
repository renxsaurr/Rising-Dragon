begin;

-- Keep direct assistant roster reads limited to active students scheduled at a
-- branch today. Attendance pages load historic student details server-side
-- only after verifying the assistant owns the selected class session.
drop policy if exists student_current_roster_visibility on public.student;
drop function if exists public.can_read_student_row(bigint);
alter table public.student enable row level security;

create or replace function public.can_read_student_row(
  p_branch_id bigint,
  p_is_active boolean
)
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
          and p_is_active is true
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

revoke all on function public.can_read_student_row(bigint, boolean) from public, anon;
grant execute on function public.can_read_student_row(bigint, boolean) to authenticated, service_role;

drop policy if exists student_authenticated_read on public.student;
create policy student_authenticated_read
  on public.student
  for select
  to authenticated
  using (true);

create policy student_current_roster_visibility
  on public.student
  as restrictive
  for select
  to authenticated
  using (public.can_read_student_row(branch_id, is_active));

-- Direct PostgREST reads follow the same roles as the app: the Head Coach can
-- review all attendance, while an Assistant Coach can review only classes
-- assigned to that coach. All attendance writes stay behind server actions.
alter table public.attendance enable row level security;

create or replace function public.can_read_attendance_schedule(p_schedule_id bigint)
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
            where s.id = p_schedule_id
              and s.coach_id = u.id
          )
        )
      )
  );
$$;

revoke all on function public.can_read_attendance_schedule(bigint) from public, anon;
grant execute on function public.can_read_attendance_schedule(bigint) to authenticated, service_role;

-- The permissive policy supplies SELECT access; the restrictive policy also
-- constrains any older permissive policy that may already exist.
drop policy if exists attendance_authenticated_read on public.attendance;
create policy attendance_authenticated_read
  on public.attendance
  for select
  to authenticated
  using (true);

drop policy if exists attendance_assigned_schedule_visibility on public.attendance;
create policy attendance_assigned_schedule_visibility
  on public.attendance
  as restrictive
  for select
  to authenticated
  using (public.can_read_attendance_schedule(schedule_id));

-- Authenticated clients may read attendance rows allowed by RLS, but cannot
-- write directly. Server actions validate roles and roster membership, then
-- write with the service role.
revoke all on table public.attendance from public, anon, authenticated;
grant select (student_id, schedule_id, date, status)
  on table public.attendance to authenticated;
grant all on table public.attendance to service_role;

do $$
declare
  attendance_id_sequence text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance'
      and column_name = 'id'
  ) then
    attendance_id_sequence := pg_get_serial_sequence('public.attendance', 'id');
  end if;
  if attendance_id_sequence is not null then
    execute format('grant usage, select on sequence %s to service_role', attendance_id_sequence);
  end if;
end;
$$;

commit;
