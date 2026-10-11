begin;

-- Assistant coaches need the billing plan to distinguish monthly roster
-- students from per-session students. Guardian contact fields remain private.
grant select (billing_plan) on table public.student to authenticated;

commit;
