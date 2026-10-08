-- One academy-wide monthly fee, maintained by the Head Coach through the app.
-- Changing it updates only unpaid monthly bills; paid rows remain historical records.
begin;

create table if not exists public.payment_settings (
  singleton boolean primary key default true check (singleton),
  monthly_fee numeric(10, 2),
  reminder_before_due_days integer not null default 3
    check (reminder_before_due_days between 1 and 30),
  reminder_after_due_days integer not null default 3
    check (reminder_after_due_days between 1 and 30),
  updated_at timestamptz not null default now(),
  updated_by bigint references public."user"(id) on delete set null,
  constraint payment_settings_monthly_fee_check
    check (monthly_fee is null or monthly_fee > 0)
);

alter table public.payment_settings
  add column if not exists reminder_before_due_days integer not null default 3,
  add column if not exists reminder_after_due_days integer not null default 3;

alter table public.payment_settings
  drop constraint if exists payment_settings_reminder_before_due_days_check,
  drop constraint if exists payment_settings_reminder_after_due_days_check,
  add constraint payment_settings_reminder_before_due_days_check
    check (reminder_before_due_days between 1 and 30),
  add constraint payment_settings_reminder_after_due_days_check
    check (reminder_after_due_days between 1 and 30);

insert into public.payment_settings (singleton, monthly_fee)
values (true, null)
on conflict (singleton) do nothing;

alter table public.payment_settings enable row level security;
revoke all on table public.payment_settings from anon, authenticated;
grant all on table public.payment_settings to service_role;

create or replace function public.set_academy_monthly_fee(
  p_monthly_fee numeric,
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
  if p_monthly_fee is null
    or p_monthly_fee <= 0
    or p_monthly_fee > 1000000
    or p_monthly_fee <> round(p_monthly_fee, 2)
  then
    raise exception 'Monthly fee must be a positive amount with no more than two decimal places.';
  end if;

  insert into public.payment_settings (singleton, monthly_fee, updated_at, updated_by)
  values (true, p_monthly_fee, now(), p_updated_by)
  on conflict (singleton) do update
    set monthly_fee = excluded.monthly_fee,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  update public.payment
  set amount = round(p_monthly_fee * quantity, 2)
  where status = 'Unpaid'
    and payment_type = 'Monthly'
    and quantity between 1 and 12;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke all on function public.set_academy_monthly_fee(numeric, bigint)
  from public, anon, authenticated;
grant execute on function public.set_academy_monthly_fee(numeric, bigint)
  to service_role;

commit;
