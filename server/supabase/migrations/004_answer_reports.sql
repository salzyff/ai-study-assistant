create table if not exists public.answer_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('chat','quiz')),
 source_id uuid not null,
 container_id uuid not null,
 reason text not null check (char_length(reason) between 1 and 1000),
 snapshot jsonb not null,
 status text not null default 'open' check (status in ('open','reviewed','dismissed')),
 admin_note text,
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,kind,source_id)
);
alter table public.answer_reports enable row level security;
-- Access exclusively through the authenticated Express routes using the service key.
revoke all on public.answer_reports from anon, authenticated;
grant all on public.answer_reports to service_role;
create index if not exists answer_reports_queue on public.answer_reports(status,created_at desc);
