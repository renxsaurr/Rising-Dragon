-- Monthly coverage follows each student's enrollment anniversary, not calendar months.
-- Existing monthly rows are shifted to that student's anchor day within their existing month.
begin;

alter table public.payment drop constraint if exists payment_details_check;

with aligned as (
  select
    p.id,
    make_date(
      extract(year from p.coverage_start)::integer,
      extract(month from p.coverage_start)::integer,
      least(
        coalesce(extract(day from s.enrollment_date)::integer, extract(day from p.coverage_start)::integer),
        extract(day from (date_trunc('month', p.coverage_start) + interval '1 month' - interval '1 day'))::integer
      )
    ) as due_date
  from public.payment p
  join public.student s on s.id = p.student_id
  where p.payment_type = 'Monthly'
    and p.coverage_start is not null
)
update public.payment p
set coverage_start = aligned.due_date,
    due_date = aligned.due_date
from aligned
where p.id = aligned.id;

alter table public.payment
  add constraint payment_details_check check (
    (payment_type is null and quantity is null and coverage_start is null)
    or (
      payment_type is not null
      and payment_type = 'Monthly'
      and quantity is not null
      and quantity between 1 and 12
      and coverage_start is not null
    )
    or (
      payment_type is not null
      and quantity is not null
      and payment_type = 'Per session'
      and quantity between 1 and 100
      and coverage_start is null
    )
  );

do $$
begin
  if exists (
    select 1
    from public.payment
    where payment_type = 'Monthly'
      and status = 'Unpaid'
      and coverage_start is not null
    group by student_id, coverage_start
    having count(*) > 1
  ) then
    raise exception 'Duplicate unpaid monthly bills exist for the same student and billing date. Review those rows before rerunning this migration.';
  end if;
end;
$$;

-- Makes daily bill generation safe to retry and prevents duplicate monthly obligations.
create unique index if not exists payment_unpaid_monthly_cycle_unique
  on public.payment (student_id, coverage_start)
  where payment_type = 'Monthly' and status = 'Unpaid' and coverage_start is not null;

commit;
