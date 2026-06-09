# useHomeDatos

**Ruta real:** `src/hooks/useHomeDatos.ts`

## Qué es / qué hace

Hook agregador para el **dashboard (Home)**: combina en una sola carga (`Promise.all`) los datos de varias tablas que la página necesita mostrar de un vistazo:

1. Todas las notas del usuario (`notas`) → `allNotas`, de las que se derivan las 5 más recientes (`notasRecientes`, `slice(0,5)` en cliente — evita una segunda query).
2. El próximo evento futuro (`eventos`, `gte fecha = hoy`, `limit(1)`).
3. Actividades pendientes futuras (`actividades`, `gte fecha_entrega = ahora`, `limit(50)`) cruzadas con `actividades_estado` del usuario para calcular `proximaActividad` y `actividadesPendientes`.

Tiene caché TTL de 30 s, igual patrón `mountedRef`/`AbortController` que el resto de hooks de datos.

## Exporta

- `export function useHomeDatos(usuarioId: string | undefined): UseHomeDatosReturn`

### Devuelve (`UseHomeDatosReturn`)
- `notasRecientes`, `allNotas`, `proximoEvento`, `proximaActividad`, `actividadesPendientes`
- `loading`, `error`, `init()`, `refresh()`

## Depende de

- [[lib-supabase]] (`supabase`)
- [[lib-types]] (`Nota`, `EventoCalendario`, `Actividad`)

## Lo usan

- **Nadie actualmente** (`grep -rl "useHomeDatos" src/pages src/components` no encuentra consumidores). [[Home]] **no** usa este hook: implementa su propia carga (función `cargarDatos`) apoyada directamente en [[lib-cache]] (`cacheGet`/`cacheSet`/`cacheInvalidatePrefix` con claves `home:*`), no en el `cacheRef` interno de este hook.

## Notas

- ⚠️ **Hook huérfano / posible refactor a medias:** este hook agrega exactamente los datos que [[Home]] necesita (notas recientes, próximo evento, próxima actividad, pendientes), pero la página tiene su propia implementación paralela usando [[lib-cache]]. Es probable que uno de los dos sea código legado tras una refactorización — confirma con el historial git (`git log -- src/hooks/useHomeDatos.ts`) cuál es la versión vigente antes de modificar la lógica de carga del dashboard.
- El cálculo de "actividades pendientes" se hace completamente en cliente, comparando IDs contra un `Set` de `actividad_id` ya completados — mismo patrón que usa [[Home]] en su versión inline.

#hook-huerfano

#hook #datos #home #dashboard #cache
