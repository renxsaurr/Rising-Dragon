-- Standardize payment-method categories to the values used by the business.
-- GCash and bank transfer are preserved under the broader Online category.
begin;

do $$
declare
  method_check record;
begin
  -- The original table definition is maintained in Supabase, not this repository.
  -- Drop only checks that reference the payment method column so the new categories
  -- can be installed even if the original schema constrained its older labels.
  for method_check in
    select conname
    from pg_constraint
    where conrelid = 'public.payment'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%method%'
  loop
    execute format('alter table public.payment drop constraint %I', method_check.conname);
  end loop;
end;
$$;

update public.payment
set method = case lower(btrim(method))
  when 'cash' then 'Cash'
  when 'online' then 'Online'
  when 'gcash' then 'Online'
  when 'bank transfer' then 'Online'
  when 'card' then 'Card'
  else method
end
where method is not null;

alter table public.payment
  add constraint payment_method_check
  check (method is null or method in ('Cash', 'Online', 'Card'));

commit;
