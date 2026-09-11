create extension if not exists pgcrypto;

alter table public.quizzes
  add column if not exists difficulty text not null default 'medium',
  add column if not exists mode text not null default 'practice',
  add column if not exists source_note_id uuid,
  add column if not exists exam_type text,
  add column if not exists exam_year integer,
  add column if not exists duration_minutes integer,
  add column if not exists started_at timestamptz not null default now();

alter table public.quiz_questions
  add column if not exists topic text,
  add column if not exists difficulty text not null default 'medium';

alter table public.quiz_attempts
  add column if not exists mode text not null default 'practice',
  add column if not exists duration_seconds integer;

alter table public.flashcards
  add column if not exists next_review_at timestamptz not null default now(),
  add column if not exists interval_days integer not null default 0,
  add column if not exists review_count integer not null default 0;

alter table public.quizzes drop constraint if exists quizzes_difficulty_check;
alter table public.quizzes
  add constraint quizzes_difficulty_check check (difficulty in ('easy', 'medium', 'hard'));

alter table public.quizzes drop constraint if exists quizzes_mode_check;
alter table public.quizzes
  add constraint quizzes_mode_check check (mode in ('practice', 'adaptive', 'exam', 'notes', 'question_bank'));

alter table public.quiz_questions drop constraint if exists quiz_questions_difficulty_check;
alter table public.quiz_questions
  add constraint quiz_questions_difficulty_check check (difficulty in ('easy', 'medium', 'hard'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quizzes_source_note_id_fkey'
  ) then
    alter table public.quizzes
      add constraint quizzes_source_note_id_fkey
      foreign key (source_note_id) references public.study_notes(id) on delete set null;
  end if;
end $$;

create table if not exists public.mistake_notebook (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete set null,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  subject text not null,
  topic text not null,
  question text not null,
  options jsonb not null,
  selected_option integer,
  correct_option integer not null,
  explanation text not null,
  times_missed integer not null default 1,
  resolved boolean not null default false,
  last_missed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create table if not exists public.topic_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null,
  correct_count integer not null default 0,
  attempt_count integer not null default 0,
  mastery_score integer not null default 0 check (mastery_score between 0 and 100),
  last_practiced_at timestamptz not null default now(),
  unique (user_id, subject, topic)
);

create table if not exists public.teach_back_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null,
  explanation text not null,
  score integer not null check (score between 0 and 100),
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  feedback text not null,
  next_question text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null,
  exam_type text not null default 'Practice',
  exam_year integer,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  question text not null,
  options jsonb not null,
  correct_option integer not null check (correct_option between 0 and 3),
  explanation text not null,
  marking_points jsonb not null default '[]'::jsonb,
  source_type text not null default 'ai_original' check (source_type in ('ai_original', 'user_authorized')),
  source_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.written_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  topic text not null,
  question text not null,
  student_answer text not null,
  marking_points jsonb not null,
  max_marks integer not null check (max_marks between 1 and 100),
  awarded_marks integer not null check (awarded_marks between 0 and 100),
  met_points jsonb not null default '[]'::jsonb,
  missed_points jsonb not null default '[]'::jsonb,
  feedback text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null default 'General',
  title text not null,
  target_type text not null check (target_type in ('study_minutes', 'quiz_score', 'tasks_completed', 'sessions_completed')),
  target_value integer not null check (target_value between 1 and 10000),
  current_value integer not null default 0,
  period_start timestamptz not null default now(),
  period_end timestamptz not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mistake_notebook_user_resolved_idx
  on public.mistake_notebook(user_id, resolved, last_missed_at desc);
create index if not exists topic_mastery_user_score_idx
  on public.topic_mastery(user_id, mastery_score, last_practiced_at desc);
create index if not exists flashcards_due_idx
  on public.flashcards(next_review_at, set_id);
create index if not exists question_bank_user_filter_idx
  on public.question_bank(user_id, subject, topic, exam_type, difficulty);
create index if not exists teach_back_user_created_idx
  on public.teach_back_attempts(user_id, created_at desc);
create index if not exists written_assessments_user_created_idx
  on public.written_assessments(user_id, created_at desc);
create index if not exists study_goals_user_period_idx
  on public.study_goals(user_id, period_end, completed);

alter table public.mistake_notebook enable row level security;
alter table public.topic_mastery enable row level security;
alter table public.teach_back_attempts enable row level security;
alter table public.question_bank enable row level security;
alter table public.written_assessments enable row level security;
alter table public.study_goals enable row level security;

drop policy if exists "Users manage own mistakes" on public.mistake_notebook;
create policy "Users manage own mistakes" on public.mistake_notebook
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own mastery" on public.topic_mastery;
create policy "Users manage own mastery" on public.topic_mastery
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own teach back attempts" on public.teach_back_attempts;
create policy "Users manage own teach back attempts" on public.teach_back_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own question bank" on public.question_bank;
create policy "Users manage own question bank" on public.question_bank
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own written assessments" on public.written_assessments;
create policy "Users manage own written assessments" on public.written_assessments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own study goals" on public.study_goals;
create policy "Users manage own study goals" on public.study_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
