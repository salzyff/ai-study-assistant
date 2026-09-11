-- Run after migrations 001-006. This changes delete rules, NOT existing rows.
-- Legacy soft-deleted accounts are removed individually from Admin > Users.
begin;

create or replace function public.study_ai_deletion_edges()
returns table(child_table text, child_column text, parent_schema text, parent_table text, delete_rule text)
language sql immutable set search_path = '' as $$
  values
    ('conversations', 'user_id', 'auth', 'users', 'CASCADE'),
    ('tasks', 'user_id', 'auth', 'users', 'CASCADE'),
    ('quizzes', 'user_id', 'auth', 'users', 'CASCADE'),
    ('quiz_attempts', 'user_id', 'auth', 'users', 'CASCADE'),
    ('study_notes', 'user_id', 'auth', 'users', 'CASCADE'),
    ('flashcard_sets', 'user_id', 'auth', 'users', 'CASCADE'),
    ('flashcard_reviews', 'user_id', 'auth', 'users', 'CASCADE'),
    ('study_sessions', 'user_id', 'auth', 'users', 'CASCADE'),
    ('ai_usage', 'user_id', 'auth', 'users', 'CASCADE'),
    ('mistake_notebook', 'user_id', 'auth', 'users', 'CASCADE'),
    ('topic_mastery', 'user_id', 'auth', 'users', 'CASCADE'),
    ('teach_back_attempts', 'user_id', 'auth', 'users', 'CASCADE'),
    ('question_bank', 'user_id', 'auth', 'users', 'CASCADE'),
    ('written_assessments', 'user_id', 'auth', 'users', 'CASCADE'),
    ('study_goals', 'user_id', 'auth', 'users', 'CASCADE'),
    ('background_jobs', 'user_id', 'auth', 'users', 'CASCADE'),
    ('answer_reports', 'user_id', 'auth', 'users', 'CASCADE'),
    ('app_sessions', 'user_id', 'auth', 'users', 'CASCADE'),
    ('answer_reports', 'reviewed_by', 'auth', 'users', 'SET NULL'),
    ('messages', 'conversation_id', 'public', 'conversations', 'CASCADE'),
    ('quiz_questions', 'quiz_id', 'public', 'quizzes', 'CASCADE'),
    ('quiz_attempts', 'quiz_id', 'public', 'quizzes', 'CASCADE'),
    ('flashcards', 'set_id', 'public', 'flashcard_sets', 'CASCADE');
$$;

do $$
declare
  edge record;
  existing record;
  child_oid regclass;
  parent_oid regclass;
  column_number smallint;
begin
  for edge in select * from public.study_ai_deletion_edges() loop
    child_oid := to_regclass(format('public.%I', edge.child_table));
    parent_oid := to_regclass(format('%I.%I', edge.parent_schema, edge.parent_table));
    if child_oid is null or parent_oid is null then
      raise exception 'Missing table for %. Run the earlier Study AI migrations first.', edge.child_table;
    end if;
    select attnum into column_number from pg_attribute
      where attrelid = child_oid and attname = edge.child_column and not attisdropped;
    if column_number is null then raise exception 'Missing column %.%', edge.child_table, edge.child_column; end if;

    for existing in select conname from pg_constraint
      where conrelid = child_oid and confrelid = parent_oid and contype = 'f'
        and conkey = array[column_number]::smallint[]
        and confdeltype <> case when edge.delete_rule = 'CASCADE' then 'c' else 'n' end
    loop
      execute format('alter table public.%I drop constraint %I', edge.child_table, existing.conname);
    end loop;
    if not exists (select 1 from pg_constraint
      where conrelid = child_oid and confrelid = parent_oid and contype = 'f'
        and conkey = array[column_number]::smallint[]
        and confdeltype = case when edge.delete_rule = 'CASCADE' then 'c' else 'n' end)
    then
      -- NOT VALID avoids deleting or rewriting historic orphan records during
      -- installation; the FK still enforces future writes and cascades deletes.
      execute format('alter table public.%I add constraint %I foreign key (%I) references %I.%I(id) on delete %s not valid',
        edge.child_table, edge.child_table || '_' || edge.child_column || '_studyai_delete_fkey',
        edge.child_column, edge.parent_schema, edge.parent_table, edge.delete_rule);
    end if;
  end loop;
end $$;

create or replace function public.study_ai_user_deletion_ready()
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.study_ai_deletion_edges() edge
    where not exists (
      select 1 from pg_catalog.pg_constraint c
      join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attname = edge.child_column
      where c.contype = 'f' and c.conkey = array[a.attnum]::smallint[]
        and c.conrelid = to_regclass(format('public.%I', edge.child_table))
        and c.confrelid = to_regclass(format('%I.%I', edge.parent_schema, edge.parent_table))
        and c.confdeltype = case when edge.delete_rule = 'CASCADE' then 'c' else 'n' end
    )
  );
$$;

revoke all on function public.study_ai_deletion_edges() from public, anon, authenticated;
revoke all on function public.study_ai_user_deletion_ready() from public, anon, authenticated;
grant execute on function public.study_ai_user_deletion_ready() to service_role;
notify pgrst, 'reload schema';
commit;
