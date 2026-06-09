# useActividades

**Ruta real:** `src/hooks/useActividades.ts`

## Qué es / qué hace

Hook de datos para el módulo de **Actividades** (tareas/entregas). Centraliza:

- Carga de actividades (`tabla actividades`) y del estado de completado por usuario (`actividades_estado`).
- Estadísticas para administradores (`adminStats`: cuántos alumnos completaron cada actividad y total de alumnos).
- Borrado automático de actividades vencidas al cargar (`delete ... where fecha_entrega < now()`).
- Caché en memoria con TTL de 30 s (`CACHE_TTL_MS`, vía `cacheRef`), igual que [[useNotas]].
- Operaciones **optimistas**: crear, borrar y marcar/desmarcar como completada, todas actualizan el estado local antes de confirmar con el servidor y revierten si falla.

## Exporta

- `export function useActividades({ usuarioId, isAdmin }): UseActividadesReturn`

### Devuelve (`UseActividadesReturn`)
- `actividades: Actividad[]`
- `estados: Record<string, boolean>` — mapa `actividad_id → completada` para el usuario actual
- `adminStats: { counts: Record<string, number>; totalAlumnos: number }`
- `loading`, `error`
- `init()`, `refresh()`
- `createActividadOptimistic(act)`, `deleteActividadOptimistic(id)`, `toggleEstado(actId, current)`

## Depende de

- [[lib-supabase]] (`supabase`)
- [[lib-types]] (`Actividad`)

## Lo usan

- **Nadie actualmente** (`grep -rl "useActividades" src/pages src/components` no encuentra consumidores). [[Actividades]] implementa su propia carga de datos inline (función `cargar` con `useCallback` + `supabase.from(...)`) en lugar de usar este hook — duplica buena parte de esta lógica (incluido el cálculo de `adminStats`).
- Antes de tocar uno de los dos, decide cuál es la fuente de verdad: lo más probable es que este hook sea una refactorización pendiente de aplicar a [[Actividades]] (o código legado que sustituyó la lógica inline). Vale la pena confirmarlo con el autor/historial git antes de eliminar nada.

## Notas

- `toggleEstado` usa `upsert` con `onConflict: 'actividad_id,usuario_id'` sobre `actividades_estado`, que tiene clave compuesta.
- Las queries usan `AbortController`/`abortSignal` y un `mountedRef` para evitar `setState` tras desmontar.

#hook #datos #actividades #optimistic-updates #cache
