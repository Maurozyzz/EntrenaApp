-- Origen Coaching — schema inicial
-- Pegar y correr una sola vez en el SQL Editor de Supabase (proyecto recién creado).
-- Instrucciones de uso al final del archivo.

-- =========================================================================
-- 1. TABLAS
-- =========================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('trainer', 'student')),
  trainer_id uuid references public.profiles (id),
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id bigint generated always as identity primary key,
  name text not null,
  muscle_group text,
  video_url text,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.routines (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id),
  trainer_id uuid not null references public.profiles (id),
  name text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.routine_exercises (
  id bigint generated always as identity primary key,
  routine_id bigint not null references public.routines (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id),
  day_of_week smallint,
  order_index int not null default 0,
  sets smallint,
  reps text,
  weight_target numeric(6, 2),
  rest_seconds int,
  notes text
);

create table if not exists public.workout_logs (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id),
  routine_exercise_id bigint references public.routine_exercises (id),
  performed_at timestamptz not null default now(),
  sets_completed smallint,
  reps_completed text,
  weight_used numeric(6, 2),
  notes text
);

create table if not exists public.body_measurements (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id),
  measured_at date not null default current_date,
  weight_kg numeric(5, 2),
  body_fat_pct numeric(4, 2),
  chest_cm numeric(5, 2),
  waist_cm numeric(5, 2),
  hip_cm numeric(5, 2),
  arm_cm numeric(5, 2),
  notes text
);

-- La UI de carga de fotos (bucket de Storage + policies) queda para una
-- siguiente iteración; la tabla ya queda lista para eso.
create table if not exists public.progress_photos (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id),
  taken_at date not null default current_date,
  storage_path text not null,
  notes text
);

create table if not exists public.nutrition_plans (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id),
  trainer_id uuid not null references public.profiles (id),
  name text not null,
  calories_target int,
  protein_g int,
  carbs_g int,
  fat_g int,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id),
  amount numeric(10, 2) not null,
  currency text not null default 'ARS',
  period_start date not null,
  period_end date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- 2. INDICES EN FOREIGN KEYS
-- =========================================================================

create index if not exists profiles_trainer_id_idx on public.profiles (trainer_id);
create index if not exists exercises_created_by_idx on public.exercises (created_by);
create index if not exists routines_student_id_idx on public.routines (student_id);
create index if not exists routines_trainer_id_idx on public.routines (trainer_id);
create index if not exists routine_exercises_routine_id_idx on public.routine_exercises (routine_id);
create index if not exists routine_exercises_exercise_id_idx on public.routine_exercises (exercise_id);
create index if not exists workout_logs_student_id_idx on public.workout_logs (student_id);
create index if not exists workout_logs_routine_exercise_id_idx on public.workout_logs (routine_exercise_id);
create index if not exists body_measurements_student_id_idx on public.body_measurements (student_id);
create index if not exists progress_photos_student_id_idx on public.progress_photos (student_id);
create index if not exists nutrition_plans_student_id_idx on public.nutrition_plans (student_id);
create index if not exists nutrition_plans_trainer_id_idx on public.nutrition_plans (trainer_id);
create index if not exists payments_student_id_idx on public.payments (student_id);

-- =========================================================================
-- 3. FUNCIONES HELPER (schema privado, no expuesto por la API)
-- =========================================================================

create schema if not exists private;

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

create or replace function private.my_trainer_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select trainer_id from public.profiles where id = (select auth.uid());
$$;

revoke execute on function private.my_trainer_id() from public, anon;
grant execute on function private.my_trainer_id() to authenticated;

create or replace function private.is_trainer()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'trainer'
  );
$$;

revoke execute on function private.is_trainer() from public, anon;
grant execute on function private.is_trainer() to authenticated;

-- =========================================================================
-- 4. ALTA DE USUARIOS: auth.users -> public.profiles
-- El rol nunca lo elige el cliente. Si el email coincide con el del
-- entrenador, se crea como 'trainer'; cualquier otro alumno queda
-- automáticamente vinculado a ese entrenador.
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer_id uuid;
begin
  if new.email = 'maurito.city@gmail.com' then
    insert into public.profiles (id, role, trainer_id, full_name, email)
    values (new.id, 'trainer', null, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  else
    select id into v_trainer_id from public.profiles where role = 'trainer' limit 1;
    insert into public.profiles (id, role, trainer_id, full_name, email)
    values (new.id, 'student', v_trainer_id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Evita que un alumno se auto-asigne role='trainer' o cambie su trainer_id
-- actualizando su propia fila de profiles directamente.
create or replace function public.enforce_profile_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.trainer_id is distinct from old.trainer_id) then
    if not exists (
      select 1 from public.profiles where id = (select auth.uid()) and role = 'trainer'
    ) then
      new.role := old.role;
      new.trainer_id := old.trainer_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role_trainer on public.profiles;
create trigger profiles_protect_role_trainer
  before update on public.profiles
  for each row execute function public.enforce_profile_immutable_fields();

-- =========================================================================
-- 5. ROW LEVEL SECURITY
-- =========================================================================

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.exercises enable row level security;
alter table public.exercises force row level security;
alter table public.routines enable row level security;
alter table public.routines force row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_exercises force row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_logs force row level security;
alter table public.body_measurements enable row level security;
alter table public.body_measurements force row level security;
alter table public.progress_photos enable row level security;
alter table public.progress_photos force row level security;
alter table public.nutrition_plans enable row level security;
alter table public.nutrition_plans force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;

-- profiles: cada uno ve su propia fila, el entrenador ve sus alumnos,
-- el alumno ve a su entrenador. Update permitido solo para esas mismas filas
-- (role/trainer_id quedan protegidos por el trigger de arriba).
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or trainer_id = (select auth.uid())
    or id = (select private.my_trainer_id())
  );

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or trainer_id = (select auth.uid()))
  with check (id = (select auth.uid()) or trainer_id = (select auth.uid()));

-- exercises: catálogo de lectura compartida, solo el entrenador administra.
create policy "exercises_select" on public.exercises
  for select to authenticated
  using (true);

create policy "exercises_write" on public.exercises
  for all to authenticated
  using ((select private.is_trainer()))
  with check ((select private.is_trainer()));

-- routines: el alumno ve las suyas, el entrenador administra las de sus alumnos.
create policy "routines_select" on public.routines
  for select to authenticated
  using (student_id = (select auth.uid()) or trainer_id = (select auth.uid()));

create policy "routines_write" on public.routines
  for all to authenticated
  using (trainer_id = (select auth.uid()))
  with check (trainer_id = (select auth.uid()));

-- routine_exercises: hereda el acceso de la rutina padre.
create policy "routine_exercises_select" on public.routine_exercises
  for select to authenticated
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_exercises.routine_id
        and (r.student_id = (select auth.uid()) or r.trainer_id = (select auth.uid()))
    )
  );

create policy "routine_exercises_write" on public.routine_exercises
  for all to authenticated
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_exercises.routine_id and r.trainer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_exercises.routine_id and r.trainer_id = (select auth.uid())
    )
  );

-- workout_logs: el alumno registra y ve lo propio, el entrenador solo ve.
create policy "workout_logs_select" on public.workout_logs
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)));

create policy "workout_logs_write" on public.workout_logs
  for all to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- body_measurements / progress_photos: puede cargarlas el alumno o su entrenador.
create policy "body_measurements_all" on public.body_measurements
  for all to authenticated
  using (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)))
  with check (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)));

create policy "progress_photos_all" on public.progress_photos
  for all to authenticated
  using (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)))
  with check (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)));

-- nutrition_plans: el entrenador administra, el alumno solo lee las suyas.
create policy "nutrition_plans_select" on public.nutrition_plans
  for select to authenticated
  using (student_id = (select auth.uid()) or trainer_id = (select auth.uid()));

create policy "nutrition_plans_write" on public.nutrition_plans
  for all to authenticated
  using (trainer_id = (select auth.uid()))
  with check (trainer_id = (select auth.uid()));

-- payments: el entrenador administra (el alumno NO puede marcarse su propio
-- pago como 'paid'), el alumno solo lee su historial.
create policy "payments_select" on public.payments
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)));

create policy "payments_write" on public.payments
  for all to authenticated
  using ((select private.is_trainer_of(student_id)))
  with check ((select private.is_trainer_of(student_id)));

-- =========================================================================
-- Cómo usar este script
-- =========================================================================
-- 1. Dashboard de Supabase -> tu proyecto -> SQL Editor -> pegar todo este
--    archivo -> Run. Se puede correr una sola vez (proyecto recién creado).
-- 2. Registrate en la app (pantalla de login/registro) con
--    maurito.city@gmail.com primero: el trigger te va a crear como
--    role='trainer'. Cualquier otra cuenta que se registre después queda
--    como 'student', vinculada automáticamente a ese entrenador.
-- 3. Si en algún momento cambiás el email del entrenador, actualizá el
--    valor 'maurito.city@gmail.com' en la función handle_new_user() de
--    este archivo y volvé a correr esa sección (CREATE OR REPLACE FUNCTION).
