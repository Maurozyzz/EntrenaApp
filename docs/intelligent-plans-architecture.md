# Arquitectura de planes inteligentes

## Estado

La aplicación conserva las tablas actuales (`routines`, `nutrition_plans`, `diet_entries` y `workout_logs`). La migración `supabase/migrations/20260913_intelligent_plans.sql` agrega un modelo versionado sin cambiar todavía el flujo existente.

## Núcleo agregado

- `training_plan_versions`: versiones draft, active y archived de una rutina.
- `training_plan_days`: días y duración de cada versión.
- `training_plan_exercises`: prescripción estructurada, RIR, tempo, carga y motivo de selección.
- `nutrition_plan_versions`: versiones de objetivos nutricionales.
- `nutrition_plan_meals`: comidas y horarios.
- `nutrition_plan_items`: alimentos, cantidades y alternativas.
- `plan_feedback`: dificultad, energía, dolor, adherencia y comentarios.
- `adaptation_requests`: solicitudes del alumno pendientes de revisión o aplicación.
- `student_memory`: preferencias y restricciones persistentes con origen y confianza.

## Flujo previsto

```text
Alumno solicita o registra feedback
  -> adaptation_requests / plan_feedback
  -> motor de reglas valida perfil, lesiones y permisos
  -> planificador crea una nueva versión draft
  -> entrenador revisa
  -> versión active; anterior archived
```

La IA, cuando se integre, interpretará lenguaje natural y producirá acciones estructuradas. No tendrá acceso directo a SQL ni podrá activar planes sin pasar por validación y permisos server-side.

## Próximo módulo

Crear servicios de aplicación para:

1. Crear una versión draft a partir del perfil actual.
2. Activar una versión dentro de una operación transaccional.
3. Registrar feedback del alumno.
4. Aplicar cambios parciales sin reconstruir todo el plan.
5. Migrar gradualmente `AutoPlanBuilder` al nuevo modelo.

La integración de IA y el chat quedan deliberadamente después de estas reglas y servicios.
