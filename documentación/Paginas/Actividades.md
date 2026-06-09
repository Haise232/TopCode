# Actividades

**Ruta real:** `src/pages/Actividades.tsx` · **Ruta de la app:** `/actividades`

## Qué es / qué hace

Listado y seguimiento de **actividades/tareas académicas**, con marcado de "completada" por alumno. Funciones puras de cabecera:

- `calcUrgencia(fechaEntrega, completada)` → `'completada' | 'vencida' | 'hoy' | 'pronto' | 'normal'`, con su tabla de estilos `URGENCIA_STYLE` (color/fondo/borde/etiqueta).
- `countdown(fechaEntrega)` → texto legible ("Venció hace 2d", "Mañana", "En 5 días"…).
- `formatFechaEntrega`, `materiaColor` (color HSL determinista por nombre de asignatura).

Carga datos con su propia función `cargar` (NO usa el hook [[useActividades]] — ver nota ⚠️ abajo), que trae `actividades`, `actividades_estado` del usuario, y para administradores también estadísticas (`statsAdmin`, `totalAlumnos`).

Componentes internos: `ActividadesSkeleton` (estado de carga) y `ActividadRow` (fila expandible de cada actividad, con checkbox de completado y barra de progreso para admins).

Filtros disponibles: `'todas' | 'pendientes' | 'completadas'` (estado `filtro`).

Los administradores pueden crear (`modalVisible` + formulario con `MATERIAS`) y borrar actividades.

## Exporta

- `export default function Actividades()`

## Depende de

- [[useAuth]]
- [[lib-supabase]] (`supabase`, llamadas directas — no pasa por `useActividades`)
- [[lib-types]] (`Actividad`)
- [[constants-materias]] (`MATERIAS`)
- [[AlertModal]], [[Skeleton]] (`SkeletonBox`, `SkeletonCard`)

## Lo usan

- [[App]] — ruta protegida `/actividades`, enlazada desde [[Layout]] (icono `ClipboardCheck`, etiqueta "Actividades").

## Notas

- ⚠️ **Duplicación con [[useActividades]]:** esta página reimplementa toda la lógica de carga/optimistic updates que ya ofrece el hook `useActividades` (incluido el cálculo de `adminStats`). Si vas a tocar la lógica de datos de Actividades, decide primero si conviene migrar la página al hook o si el hook debería eliminarse — confirma con el historial git.
- Tabla relacionada: `actividades` + `actividades_estado` (clave compuesta `actividad_id, usuario_id`).

#pagina #actividades #admin
