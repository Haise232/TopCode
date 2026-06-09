# useMensajes

**Ruta real:** `src/hooks/useMensajes.ts`

## Qué es / qué hace

Fichero con **dos hooks de chat en tiempo real**, ambos basados en Supabase Realtime (`postgres_changes`):

### `usePublicMensajes()`
Chat público (sala general, tabla `mensajes`):
- Carga los últimos 100 mensajes + mapa de avatares de todos los usuarios (`usuarios.avatar_url`).
- Se suscribe al canal `public-chat`, añadiendo cualquier `INSERT` nuevo al estado en vivo.
- `enviar(texto, usuarioId, autor)` inserta directamente (no usa optimistic update — el propio mensaje vuelve por el canal realtime).
- No usa caché (`PUBLIC_CACHE_TTL_MS = 0`, constante presente solo para documentar la decisión).

### `usePrivateMensajes({ meId, peerId })`
Chat privado 1-a-1 (tabla `mensajes_privados`):
- Carga el historial entre ambos usuarios con un filtro `.or(and(de_id=meId,para_id=peerId), and(de_id=peerId,para_id=meId))`, máx. 200 mensajes.
- Canal con nombre determinista `private-{ids ordenados y unidos por '-'}`, filtrando solo `INSERT` donde `para_id = meId` (los mensajes propios no llegan por el canal — el filtro de servidor los excluye).
- `enviar(texto, deNombre)` añade el mensaje **de forma optimista** al estado local (con un `id` temporal `tmp-{timestamp}`) y luego lo inserta en la base de datos.

## Exporta

- `export function usePublicMensajes(): UsePublicMensajesReturn`
- `export function usePrivateMensajes(opts: UsePrivateMensajesOptions): UsePrivateMensajesReturn`

## Depende de

- [[lib-supabase]] (`supabase`, canales realtime)
- [[lib-types]] (`Mensaje`, `MensajePrivado`)

## Lo usan

- [[Chat]] — usa ambos hooks: `usePublicMensajes` en `PublicChat` y `usePrivateMensajes` en `PrivateChat`.

## Notas

- Tablas relacionadas: `mensajes` (chat público) y `mensajes_privados` (chat 1-a-1) — ver políticas RLS en [[../Base-de-datos/supabase-setup|supabase-setup]].
- El nombre del canal privado se ordena alfabéticamente (`[meId, peerId].sort().join('-')`) para que ambos participantes se suscriban al **mismo** canal independientemente de quién lo abra primero.

#hook #datos #chat #realtime #optimistic-updates
