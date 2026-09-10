-- Query support for a school-sized rollout and session administration.
create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

create index if not exists app_sessions_user_id_idx
  on public.app_sessions (user_id);
