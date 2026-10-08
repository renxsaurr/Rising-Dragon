-- Distinguish monthly students from pay-per-session students, and create a
-- payment obligation only when a per-session student actually checks in.
begin;

alter table public.student
  add column if not exists billing_plan text not null default 'Monthly';

alter table public.student
  drop constraint if exists student_billing_plan_check,
  add constraint student_billing_plan_check
    check (billing_plan in ('Monthly', 'Per session'));

alter table public.payment
  add column if not exists attendance_schedule_id bigint;

alter table public.payment
  drop constraint if exists payment_attendance_session_fkey,
  add constraint payment_attendance_session_fkey
    foreign key (student_id, attendance_schedule_id)
    references public.attendance (student_id, schedule_id);

create unique index if not exists payment_per_session_attendance_unique
  on public.payment (student_id, attendance_schedule_id)
  where payment_type = 'Per session' and attendance_schedule_id is not null;

alter table public.payment_settings
  add column if not exists per_session_fee numeric(10, 2) not null default 150;

alter table public.payment_settings
  drop constraint if exists payment_settings_per_session_fee_check,
  add constraint payment_settings_per_session_fee_check
    check (per_session_fee > 0);

insert into public.payment_settings (singleton, per_session_fee)
values (true, 150)
on conflict (singleton) do nothing;

create or replace function public.set_academy_per_session_fee(
  p_per_session_fee numeric,
  p_updated_by bigint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer;
begin
  if p_per_session_fee is null
    or p_per_session_fee <= 0
    or p_per_session_fee > 1000000
    or p_per_session_fee <> round(p_per_session_fee, 2)
  then
    raise exception 'Per-session fee must be a positive amount with no more than two decimal places.';
  end if;

  insert into public.payment_settings (singleton, per_session_fee, updated_at, updated_by)
  values (true, p_per_session_fee, now(), p_updated_by)
  on conflict (singleton) do update
    set per_session_fee = excluded.per_session_fee,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  update public.payment
  set amount = round(p_per_session_fee * quantity, 2)
  where status = 'Unpaid'
    and payment_type = 'Per session'
    and attendance_schedule_id is not null
    and quantity between 1 and 100;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke all on function public.set_academy_per_session_fee(numeric, bigint)
  from public, anon, authenticated;
grant execute on function public.set_academy_per_session_fee(numeric, bigint)
  to service_role;

create or replace function public.record_per_session_checkin(
  p_schedule_id bigint,
  p_student_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_branch_id bigint;
  v_status text;
  v_student_branch bigint;
  v_enrollment_date date;
  v_billing_plan text;
  v_fee numeric(10, 2);
begin
  select date, branch_id, status
    into v_date, v_branch_id, v_status
    from public.class_schedule
    where id = p_schedule_id
    for update;
  if not found then raise exception 'Class session not found.'; end if;
  if v_status in ('Cancelled', 'Draft') then raise exception 'This class is not open for attendance.'; end if;

  select branch_id, enrollment_date, billing_plan
    into v_student_branch, v_enrollment_date, v_billing_plan
    from public.student
    where id = p_student_id and is_active = true;
  if not found then raise exception 'Active student not found.'; end if;
  if v_billing_plan <> 'Per session' then raise exception 'Only per-session students can be checked in as walk-ins.'; end if;
  if v_student_branch <> v_branch_id then raise exception 'This student is not enrolled at this branch.'; end if;
  if v_enrollment_date > v_date then raise exception 'The student was not enrolled on this class date.'; end if;

  insert into public.attendance (student_id, schedule_id, date, status)
  values (p_student_id, p_schedule_id, v_date, 'Present')
  on conflict (student_id, schedule_id) do nothing;
  if not found then raise exception 'This student already has an attendance record for this class.'; end if;

  select per_session_fee into v_fee
    from public.payment_settings where singleton = true;
  if v_fee is null or v_fee <= 0 then raise exception 'Set the academy per-session fee in Settings first.'; end if;

  insert into public.payment (
    student_id, amount, status, due_date, paid_date, method,
    payment_type, quantity, coverage_start, notes, attendance_schedule_id
  ) values (
    p_student_id, v_fee, 'Unpaid', v_date, null, null,
    'Per session', 1, null, 'Class attendance charge', p_schedule_id
  );

  return p_schedule_id;
end;
$$;

revoke all on function public.record_per_session_checkin(bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.record_per_session_checkin(bigint, bigint)
  to service_role;

commit;
