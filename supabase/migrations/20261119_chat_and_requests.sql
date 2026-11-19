-- Etapa 4: chat entrenador-alumno y pedidos de cambio que el entrenador aprueba.
-- Se puede correr más de una vez sin romper nada.

-- =========================================================================
-- 1. Mensajes entre entrenador y alumno
-- =========================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_conversation_idx on public.messages (student_id, created_at desc);
create index if not exists messages_trainer_idx on public.messages (trainer_id, created_at desc);
create index if not exists messages_trainer_unread_idx on public.messages (trainer_id) where read_at is null;

alter table public.messages enable row level security;
grant select, insert on public.messages to authenticated;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (student_id = (select auth.uid()) or trainer_id = (select auth.uid()));

-- El alumno solo le escribe a su entrenador; el entrenador solo a sus alumnos.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and read_at is null
    and (
      (student_id = (select auth.uid()) and trainer_id = (select private.my_trainer_id()))
      or (trainer_id = (select auth.uid()) and (select private.is_trainer_of(student_id)))
    )
  );

-- Sin política de update/delete: marcar como leído pasa por esta función, que
-- solo toca read_at de los mensajes que recibió quien la llama.
create or replace function public.mark_messages_read(conversation_student_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages
  set read_at = now()
  where student_id = conversation_student_id
    and read_at is null
    and sender_id <> (select auth.uid())
    and (student_id = (select auth.uid()) or trainer_id = (select auth.uid()));
$$;

revoke execute on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;

-- Mensajes en vivo (Supabase Realtime), si la publicación existe.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
     ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- =========================================================================
-- 2. Pedidos de cambio (el asistente propone, el entrenador aprueba)
-- =========================================================================
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

create index if not exists adaptation_requests_student_status_idx on public.adaptation_requests (student_id, status);
create index if not exists adaptation_requests_trainer_status_idx on public.adaptation_requests (trainer_id, status);

alter table public.adaptation_requests enable row level security;
grant select, insert, update on public.adaptation_requests to authenticated;

-- Antes había una sola política "for all" que dejaba al alumno cambiar el
-- estado de su propio pedido. Ahora: el alumno crea y ve; el entrenador decide.
drop policy if exists adaptation_requests_access on public.adaptation_requests;
drop policy if exists adaptation_requests_select on public.adaptation_requests;
create policy adaptation_requests_select on public.adaptation_requests
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_trainer_of(student_id)));

drop policy if exists adaptation_requests_insert on public.adaptation_requests;
create policy adaptation_requests_insert on public.adaptation_requests
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and trainer_id = (select private.my_trainer_id())
    and status = 'pending'
    and resolved_at is null
    and parsed_action is null -- la propuesta solo la escribe el asistente (servidor)
  );

drop policy if exists adaptation_requests_update on public.adaptation_requests;
create policy adaptation_requests_update on public.adaptation_requests
  for update to authenticated
  using ((select private.is_trainer_of(student_id)))
  with check ((select private.is_trainer_of(student_id)));
