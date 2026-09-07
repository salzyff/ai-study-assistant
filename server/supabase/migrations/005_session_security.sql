begin;
-- Run BEFORE deploying the security update. No client role can touch this table/RPC.
create table if not exists public.app_sessions (
 session_id uuid primary key references auth.sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_seen timestamptz not null,
 expired boolean not null default false
);
alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from public, anon, authenticated;
grant all on public.app_sessions to service_role;

create or replace function public.check_app_session(p_session_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
 started timestamptz;
 seen timestamptz;
 ended boolean;
 clock_time timestamptz := clock_timestamp();
begin
 -- Revoked/deleted sessions and currently banned accounts fail even with an unexpired JWT.
 select s.created_at into started from auth.sessions s
 join auth.users u on u.id = s.user_id
 where s.id = p_session_id and s.user_id = p_user_id
 and (u.banned_until is null or u.banned_until <= clock_time);
 if started is null then return false; end if;
 -- Old, never-registered sessions require a new login on rollout.
 insert into public.app_sessions(session_id,user_id,last_seen)
 values(p_session_id,p_user_id,started) on conflict(session_id) do nothing;
 select a.last_seen,a.expired into seen,ended from public.app_sessions a
 where a.session_id=p_session_id and a.user_id=p_user_id for update;
 if not found then return false; end if;
 if ended or seen <= clock_time - interval '1 hour' then
   update public.app_sessions set expired=true where session_id=p_session_id;
   return false;
 end if;
 update public.app_sessions set last_seen=clock_time where session_id=p_session_id;
 return true;
end;
$$;
revoke all on function public.check_app_session(uuid,uuid) from public, anon, authenticated;
grant execute on function public.check_app_session(uuid,uuid) to service_role;

-- This app accesses study data through Express, never directly from the browser.
-- Remove direct REST access so a token cannot bypass the server session/ownership checks.
do $$
declare table_name text;
begin
 foreach table_name in array array[
 'ai_usage','background_jobs','conversations','flashcard_reviews','flashcard_sets',
 'flashcards','messages','mistake_notebook','question_bank','quiz_attempts',
 'quiz_questions','quizzes','study_goals','study_notes','study_sessions','tasks',
 'teach_back_attempts','topic_mastery','written_assessments','answer_reports'
 ] loop
   if to_regclass('public.' || table_name) is not null then
     execute format('alter table public.%I enable row level security', table_name);
     execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
     execute format('grant all on table public.%I to service_role', table_name);
   end if;
 end loop;
end $$;

commit;
