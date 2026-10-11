-- Rising Dragon schema cleanup
-- Reviewed against the application code and tracked Supabase migrations.
-- This removes legacy tables/metadata that the current system does not use.
-- Back up/export any rows in the two legacy tables before running this script.
-- No CASCADE is used: unexpected dependencies will stop the transaction safely.

begin;

drop table if exists public.coach_availability;
drop table if exists public.branch_weekly_coverage;

-- This enum was used only by the retired date-specific coach_availability table.
drop type if exists public.availability_status;

-- No application code or tracked migration reads or writes this provider field.
alter table if exists public.payment_reminder
  drop column if exists provider_message_id;

commit;
