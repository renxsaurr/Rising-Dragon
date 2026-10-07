-- Payment record details: what a payment is for (monthly fee or per-session fee),
-- how many months or sessions it covers, and an optional note.
-- Every new column is nullable, so existing payment rows keep working unchanged.
begin;

alter table public.payment
  -- 'Monthly' or 'Per session'. NULL = an older payment recorded before these details existed.
  add column if not exists payment_type text,
  -- How many months (Monthly) or how many sessions (Per session) this payment covers.
  add column if not exists quantity integer,
  -- Monthly only: the 1st day of the first month covered, e.g. 2026-10-01.
  add column if not exists coverage_start date,
  -- Optional free-text note from the Head Coach, up to 500 characters.
  add column if not exists notes text;

-- Drop first so this file can be run again without errors.
alter table public.payment
  drop constraint if exists payment_type_check,
  drop constraint if exists payment_details_check,
  drop constraint if exists payment_notes_length_check;

alter table public.payment
  add constraint payment_type_check
    check (payment_type is null or payment_type in ('Monthly', 'Per session')),
  -- All or nothing: either no details at all (older records),
  -- or a complete Monthly record, or a complete Per session record.
  -- "is not null" is spelled out because a CHECK that evaluates to NULL counts as passing.
  add constraint payment_details_check check (
    (payment_type is null and quantity is null and coverage_start is null)
    or (
      payment_type is not null
      and payment_type = 'Monthly'
      and quantity is not null
      and quantity between 1 and 12
      and coverage_start is not null
      and extract(day from coverage_start) = 1
    )
    or (
      payment_type is not null
      and payment_type = 'Per session'
      and quantity is not null
      and quantity between 1 and 100
      and coverage_start is null
    )
  ),
  add constraint payment_notes_length_check
    check (notes is null or char_length(notes) <= 500);

commit;
