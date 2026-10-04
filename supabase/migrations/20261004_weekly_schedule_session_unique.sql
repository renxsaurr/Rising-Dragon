-- Keep page loads and the daily job from creating the same recurring session twice.
-- Resolve any existing duplicates before applying this migration.
alter table public.class_schedule
  add column if not exists auto_cancelled boolean not null default false;

do $$
begin
  if exists (
    select 1
    from public.class_schedule
    where weekly_template_id is not null
    group by weekly_template_id, date
    having count(*) > 1
  ) then
    raise exception 'Duplicate recurring class sessions exist. Review class_schedule rows grouped by weekly_template_id and date, then rerun this migration.';
  end if;
end $$;

create unique index if not exists class_schedule_weekly_template_date_unique
  on public.class_schedule (weekly_template_id, date)
  where weekly_template_id is not null;
