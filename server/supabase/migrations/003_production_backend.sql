create extension if not exists pgcrypto;

create index if not exists conversations_user_updated_idx on public.conversations(user_id, updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at asc);
create index if not exists tasks_user_completed_due_idx on public.tasks(user_id, completed, due_date asc);
create index if not exists quizzes_user_started_idx on public.quizzes(user_id, started_at desc);
create index if not exists quiz_attempts_user_created_idx on public.quiz_attempts(user_id, created_at desc);
create index if not exists quiz_questions_quiz_created_idx on public.quiz_questions(quiz_id, created_at asc);
create index if not exists ai_usage_feature_created_idx on public.ai_usage(feature, created_at desc);

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null check (job_type in ('weekly_report')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  attempts integer not null default 0 check (attempts >= 0),
  worker_id text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists background_jobs_queue_idx
  on public.background_jobs(status, run_after, created_at) where status = 'queued';
create index if not exists background_jobs_user_created_idx
  on public.background_jobs(user_id, created_at desc);

alter table public.background_jobs enable row level security;
drop policy if exists "Users create own report jobs" on public.background_jobs;
create policy "Users create own report jobs" on public.background_jobs
  for insert with check (auth.uid() = user_id and job_type = 'weekly_report');
drop policy if exists "Users view own report jobs" on public.background_jobs;
create policy "Users view own report jobs" on public.background_jobs
  for select using (auth.uid() = user_id);

create or replace function public.claim_background_job(worker_id_input text)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.background_jobs;
begin
  select * into claimed from public.background_jobs
  where (status = 'queued' and run_after <= now())
     or (status = 'processing' and attempts < 3 and started_at < now() - interval '15 minutes')
  order by created_at asc for update skip locked limit 1;
  if claimed.id is null then return; end if;
  update public.background_jobs
  set status = 'processing', attempts = attempts + 1,
      worker_id = worker_id_input, started_at = now(), finished_at = null
  where id = claimed.id returning * into claimed;
  return next claimed;
end;
$$;

revoke all on function public.claim_background_job(text) from public;
revoke all on function public.claim_background_job(text) from anon;
revoke all on function public.claim_background_job(text) from authenticated;
grant execute on function public.claim_background_job(text) to service_role;
