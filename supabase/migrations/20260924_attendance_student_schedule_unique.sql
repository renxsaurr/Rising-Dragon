-- A student can have only one attendance result per class session.
-- This also enables safe upserts from the Attendance module.
create unique index if not exists attendance_student_schedule_unique
  on public.attendance (student_id, schedule_id);
