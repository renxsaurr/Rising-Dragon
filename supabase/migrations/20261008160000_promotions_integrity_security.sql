begin;

-- Promotion history is accessed only by the authenticated Head Coach page on
-- the server and is written through this service-role-only function.
alter table public.promotion enable row level security;
revoke all on table public.promotion from public, anon, authenticated;
grant all on table public.promotion to service_role;

do $$
declare
  promotion_id_sequence text;
begin
  promotion_id_sequence := pg_get_serial_sequence('public.promotion', 'id');
  if promotion_id_sequence is not null then
    execute format('grant usage, select on sequence %s to service_role', promotion_id_sequence);
  end if;
end;
$$;

-- Update the current belt and append its history as one transaction. The row
-- lock and sequence check prevent duplicate or skipped promotions on races.
create or replace function public.record_student_promotion(
  p_student_id bigint,
  p_new_belt text,
  p_promotion_date date,
  p_coach_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old_belt text;
  v_promotion_id bigint;
  v_old_index integer;
  v_new_index integer;
  v_valid_belts constant text[] := array[
    'practitioner',
    'white_belt',
    'low_yellow',
    'high_yellow',
    'low_blue',
    'high_blue',
    'low_red',
    'high_red',
    'low_brown',
    'high_brown',
    'first_dan_black_belt',
    'second_dan_black_belt',
    'third_dan_black_belt',
    'fourth_dan_black_belt'
  ];
begin
  if p_student_id is null or p_coach_id is null or p_promotion_date is null then
    raise exception 'Student, coach, and promotion date are required.';
  end if;

  if p_new_belt is null or not (p_new_belt = any(v_valid_belts)) then
    raise exception 'The selected belt is not valid.';
  end if;

  if p_promotion_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'Promotion date cannot be in the future.';
  end if;

  if not exists (
    select 1
    from public."user" u
    where u.id = p_coach_id
      and u.role::text = 'head_coach'
  ) then
    raise exception 'Only a Head Coach can record an official promotion.';
  end if;

  select s.belt_level
    into v_old_belt
  from public.student s
  where s.id = p_student_id
    and s.is_active = true
  for update;

  if not found then
    raise exception 'Active student not found.';
  end if;

  v_old_index := array_position(v_valid_belts, v_old_belt);
  v_new_index := array_position(v_valid_belts, p_new_belt);
  if v_old_index is null or v_new_index is distinct from v_old_index + 1 then
    raise exception 'The new belt must be the next belt after the current one.';
  end if;

  insert into public.promotion (
    old_belt,
    new_belt,
    date,
    student_id,
    coach_id
  )
  values (
    v_old_belt,
    p_new_belt,
    p_promotion_date,
    p_student_id,
    p_coach_id
  )
  returning id into v_promotion_id;

  update public.student
  set belt_level = p_new_belt
  where id = p_student_id;

  return v_promotion_id;
end;
$$;

revoke all on function public.record_student_promotion(bigint, text, date, bigint)
  from public, anon, authenticated;
grant execute on function public.record_student_promotion(bigint, text, date, bigint)
  to service_role;

commit;
