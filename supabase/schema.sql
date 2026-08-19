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

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'exercises_name_unique' and conrelid = 'public.exercises'::regclass
  ) then
    alter table public.exercises add constraint exercises_name_unique unique (name);
  end if;
end $$;

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
  routine_exercise_id bigint references public.routine_exercises (id) on delete set null,
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

create table if not exists public.meal_photos (
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

-- Catálogo de alimentos con macros por 100g (mismo espíritu que "exercises":
-- catálogo compartido de lectura, solo el entrenador lo administra).
create table if not exists public.foods (
  id bigint generated always as identity primary key,
  name text not null,
  calories_per_100g numeric(6, 1) not null,
  protein_per_100g numeric(5, 1) not null,
  carbs_per_100g numeric(5, 1) not null,
  fat_per_100g numeric(5, 1) not null,
  barcode text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foods_barcode_unique' and conrelid = 'public.foods'::regclass
  ) then
    alter table public.foods add constraint foods_barcode_unique unique (barcode);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'foods_name_unique' and conrelid = 'public.foods'::regclass
  ) then
    alter table public.foods add constraint foods_name_unique unique (name);
  end if;
end $$;

-- La dieta detallada que carga el alumno (lo que el entrenador le mandó por
-- fuera de la app): lista de alimentos + cantidad. Los macros se calculan
-- en el front a partir del catálogo de "foods", no se guardan acá.
create table if not exists public.diet_entries (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id),
  food_id bigint not null references public.foods (id),
  quantity_g numeric(6, 1) not null,
  quantity_unit text not null default 'g' check (quantity_unit in ('g', 'ml')),
  meal_label text,
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
  receipt_path text,
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
create index if not exists meal_photos_student_id_idx on public.meal_photos (student_id);
create index if not exists foods_created_by_idx on public.foods (created_by);
create index if not exists diet_entries_student_id_idx on public.diet_entries (student_id);
create index if not exists diet_entries_food_id_idx on public.diet_entries (food_id);
create index if not exists nutrition_plans_student_id_idx on public.nutrition_plans (student_id);
create index if not exists nutrition_plans_trainer_id_idx on public.nutrition_plans (trainer_id);
create index if not exists payments_student_id_idx on public.payments (student_id);

-- =========================================================================
-- 3. GRANTS
-- RLS restringe filas, pero primero hace falta el permiso a nivel de tabla
-- para que el rol pueda intentar la operación. Sin esto, PostgREST devuelve
-- 403 "permission denied" antes de siquiera evaluar las policies.
-- =========================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

-- Para que las tablas que se creen de acá en más (nuevas features) ya
-- nazcan con el permiso, sin tener que acordarse de repetir el GRANT.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage on sequences to authenticated;

-- =========================================================================
-- 4. FUNCIONES HELPER (schema privado, no expuesto por la API)
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
-- 5. ALTA DE USUARIOS: auth.users -> public.profiles
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

-- El alumno puede actualizar su propio pago solo para adjuntar el
-- comprobante (receipt_path); cualquier otro campo queda protegido y solo
-- lo puede cambiar el entrenador (mismo patrón que profiles arriba).
create or replace function public.enforce_payment_student_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_trainer_of(new.student_id)) then
    new.student_id := old.student_id;
    new.amount := old.amount;
    new.currency := old.currency;
    new.period_start := old.period_start;
    new.period_end := old.period_end;
    new.status := old.status;
    new.paid_at := old.paid_at;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_protect_fields on public.payments;
create trigger payments_protect_fields
  before update on public.payments
  for each row execute function public.enforce_payment_student_fields();

-- =========================================================================
-- 6. ROW LEVEL SECURITY
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
alter table public.meal_photos enable row level security;
alter table public.meal_photos force row level security;
alter table public.foods enable row level security;
alter table public.foods force row level security;
alter table public.diet_entries enable row level security;
alter table public.diet_entries force row level security;
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

-- foods: catálogo compartido de lectura, solo el entrenador administra.
create policy "foods_select" on public.foods
  for select to authenticated
  using (true);

create policy "foods_write" on public.foods
  for all to authenticated
  using ((select private.is_trainer()))
  with check ((select private.is_trainer()));

-- Cualquiera puede sumar un alimento nuevo al catálogo (ej: al escanear un
-- código de barras); editar/borrar alimentos existentes sigue siendo solo
-- del entrenador (policy de arriba).
create policy "foods_insert_any" on public.foods
  for insert to authenticated
  with check (true);

-- diet_entries: el alumno carga y ve la suya, el entrenador solo ve
-- (mismo patrón que workout_logs).
create policy "diet_entries_select" on public.diet_entries
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)));

create policy "diet_entries_write" on public.diet_entries
  for all to authenticated
  using (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)))
  with check (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)));

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

create policy "meal_photos_all" on public.meal_photos
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

-- El alumno puede actualizar su propio pago (solo para subir el comprobante;
-- el trigger payments_protect_fields bloquea cualquier otro campo).
create policy "payments_student_update" on public.payments
  for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- =========================================================================
-- 7. STORAGE: fotos de progreso
-- Bucket privado. Cada archivo se guarda como "{student_id}/archivo.jpg",
-- así la policy puede identificar al dueño por la primera carpeta del path.
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "progress_photos_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_trainer_of(((storage.foldername(name))[1])::uuid))
    )
  );

create policy "progress_photos_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "progress_photos_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- =========================================================================
-- 8. STORAGE: fotos de comidas (mismo patrón que las de progreso)
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

create policy "meal_photos_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_trainer_of(((storage.foldername(name))[1])::uuid))
    )
  );

create policy "meal_photos_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "meal_photos_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- =========================================================================
-- 9b. STORAGE: comprobantes de pago (mismo patrón)
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

create policy "payment_receipts_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_trainer_of(((storage.foldername(name))[1])::uuid))
    )
  );

create policy "payment_receipts_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "payment_receipts_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- =========================================================================
-- 9. CATÁLOGO DE EJERCICIOS BASE
-- Seed idempotente (ON CONFLICT por nombre) con ejercicios comunes de
-- gimnasio, agrupados por grupo muscular. El video se genera en el front
-- a partir del nombre (búsqueda embebida de YouTube), no hace falta cargarlo acá.
-- =========================================================================

insert into public.exercises (name, muscle_group) values
  ('Press de banca con barra', 'Pecho'),
  ('Press inclinado con barra', 'Pecho'),
  ('Press declinado con barra', 'Pecho'),
  ('Press de banca con mancuernas', 'Pecho'),
  ('Press inclinado con mancuernas', 'Pecho'),
  ('Aperturas con mancuernas', 'Pecho'),
  ('Cruce de poleas (crossover)', 'Pecho'),
  ('Fondos en paralelas', 'Pecho'),
  ('Pullover con mancuerna', 'Pecho'),
  ('Press en máquina Smith', 'Pecho'),
  ('Dominadas', 'Espalda'),
  ('Jalón al pecho en polea', 'Espalda'),
  ('Remo con barra', 'Espalda'),
  ('Remo con mancuerna a una mano', 'Espalda'),
  ('Remo en polea baja', 'Espalda'),
  ('Remo en máquina', 'Espalda'),
  ('Peso muerto', 'Espalda'),
  ('Hiperextensiones', 'Espalda'),
  ('Face pull', 'Espalda'),
  ('Pull-over en polea', 'Espalda'),
  ('Sentadilla con barra', 'Piernas'),
  ('Sentadilla frontal', 'Piernas'),
  ('Prensa de piernas', 'Piernas'),
  ('Zancadas (lunges)', 'Piernas'),
  ('Sentadilla búlgara', 'Piernas'),
  ('Peso muerto rumano', 'Piernas'),
  ('Extensión de cuádriceps en máquina', 'Piernas'),
  ('Curl femoral en máquina', 'Piernas'),
  ('Elevación de talones de pie (gemelos)', 'Piernas'),
  ('Elevación de talones sentado (gemelos)', 'Piernas'),
  ('Hip thrust con barra', 'Glúteos'),
  ('Puente de glúteo', 'Glúteos'),
  ('Patada de glúteo en polea', 'Glúteos'),
  ('Abducción de cadera en máquina', 'Glúteos'),
  ('Press militar con barra', 'Hombros'),
  ('Press de hombros con mancuernas', 'Hombros'),
  ('Press Arnold', 'Hombros'),
  ('Elevaciones laterales con mancuernas', 'Hombros'),
  ('Elevaciones frontales con mancuernas', 'Hombros'),
  ('Pájaro (elevaciones posteriores)', 'Hombros'),
  ('Remo al mentón (upright row)', 'Hombros'),
  ('Curl con barra', 'Bíceps'),
  ('Curl con mancuernas alternado', 'Bíceps'),
  ('Curl martillo', 'Bíceps'),
  ('Curl concentrado', 'Bíceps'),
  ('Curl en polea baja', 'Bíceps'),
  ('Curl predicador (banco Scott)', 'Bíceps'),
  ('Press francés', 'Tríceps'),
  ('Extensión de tríceps en polea alta', 'Tríceps'),
  ('Fondos entre bancos', 'Tríceps'),
  ('Patada de tríceps con mancuerna', 'Tríceps'),
  ('Press cerrado en banca', 'Tríceps'),
  ('Plancha (plank)', 'Core'),
  ('Abdominales crunch', 'Core'),
  ('Elevación de piernas colgado', 'Core'),
  ('Rueda abdominal (ab wheel)', 'Core'),
  ('Giro ruso (russian twist)', 'Core'),
  ('Abdominales en polea alta', 'Core'),
  ('Correr en cinta', 'Cardio'),
  ('Bicicleta fija', 'Cardio'),
  ('Remo (máquina de cardio)', 'Cardio'),
  ('Escaladora (stairmaster)', 'Cardio'),
  ('Salto a la comba', 'Cardio')
on conflict (name) do nothing;

-- =========================================================================
-- 10. CATÁLOGO DE ALIMENTOS BASE (macros por 100g, valores de referencia)
-- Seed idempotente. El alumno arma su dieta eligiendo de acá + cantidad.
-- =========================================================================

insert into public.foods (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g) values
  ('Pechuga de pollo', 165, 31, 0, 3.6),
  ('Carne vacuna magra', 250, 26, 0, 15),
  ('Pavo (pechuga)', 135, 30, 0, 1),
  ('Huevo entero', 155, 13, 1.1, 11),
  ('Clara de huevo', 52, 11, 0.7, 0.2),
  ('Atún al natural', 116, 26, 0, 1),
  ('Salmón', 208, 20, 0, 13),
  ('Merluza', 90, 18, 0, 1),
  ('Whey protein (polvo)', 380, 80, 8, 5),
  ('Queso fresco / cottage', 98, 11, 3.4, 4.3),
  ('Yogur griego natural', 59, 10, 3.6, 0.4),
  ('Lentejas cocidas', 116, 9, 20, 0.4),
  ('Garbanzos cocidos', 164, 9, 27, 2.6),
  ('Tofu', 76, 8, 1.9, 4.8),
  ('Arroz blanco cocido', 130, 2.7, 28, 0.3),
  ('Arroz integral cocido', 111, 2.6, 23, 0.9),
  ('Papa cocida', 87, 1.9, 20, 0.1),
  ('Batata cocida', 90, 2, 21, 0.1),
  ('Avena (copos secos)', 389, 17, 66, 7),
  ('Pan integral', 247, 13, 41, 4.2),
  ('Pan blanco', 265, 9, 49, 3.2),
  ('Pasta cocida', 131, 5, 25, 1.1),
  ('Quinoa cocida', 120, 4.4, 21, 1.9),
  ('Tortilla de trigo', 310, 8, 51, 8),
  ('Choclo', 96, 3.4, 21, 1.5),
  ('Banana', 89, 1.1, 23, 0.3),
  ('Manzana', 52, 0.3, 14, 0.2),
  ('Naranja', 47, 0.9, 12, 0.1),
  ('Aceite de oliva', 884, 0, 0, 100),
  ('Palta', 160, 2, 9, 15),
  ('Manteca de maní', 588, 25, 20, 50),
  ('Almendras', 579, 21, 22, 50),
  ('Nueces', 654, 15, 14, 65),
  ('Semillas de chía', 486, 17, 42, 31),
  ('Leche entera', 61, 3.2, 4.8, 3.3),
  ('Leche descremada', 34, 3.4, 5, 0.1),
  ('Queso cremoso', 300, 20, 2, 24),
  ('Brócoli', 34, 2.8, 7, 0.4),
  ('Espinaca', 23, 2.9, 3.6, 0.4),
  ('Zanahoria', 41, 0.9, 10, 0.2),
  ('Tomate', 18, 0.9, 3.9, 0.2),
  ('Lechuga', 15, 1.4, 2.9, 0.2)
on conflict (name) do nothing;

-- =========================================================================
-- 11. BORRAR ALUMNO (solo el entrenador puede sacarse alumnos de encima)
-- Borra todos los datos del alumno (rutinas, historial, medidas, fotos,
-- dieta, pagos) y por último la cuenta de auth.users, que arrastra por
-- cascade la fila de profiles.
-- =========================================================================

create or replace function public.delete_student(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_trainer_of(target_student_id)) then
    raise exception 'not authorized';
  end if;

  delete from public.diet_entries where student_id = target_student_id;
  delete from public.payments where student_id = target_student_id;
  delete from public.nutrition_plans where student_id = target_student_id;
  delete from public.meal_photos where student_id = target_student_id;
  delete from public.progress_photos where student_id = target_student_id;
  delete from public.body_measurements where student_id = target_student_id;
  delete from public.workout_logs where student_id = target_student_id;
  delete from public.routines where student_id = target_student_id;
  update public.exercises set created_by = null where created_by = target_student_id;
  update public.foods set created_by = null where created_by = target_student_id;

  delete from auth.users where id = target_student_id;
end;
$$;

revoke execute on function public.delete_student(uuid) from public, anon;
grant execute on function public.delete_student(uuid) to authenticated;

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
