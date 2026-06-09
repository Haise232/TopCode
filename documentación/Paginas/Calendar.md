# Calendar

**Ruta real:** `src/pages/Calendar.tsx` · **Ruta de la app:** `/calendar`

## Qué es / qué hace

La página más extensa del proyecto (~1000 líneas). Calendario de **eventos académicos** con:

- `MiniCalendario`: vista de mes navegable (`viewDate`, `handlePrevMonth`/`handleNextMonth`) con resaltado de días con eventos.
- Listado de eventos próximos y pasados (`pastExpanded` para desplegar el historial).
- `EventCard`, `StatChip`, `SectionLabel`, `EmptyState`, `CalendarSkeleton`: componentes internos de presentación.
- Formulario de creación de evento (solo admins): `titulo`, `descripcion`, `materia` (de `MATERIAS`), `fecha`.
- `diaHighlight`: resalta temporalmente un día al hacer click sobre un evento desde el listado.

A diferencia de [[Actividades]] y [[Home]], **sí usa el hook de datos correspondiente**: [[useEventos]] (`eventos`, `loading`, `error`, `init`, `refresh`, `createEvento`, `deleteEvento`).

## Exporta

- `export default function CalendarPage()`

## Depende de

- [[useAuth]], [[useEventos]]
- [[lib-types]] (`EventoCalendario`)
- [[constants-materias]] (`MATERIAS`)
- [[AlertModal]], [[Skeleton]] (`SkeletonBox`, `SkeletonCard`)
- `react-dom` (`createPortal` — para el modal de creación de evento)

## Lo usan

- [[App]] — ruta protegida `/calendar`, enlazada desde [[Layout]] (icono `Calendar`, etiqueta "Eventos").

## Notas

- Es un buen ejemplo de página que **sí** sigue la convención "un hook por dominio" — útil como referencia si decides migrar [[Actividades]] o [[Home]] a sus respectivos hooks ([[useActividades]], [[useHomeDatos]]).
- Solo los administradores pueden crear/borrar eventos (controlado tanto en UI como por RLS — `eventos_insert_admin`/`eventos_delete_admin`).

#pagina #calendario #eventos #admin
