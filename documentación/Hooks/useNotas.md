# useNotas

**Ruta real:** `src/hooks/useNotas.ts`

## Qué es / qué hace

Hook de datos para el módulo de **calificaciones** (tabla `notas`). Es el hook "de referencia" del proyecto — el resto de hooks de datos (`useActividades`, `useEventos`, `useApuntes`, `useHomeDatos`) replican su mismo patrón:

- Carga las notas del usuario (`eq('usuario_id', usuarioId)`), con **caché en memoria con TTL de 30 s** (`cacheRef`, evita refetch al navegar entre pestañas).
- `mountedRef` + `AbortController` para evitar `setState` tras desmontar / cancelar peticiones en curso.
- `addNotaOptimistic` / `deleteNotaOptimistic`: insertan/eliminan en el estado local de inmediato (con `id` temporal `temp-{timestamp}`), confirman contra el servidor y revierten si falla.
- Tras cualquier alta o baja, llama a `actualizarPromedio(usuario_id)` (de [[lib-supabase]]) para recalcular el promedio global del alumno vía RPC.

## Exporta

- `export function useNotas({ usuarioId }: UseNotasOptions): UseNotasReturn`

### Devuelve (`UseNotasReturn`)
- `notas: Nota[]`
- `loading`, `error`
- `init()`, `refresh()`
- `addNotaOptimistic(nota)`, `deleteNotaOptimistic(id)`

## Depende de

- [[lib-supabase]] (`supabase`, `actualizarPromedio`)
- [[lib-types]] (`Nota`)

## Lo usan

- **Ningún componente lo importa actualmente** (`grep -rl "useNotas" src/` no devuelve consumidores fuera del propio fichero). La página standalone de notas (`Notes.tsx`) fue eliminada — ver [[../../claude-notes/Funcionalidades|Funcionalidades]] y [[../../claude-notes/Decisiones|Decisiones]]. La funcionalidad de "ver notas" hoy vive en [[Home]] a través de [[useHomeDatos]] (que consulta la tabla `notas` directamente, sin pasar por este hook).
- Antes de eliminarlo, confirma que de verdad no se usa en ningún flujo de creación/edición de notas (p. ej. en [[Profile]] o algún modal) — el CRUD optimista que ofrece (`addNotaOptimistic`, `deleteNotaOptimistic`) sugiere que en algún momento alimentó una pantalla de edición de notas.

## Depende de (RPC)

- `recalcular_promedio(p_usuario_id)` — función SQL `SECURITY DEFINER` (ver [[../Base-de-datos/supabase-setup|supabase-setup]]).

## Notas

- Es el hook más comentado del código fuente — útil como plantilla si necesitas crear un nuevo hook de datos siguiendo la misma convención (caché + optimistic updates + abort).

#hook #datos #notas #optimistic-updates #cache
