# useEventos

**Ruta real:** `src/hooks/useEventos.ts`

## Qué es / qué hace

Hook de datos para el **calendario de eventos académicos** (tabla `eventos`). Misma estructura que [[useNotas]] / [[useActividades]]:

- Carga con caché TTL de **60 s** (`CACHE_TTL_MS = 60_000` — más larga que otros hooks porque "los eventos cambian con menos frecuencia").
- `createEvento` / `deleteEvento` con **actualizaciones optimistas** (insertar/quitar del estado local antes de confirmar, revertir si el servidor falla) y reordenación por `fecha` tras cada cambio.
- Limita la consulta a `limit(200)`.

## Exporta

- `export function useEventos(): UseEventosReturn`

### Devuelve (`UseEventosReturn`)
- `eventos: EventoCalendario[]`
- `loading`, `error`
- `init()`, `refresh()`
- `createEvento(ev)`, `deleteEvento(id)`

## Depende de

- [[lib-supabase]] (`supabase`)
- [[lib-types]] (`EventoCalendario`)

## Lo usan

- [[Calendar]] (página principal)
- [[Home]] — indirectamente, vía [[useHomeDatos]] (consulta el "próximo evento")

## Notas

- Solo administradores pueden crear/borrar eventos (controlado por RLS — ver políticas `eventos_insert_admin` / `eventos_delete_admin` en [[../Base-de-datos/supabase-setup|supabase-setup]]).

#hook #datos #calendario #optimistic-updates #cache
