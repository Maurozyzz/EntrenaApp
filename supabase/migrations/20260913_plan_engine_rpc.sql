-- Motor de cambios: activación transaccional de versiones de plan.
-- Archiva la versión activa anterior y activa la nueva en una sola operación,
-- para que nunca quede un alumno sin versión activa o con dos activas a la vez.
-- Sin security definer: corre con los permisos del que llama, así las RLS
-- existentes (trainer_id = auth.uid()) siguen siendo las que autorizan.

create or replace function public.activate_training_plan_version(target_version_id uuid)
returns void
language plpgsql
as $$
declare
  v_student_id uuid;
begin
  select student_id into v_student_id
  from public.training_plan_versions
  where id = target_version_id;

  if v_student_id is null then
    raise exception 'training plan version not found';
  end if;

  update public.training_plan_versions
  set status = 'archived'
  where student_id = v_student_id
    and status = 'active'
    and id <> target_version_id;

  update public.training_plan_versions
  set status = 'active', activated_at = now()
  where id = target_version_id;
end;
$$;

revoke execute on function public.activate_training_plan_version(uuid) from public, anon;
grant execute on function public.activate_training_plan_version(uuid) to authenticated;

create or replace function public.activate_nutrition_plan_version(target_version_id uuid)
returns void
language plpgsql
as $$
declare
  v_student_id uuid;
begin
  select student_id into v_student_id
  from public.nutrition_plan_versions
  where id = target_version_id;

  if v_student_id is null then
    raise exception 'nutrition plan version not found';
  end if;

  update public.nutrition_plan_versions
  set status = 'archived'
  where student_id = v_student_id
    and status = 'active'
    and id <> target_version_id;

  update public.nutrition_plan_versions
  set status = 'active', activated_at = now()
  where id = target_version_id;
end;
$$;

revoke execute on function public.activate_nutrition_plan_version(uuid) from public, anon;
grant execute on function public.activate_nutrition_plan_version(uuid) to authenticated;

notify pgrst, 'reload schema';
