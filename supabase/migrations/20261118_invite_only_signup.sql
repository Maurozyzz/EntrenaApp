-- Registro solo por invitación + consulta de último entrenamiento.
-- Para un proyecto que ya está andando: pegar este archivo en el SQL Editor de Supabase y correrlo.
-- Reemplaza la versión de handle_new_user() que decidía el entrenador por email.

-- =========================================================================
-- INVITACIONES: solo se registra quien tiene un código del entrenador
-- =========================================================================

create table if not exists public.trainer_invites (
  code text primary key default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

create index if not exists trainer_invites_trainer_id_idx on public.trainer_invites (trainer_id);

alter table public.trainer_invites enable row level security;

-- El entrenador crea, ve y borra sus propias invitaciones. Nadie más las ve:
-- el canje lo hace handle_new_user() (security definer) al registrarse.
drop policy if exists "trainer_invites_select" on public.trainer_invites;
create policy "trainer_invites_select" on public.trainer_invites
  for select to authenticated
  using (trainer_id = (select auth.uid()));

drop policy if exists "trainer_invites_insert" on public.trainer_invites;
create policy "trainer_invites_insert" on public.trainer_invites
  for insert to authenticated
  with check (trainer_id = (select auth.uid()) and (select private.is_trainer()));

drop policy if exists "trainer_invites_delete" on public.trainer_invites;
create policy "trainer_invites_delete" on public.trainer_invites
  for delete to authenticated
  using (trainer_id = (select auth.uid()));

-- Alta de usuarios. El rol nunca lo elige el cliente:
--  * Si todavía no hay ningún entrenador, la primera cuenta queda como
--    'trainer' (arranque de un proyecto nuevo).
--  * Si no, hace falta un código de invitación vigente y sin usar
--    (options.data.invite_code en el signUp). El alumno queda vinculado al
--    entrenador que creó la invitación. Sin código válido, el registro falla.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trainer_id uuid;
  v_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_name text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
begin
  if not exists (select 1 from public.profiles where role = 'trainer') then
    insert into public.profiles (id, role, trainer_id, full_name, email)
    values (new.id, 'trainer', null, v_name, new.email);
    return new;
  end if;

  update public.trainer_invites
     set used_by = new.id, used_at = now()
   where code = v_code
     and used_by is null
     and expires_at > now()
  returning trainer_id into v_trainer_id;

  if v_trainer_id is null then
    raise exception 'invite_required' using hint = 'Hace falta un código de invitación válido de tu entrenador.';
  end if;

  insert into public.profiles (id, role, trainer_id, full_name, email)
  values (new.id, 'student', v_trainer_id, v_name, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- ÚLTIMO ENTRENAMIENTO POR ALUMNO
-- Reemplaza bajar todo workout_logs para calcular "días sin entrenar".
-- security invoker: respeta RLS, así cada entrenador ve solo a sus alumnos.
-- =========================================================================

create or replace function public.last_workout_by_student(student_ids uuid[])
returns table (student_id uuid, last_performed_at timestamptz)
language sql
security invoker
set search_path = ''
stable
as $$
  select w.student_id, max(w.performed_at)
    from public.workout_logs w
   where w.student_id = any (student_ids)
   group by w.student_id;
$$;

revoke execute on function public.last_workout_by_student(uuid[]) from public, anon;
grant execute on function public.last_workout_by_student(uuid[]) to authenticated;

create index if not exists workout_logs_student_performed_idx
  on public.workout_logs (student_id, performed_at desc);
