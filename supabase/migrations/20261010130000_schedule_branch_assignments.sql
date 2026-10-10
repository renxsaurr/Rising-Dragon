begin;

alter table public.class_schedule
  add column if not exists is_cross_branch_override boolean not null default false;

commit;
