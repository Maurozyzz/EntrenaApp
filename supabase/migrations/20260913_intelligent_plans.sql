-- Origen Coaching: núcleo versionado para planes inteligentes y adaptación.
-- Migración aditiva: conserva routines, nutrition_plans y diet_entries actuales.

create extension if not exists pgcrypto;

create table if not exists public.training_plan_versions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id),
  version_number integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  source text not null default 'trainer' check (source in ('trainer', 'rules', 'ai', 'student_request')),
  change_reason text,
  profile_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (student_id, version_number)
);

create table if not exists public.training_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.training_plan_versions (id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 7),
  label text not null,
  is_rest_day boolean not null default false,
  session_minutes smallint,
  unique (plan_version_id, day_number)
);

create table if not exists public.training_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.training_plan_days (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id),
  order_index smallint not null default 0,
  sets smallint,
  reps text,
  rest_seconds integer,
  rir_target numeric(3, 1),
  tempo text,
  load_target numeric(6, 2),
  notes text,
  selection_reason text
);

create table if not exists public.nutrition_plan_versions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id),
  version_number integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  source text not null default 'trainer' check (source in ('trainer', 'rules', 'ai', 'student_request')),
  change_reason text,
  calories_target integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  profile_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (student_id, version_number)
);

create table if not exists public.nutrition_plan_meals (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.nutrition_plan_versions (id) on delete cascade,
  order_index smallint not null default 0,
  label text not null,
  scheduled_time time,
  notes text
);

create table if not exists public.nutrition_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.nutrition_plan_meals (id) on delete cascade,
  food_id bigint not null references public.foods (id),
  quantity numeric(8, 2) not null check (quantity > 0),
  unit text not null default 'g' check (unit in ('g', 'ml', 'unit')),
  alternative_group text,
  notes text
);

create table if not exists public.plan_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid references public.profiles (id),
  training_plan_version_id uuid references public.training_plan_versions (id) on delete set null,
  nutrition_plan_version_id uuid references public.nutrition_plan_versions (id) on delete set null,
  feedback_date date not null default current_date,
  difficulty smallint check (difficulty between 1 and 5),
  energy smallint check (energy between 1 and 5),
  pain_level smallint check (pain_level between 0 and 10),
  adherence_pct smallint check (adherence_pct between 0 and 100),
  liked text,
  disliked text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.adaptation_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid references public.profiles (id),
  request_text text not null,
  scope text not null default 'both' check (scope in ('training', 'nutrition', 'both')),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'applied', 'rejected')),
  parsed_action jsonb,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.student_memory (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  memory_key text not null,
  memory_value text not null,
  source text not null default 'manual' check (source in ('manual', 'feedback', 'request', 'ai')),
  confidence numeric(4, 3) not null default 1.0 check (confidence between 0 and 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, memory_key, memory_value)
);

create index if not exists training_plan_versions_student_idx on public.training_plan_versions (student_id, status);
create index if not exists training_plan_days_version_idx on public.training_plan_days (plan_version_id);
create index if not exists training_plan_exercises_day_idx on public.training_plan_exercises (plan_day_id, order_index);
create index if not exists nutrition_plan_versions_student_idx on public.nutrition_plan_versions (student_id, status);
create index if not exists nutrition_plan_meals_version_idx on public.nutrition_plan_meals (plan_version_id, order_index);
create index if not exists nutrition_plan_items_meal_idx on public.nutrition_plan_items (meal_id);
create index if not exists plan_feedback_student_date_idx on public.plan_feedback (student_id, feedback_date desc);
create index if not exists adaptation_requests_student_status_idx on public.adaptation_requests (student_id, status);
create index if not exists student_memory_student_active_idx on public.student_memory (student_id, active);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.training_plan_versions enable row level security;
alter table public.training_plan_days enable row level security;
alter table public.training_plan_exercises enable row level security;
alter table public.nutrition_plan_versions enable row level security;
alter table public.nutrition_plan_meals enable row level security;
alter table public.nutrition_plan_items enable row level security;
alter table public.plan_feedback enable row level security;
alter table public.adaptation_requests enable row level security;
alter table public.student_memory enable row level security;

create or replace function private.is_trainer_of(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = target_student_id
      and trainer_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_trainer_of(uuid) from public, anon;
grant execute on function private.is_trainer_of(uuid) to authenticated;

drop policy if exists training_plan_versions_select on public.training_plan_versions;
create policy training_plan_versions_select on public.training_plan_versions
  for select to authenticated
  using (student_id = (select auth.uid()) or trainer_id = (select auth.uid()));

drop policy if exists training_plan_versions_write on public.training_plan_versions;
create policy training_plan_versions_write on public.training_plan_versions
  for all to authenticated
  using (trainer_id = (select auth.uid()))
  with check (trainer_id = (select auth.uid()));

drop policy if exists training_plan_days_select on public.training_plan_days;
create policy training_plan_days_select on public.training_plan_days
  for select to authenticated
  using (exists (
    select 1 from public.training_plan_versions v
    where v.id = training_plan_days.plan_version_id
      and (v.student_id = (select auth.uid()) or v.trainer_id = (select auth.uid()))
  ));

drop policy if exists training_plan_days_write on public.training_plan_days;
create policy training_plan_days_write on public.training_plan_days
  for all to authenticated
  using (exists (
    select 1 from public.training_plan_versions v
    where v.id = training_plan_days.plan_version_id
      and v.trainer_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_plan_versions v
    where v.id = training_plan_days.plan_version_id
      and v.trainer_id = (select auth.uid())
  ));

drop policy if exists training_plan_exercises_select on public.training_plan_exercises;
create policy training_plan_exercises_select on public.training_plan_exercises
  for select to authenticated
  using (exists (
    select 1 from public.training_plan_days d
    join public.training_plan_versions v on v.id = d.plan_version_id
    where d.id = training_plan_exercises.plan_day_id
      and (v.student_id = (select auth.uid()) or v.trainer_id = (select auth.uid()))
  ));

drop policy if exists training_plan_exercises_write on public.training_plan_exercises;
create policy training_plan_exercises_write on public.training_plan_exercises
  for all to authenticated
  using (exists (
    select 1 from public.training_plan_days d
    join public.training_plan_versions v on v.id = d.plan_version_id
    where d.id = training_plan_exercises.plan_day_id
      and v.trainer_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_plan_days d
    join public.training_plan_versions v on v.id = d.plan_version_id
    where d.id = training_plan_exercises.plan_day_id
      and v.trainer_id = (select auth.uid())
  ));

drop policy if exists nutrition_plan_versions_select on public.nutrition_plan_versions;
create policy nutrition_plan_versions_select on public.nutrition_plan_versions
  for select to authenticated
  using (student_id = (select auth.uid()) or trainer_id = (select auth.uid()));

drop policy if exists nutrition_plan_versions_write on public.nutrition_plan_versions;
create policy nutrition_plan_versions_write on public.nutrition_plan_versions
  for all to authenticated
  using (trainer_id = (select auth.uid()))
  with check (trainer_id = (select auth.uid()));

drop policy if exists nutrition_plan_meals_select on public.nutrition_plan_meals;
create policy nutrition_plan_meals_select on public.nutrition_plan_meals
  for select to authenticated
  using (exists (
    select 1 from public.nutrition_plan_versions v
    where v.id = nutrition_plan_meals.plan_version_id
      and (v.student_id = (select auth.uid()) or v.trainer_id = (select auth.uid()))
  ));

drop policy if exists nutrition_plan_meals_write on public.nutrition_plan_meals;
create policy nutrition_plan_meals_write on public.nutrition_plan_meals
  for all to authenticated
  using (exists (
    select 1 from public.nutrition_plan_versions v
    where v.id = nutrition_plan_meals.plan_version_id
      and v.trainer_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.nutrition_plan_versions v
    where v.id = nutrition_plan_meals.plan_version_id
      and v.trainer_id = (select auth.uid())
  ));

drop policy if exists nutrition_plan_items_select on public.nutrition_plan_items;
create policy nutrition_plan_items_select on public.nutrition_plan_items
  for select to authenticated
  using (exists (
    select 1 from public.nutrition_plan_meals m
    join public.nutrition_plan_versions v on v.id = m.plan_version_id
    where m.id = nutrition_plan_items.meal_id
      and (v.student_id = (select auth.uid()) or v.trainer_id = (select auth.uid()))
  ));

drop policy if exists nutrition_plan_items_write on public.nutrition_plan_items;
create policy nutrition_plan_items_write on public.nutrition_plan_items
  for all to authenticated
  using (exists (
    select 1 from public.nutrition_plan_meals m
    join public.nutrition_plan_versions v on v.id = m.plan_version_id
    where m.id = nutrition_plan_items.meal_id
      and v.trainer_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.nutrition_plan_meals m
    join public.nutrition_plan_versions v on v.id = m.plan_version_id
    where m.id = nutrition_plan_items.meal_id
      and v.trainer_id = (select auth.uid())
  ));

drop policy if exists plan_feedback_access on public.plan_feedback;
create policy plan_feedback_access on public.plan_feedback
  for all to authenticated
  using (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)))
  with check (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)));

drop policy if exists adaptation_requests_access on public.adaptation_requests;
create policy adaptation_requests_access on public.adaptation_requests
  for all to authenticated
  using (student_id = (select auth.uid()) or trainer_id = (select auth.uid()))
  with check (student_id = (select auth.uid()) or trainer_id = (select auth.uid()));

drop policy if exists student_memory_access on public.student_memory;
create policy student_memory_access on public.student_memory
  for all to authenticated
  using (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)))
  with check (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)));

notify pgrst, 'reload schema';
