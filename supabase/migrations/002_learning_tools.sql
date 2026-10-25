-- Run after schema.sql. Safe to run on an existing Forma project once.
create table public.lesson_notes (
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 10000),
  updated_at timestamptz not null default now(),
  primary key(student_id,lesson_id)
);
create table public.lesson_bookmarks (
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(student_id,lesson_id)
);
create table public.study_preferences (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  weekly_goal int not null default 3 check (weekly_goal between 1 and 7)
);

alter table public.lesson_notes enable row level security;
alter table public.lesson_bookmarks enable row level security;
alter table public.study_preferences enable row level security;

create policy "Own notes" on public.lesson_notes for select to authenticated using (student_id = (select auth.uid()));
create policy "Write notes for enrolled lessons" on public.lesson_notes for insert to authenticated
  with check (student_id = (select auth.uid()) and exists (
    select 1 from public.lessons l join public.enrollments e on e.course_id = l.course_id
    where l.id = lesson_id and e.student_id = (select auth.uid())));
create policy "Edit own notes" on public.lesson_notes for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "Own bookmarks" on public.lesson_bookmarks for select to authenticated using (student_id = (select auth.uid()));
create policy "Bookmark enrolled lessons" on public.lesson_bookmarks for insert to authenticated
  with check (student_id = (select auth.uid()) and exists (
    select 1 from public.lessons l join public.enrollments e on e.course_id = l.course_id
    where l.id = lesson_id and e.student_id = (select auth.uid())));
create policy "Remove own bookmarks" on public.lesson_bookmarks for delete to authenticated using (student_id = (select auth.uid()));
create policy "Own study preferences" on public.study_preferences for select to authenticated using (student_id = (select auth.uid()));
create policy "Set own study preferences" on public.study_preferences for insert to authenticated with check (student_id = (select auth.uid()));
create policy "Update own study preferences" on public.study_preferences for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));

-- Aggregates contain no student identities. Creator ownership is checked inside the function.
create or replace function public.get_creator_analytics()
returns table(course_id uuid, enrolled_count bigint, completion_count bigint, attempt_count bigint, average_score numeric)
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists
    (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'creator')
  then raise exception 'Creator account required'; end if;
  return query
  select c.id,
    (select count(*) from public.enrollments e where e.course_id = c.id),
    (select count(distinct p.student_id) from public.progress p join public.lessons l on l.id = p.lesson_id where l.course_id = c.id),
    (select count(*) from public.quiz_attempts a join public.lessons l on l.id = a.lesson_id where l.course_id = c.id),
    (select round(avg(a.score)::numeric, 1) from public.quiz_attempts a join public.lessons l on l.id = a.lesson_id where l.course_id = c.id)
  from public.courses c where c.creator_id = (select auth.uid());
end; $$;
revoke all on function public.get_creator_analytics() from public, anon;
grant execute on function public.get_creator_analytics() to authenticated;
