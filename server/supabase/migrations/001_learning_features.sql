create extension if not exists pgcrypto;

alter table public.tasks
  add column if not exists completed_at timestamptz;

create table if not exists public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  subject text not null default 'General',
  original_filename text not null,
  mime_type text not null,
  text_content text not null,
  char_count integer not null check (char_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_note_id uuid references public.study_notes(id) on delete set null,
  subject text not null default 'General',
  topic text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.flashcard_sets(id) on delete cascade,
  front text not null,
  back text not null,
  hint text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.flashcards(id) on delete cascade,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  subject text not null default 'General',
  topic text not null,
  planned_minutes integer not null default 25 check (planned_minutes between 1 and 240),
  actual_minutes integer check (actual_minutes between 1 and 240),
  plan jsonb,
  completed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now()
);

create index if not exists study_notes_user_created_idx
  on public.study_notes(user_id, created_at desc);
create index if not exists flashcard_sets_user_created_idx
  on public.flashcard_sets(user_id, created_at desc);
create index if not exists flashcards_set_position_idx
  on public.flashcards(set_id, position);
create index if not exists flashcard_reviews_user_created_idx
  on public.flashcard_reviews(user_id, created_at desc);
create index if not exists study_sessions_user_started_idx
  on public.study_sessions(user_id, started_at desc);
create index if not exists ai_usage_user_created_idx
  on public.ai_usage(user_id, created_at desc);

alter table public.study_notes enable row level security;
alter table public.flashcard_sets enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.study_sessions enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "Users manage own notes" on public.study_notes;
create policy "Users manage own notes" on public.study_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own flashcard sets" on public.flashcard_sets;
create policy "Users manage own flashcard sets" on public.flashcard_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users view own flashcards" on public.flashcards;
create policy "Users view own flashcards" on public.flashcards
  for select using (
    exists (
      select 1 from public.flashcard_sets
      where flashcard_sets.id = flashcards.set_id
        and flashcard_sets.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own flashcard reviews" on public.flashcard_reviews;
create policy "Users manage own flashcard reviews" on public.flashcard_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own study sessions" on public.study_sessions;
create policy "Users manage own study sessions" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users view own AI usage" on public.ai_usage;
create policy "Users view own AI usage" on public.ai_usage
  for select using (auth.uid() = user_id);
