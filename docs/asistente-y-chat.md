# Chat y asistente de rutina (etapa 4)

## 1. Base de datos

En Supabase: **SQL Editor → New query**, pegar el contenido de
`supabase/migrations/20261119_chat_and_requests.sql` y tocar **Run**.
Se puede correr más de una vez. Crea:

- `messages`: chat entre entrenador y alumno (cada alumno solo habla con su entrenador).
- `adaptation_requests` (si no existía) con permisos nuevos: el alumno crea y ve sus
  pedidos; solo el entrenador los aprueba o rechaza.

Sin este paso la app sigue andando: el chat y los pedidos muestran un aviso de que no están activados.

## 2. Asistente con IA (opcional)

El alumno puede escribir "me molesta el hombro en el press militar" y el asistente
propone cambios sobre su rutina real. **Nada se aplica solo**: el pedido queda
pendiente en la pestaña **Pedidos** de la ficha del alumno hasta que el entrenador
lo aprueba.

Sin el asistente publicado, el pedido igual le llega al entrenador, sin propuesta.

Para publicarlo:

1. Supabase → **Edge Functions** → **Secrets**: agregar `ANTHROPIC_API_KEY` con una
   clave de https://console.anthropic.com.
2. Publicar la función `routine-assistant`:
   - Con la CLI: `supabase functions deploy routine-assistant`
   - O desde el panel: **Edge Functions → Deploy a new function → Via editor**,
     nombre `routine-assistant`, pegar `supabase/functions/routine-assistant/index.ts`
     (es autocontenida) y **Deploy**.

Límite: 10 pedidos por alumno cada 24 horas, para cuidar el costo de la IA.
