begin;

alter table public.schedule_absence_report
  drop constraint if exists schedule_absence_report_resolution_check;

alter table public.schedule_absence_report
  add constraint schedule_absence_report_resolution_check
  check (resolution is null or resolution in ('covered', 'cancelled', 'partially_cancelled', 'no_sessions'));

commit;
