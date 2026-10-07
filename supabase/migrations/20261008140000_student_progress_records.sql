begin;

-- Coach observations are an append-only history. Readiness is a coach's
-- recommendation for a formal belt assessment, never an automatic promotion.
create table if not exists public.student_progress (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  student_id bigint not null
    constraint student_progress_student_id_fkey
    references public.student(id) on delete restrict,
  branch_id bigint not null
    constraint student_progress_branch_id_fkey
    references public.branch(id) on delete restrict,
  coach_id bigint not null
    constraint student_progress_coach_id_fkey
    references public."user"(id) on delete restrict,
  assessed_on date not null,
  focus_area text not null
    check (focus_area in ('technique', 'forms', 'sparring', 'conditioning', 'discipline')),
  progress_level text not null
    check (progress_level in ('needs_practice', 'developing', 'consistent')),
  assessment_readiness text not null default 'not_assessed'
    check (assessment_readiness in ('not_assessed', 'not_ready', 'ready_for_assessment')),
  observation text not null
    check (btrim(observation) <> '' and char_length(observation) <= 1000),
  next_steps text
    check (next_steps is null or char_length(next_steps) <= 500)
);

create index if not exists student_progress_branch_date_idx
  on public.student_progress (branch_id, assessed_on desc, id desc);
create index if not exists student_progress_student_date_idx
  on public.student_progress (student_id, assessed_on desc, id desc);

alter table public.student_progress enable row level security;
revoke all on table public.student_progress from public, anon, authenticated;
grant all on table public.student_progress to service_role;
grant usage, select on sequence public.student_progress_id_seq to service_role;

commit;
