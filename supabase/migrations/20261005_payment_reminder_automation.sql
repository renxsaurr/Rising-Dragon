-- Payment reminders: automatic emails 3 days before, on, and 3 days after the due date.
-- payment_reminder had 0 rows and no code used it, so these changes are safe.
begin;

-- NULL sent_by = sent by the daily job. A user id = the Head Coach pressed Retry.
alter table public.payment_reminder alter column sent_by drop not null;

alter table public.payment_reminder
  add column if not exists reminder_type text,
  add column if not exists scheduled_for date,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz not null default now();

alter table public.payment_reminder alter column reminder_type set not null;
alter table public.payment_reminder alter column scheduled_for set not null;

-- Replace the old status rules (pending/sent/failed) with the new ones.
-- payment_reminder_recipient_email_check is kept as it is.
alter table public.payment_reminder
  drop constraint if exists payment_reminder_status_check,
  drop constraint if exists payment_reminder_timestamps_check;

alter table public.payment_reminder alter column status set default 'Scheduled';

alter table public.payment_reminder
  add constraint payment_reminder_status_check
    check (status in ('Scheduled', 'Sent', 'Failed', 'Skipped')),
  add constraint payment_reminder_type_check
    check (reminder_type in ('Before due', 'Due today', 'After due')),
  -- Same idea as the old rule: completed_at = when the attempt finished.
  add constraint payment_reminder_timestamps_check check (
    (status = 'Scheduled' and completed_at is null and sent_at is null)
    or (status = 'Sent' and completed_at is not null and sent_at is not null)
    or (status in ('Failed', 'Skipped') and completed_at is not null and sent_at is null)
  );

-- One reminder of each type per payment, so no double emails.
alter table public.payment_reminder
  add constraint payment_reminder_payment_type_unique unique (payment_id, reminder_type);

create index if not exists payment_reminder_created_at_idx
  on public.payment_reminder (created_at desc);

create index if not exists payment_unpaid_due_date_idx
  on public.payment (due_date) where status = 'Unpaid';

commit;