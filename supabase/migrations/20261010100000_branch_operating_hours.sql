begin;

alter table public.branch
  add column if not exists operating_hours jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'branch_operating_hours_array_check'
      and conrelid = 'public.branch'::regclass
  ) then
    alter table public.branch
      add constraint branch_operating_hours_array_check
      check (operating_hours is null or jsonb_typeof(operating_hours) = 'array');
  end if;
end;
$$;

commit;
