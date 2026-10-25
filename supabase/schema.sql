-- Forma schema. Run once in the Supabase SQL Editor on a new project.
-- All browser access uses the publishable/anon key and row-level security.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Learner',
  role text not null default 'student' check (role in ('student','creator')),
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 90),
  subtitle text not null default '',
  description text not null check (char_length(description) > 0),
  category text not null,
  level text not null check (level in ('Beginner','Intermediate','Advanced')),
  color text not null default 'coral' check (color in ('coral','blue','green','violet')),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null check (position > 0),
  title text not null check (char_length(title) > 0),
  summary text not null default '',
  body text not null check (char_length(body) > 0),
  media_type text not null default 'none' check (media_type in ('none','video','audio','link')),
  media_url text check (media_url is null or media_url ~ '^https://'),
  duration_minutes int not null default 10 check (duration_minutes between 1 and 240),
  unique(course_id,position)
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index int not null check (correct_index between 0 and 3),
  explanation text not null default ''
);

create table public.enrollments (
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key(student_id,course_id)
);

create table public.progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key(student_id,lesson_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  score int not null check (score between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.discussion_posts (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index on public.lessons(course_id,position);
create index on public.discussion_posts(lesson_id,created_at desc);
create index on public.quiz_attempts(student_id,created_at desc);

create or replace function public.on_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name,role)
  values(new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'Learner'),
    case when new.raw_user_meta_data->>'role' = 'creator' then 'creator' else 'student' end);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.on_new_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.enrollments enable row level security;
alter table public.progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.discussion_posts enable row level security;

create policy "Profiles visible for author names" on public.profiles for select to anon, authenticated using (id = (select auth.uid()) or role = 'creator');
create policy "Published courses and own drafts" on public.courses for select to anon, authenticated
  using (published or creator_id = (select auth.uid()));
create policy "Creators add courses" on public.courses for insert to authenticated
  with check (creator_id = (select auth.uid()) and exists
    (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'creator'));
create policy "Creators edit own courses" on public.courses for update to authenticated
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));

create policy "Lessons of readable courses" on public.lessons for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and (c.published or c.creator_id = (select auth.uid()))));
create policy "Creator inserts lessons" on public.lessons for insert to authenticated
  with check (exists (select 1 from public.courses c where c.id = course_id and c.creator_id = (select auth.uid())));
create policy "Creator updates lessons" on public.lessons for update to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.creator_id = (select auth.uid())))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.creator_id = (select auth.uid())));

-- Answer keys are never selected directly by learners. The two RPCs below are the only learner quiz interface.
create policy "Creator reads answer keys" on public.quiz_questions for select to authenticated
  using (exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = lesson_id and c.creator_id = (select auth.uid())));
create policy "Creator adds quiz questions" on public.quiz_questions for insert to authenticated
  with check (exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = lesson_id and c.creator_id = (select auth.uid())));

create policy "Own enrollments" on public.enrollments for select to authenticated
  using (student_id = (select auth.uid()));
create policy "Enroll in published courses" on public.enrollments for insert to authenticated
  with check (student_id = (select auth.uid()) and exists
    (select 1 from public.courses c where c.id = course_id and c.published));
create policy "Own progress" on public.progress for select to authenticated
  using (student_id = (select auth.uid()));
create policy "Complete enrolled lessons" on public.progress for insert to authenticated
  with check (student_id = (select auth.uid()) and exists
    (select 1 from public.lessons l join public.enrollments e on e.course_id = l.course_id
    where l.id = lesson_id and e.student_id = (select auth.uid())));
create policy "Update own progress" on public.progress for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()) and exists
    (select 1 from public.lessons l join public.enrollments e on e.course_id = l.course_id
    where l.id = lesson_id and e.student_id = (select auth.uid())));
create policy "Read own attempts" on public.quiz_attempts for select to authenticated
  using (student_id = (select auth.uid()));

create policy "Discussion visible to enrolled learners and creator" on public.discussion_posts for select to authenticated
  using (exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = lesson_id and (c.creator_id = (select auth.uid()) or exists
      (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = (select auth.uid())))));
create policy "Enrolled learners and creator can post" on public.discussion_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and exists
    (select 1 from public.lessons l join public.courses c on c.id = l.course_id
     where l.id = lesson_id and (c.creator_id = (select auth.uid()) or exists
       (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = (select auth.uid())))));

create or replace function public.get_lesson_quiz(p_lesson_id uuid)
returns table(id uuid, lesson_id uuid, prompt text, options jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = p_lesson_id and (c.creator_id = (select auth.uid()) or
      (c.published and exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = (select auth.uid()))))
  ) then raise exception 'Not authorized for this lesson'; end if;
  return query select q.id,q.lesson_id,q.prompt,q.options from public.quiz_questions q where q.lesson_id = p_lesson_id order by q.id;
end; $$;

create or replace function public.submit_lesson_quiz(p_lesson_id uuid, p_answers jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_total int; v_correct int; v_score int;
begin
  if v_user is null or not exists (
    select 1 from public.lessons l join public.courses c on c.id = l.course_id
    join public.enrollments e on e.course_id = c.id and e.student_id = v_user
    where l.id = p_lesson_id and c.published
  ) then raise exception 'Enroll in the course to submit practice'; end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Invalid answers'; end if;
  select count(*), count(*) filter (where p_answers ? q.id::text
    and (p_answers->>q.id::text) ~ '^[0-3]$'
    and (p_answers->>q.id::text)::int = q.correct_index)
    into v_total,v_correct from public.quiz_questions q where q.lesson_id = p_lesson_id;
  if v_total = 0 or (select count(*) from jsonb_object_keys(p_answers)) <> v_total then raise exception 'Answer every question'; end if;
  v_score := round(v_correct * 100.0 / v_total);
  insert into public.quiz_attempts(student_id,lesson_id,score) values(v_user,p_lesson_id,v_score);
  return v_score;
end; $$;

revoke all on function public.get_lesson_quiz(uuid) from public, anon;
revoke all on function public.submit_lesson_quiz(uuid,jsonb) from public, anon;
grant execute on function public.get_lesson_quiz(uuid) to authenticated;
grant execute on function public.submit_lesson_quiz(uuid,jsonb) to authenticated;
