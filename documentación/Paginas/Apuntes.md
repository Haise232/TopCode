# Apuntes

**Ruta real:** `src/pages/Apuntes.tsx` · **Ruta de la app:** `/apuntes`

## Qué es / qué hace

Biblioteca compartida de apuntes (PDFs e imágenes). Es la única página de datos que **sí usa su hook dedicado** sin reimplementar nada: [[useApuntes]].

Funcionalidad:
- **Subida** con drag & drop (`dragOver`) o selector de fichero, mostrando progreso (`subiendo`).
- **Búsqueda** (`busqueda`) y **filtro por tipo** (`filtroTipo: 'todos' | 'pdf' | 'imagen' | 'otro'`).
- **Vista** alternable lista/cuadrícula (`vistaLista`, iconos `LayoutGrid`/`LayoutList`).
- Agrupación de apuntes (`gruposOrdenados`, memoizado) — probablemente por autor o fecha (revisar implementación si necesitas modificar el agrupado).
- Estadísticas rápidas: total de PDFs, imágenes y usuarios distintos que han subido (`totalPdf`, `totalImg`, `totalUsuarios`, todos memoizados con `useMemo`).
- `UserAvatar`: avatar con iniciales/imagen, reutilizado en las tarjetas.
- `ApunteCard`: tarjeta individual de apunte (descarga, eliminar si es el autor o admin).

## Exporta

- `export default function Apuntes()`

## Depende de

- [[useAuth]], [[useApuntes]] (incluye el tipo `ApunteConAutor`)
- [[AlertModal]], [[Skeleton]] (`SkeletonBox`, `SkeletonCard`)
- `lucide-react` (iconos: `Upload`, `FileText`, `Image`, `Search`, `LayoutGrid`, etc.)

## Lo usan

- [[App]] — ruta protegida `/apuntes`, enlazada desde [[Layout]] (icono `FolderOpen`).

## Notas

- Es el **modelo a seguir**: junto con [[Calendar]]/[[useEventos]], demuestra la convención "página delgada + hook de datos" funcionando correctamente — útil de referencia si se decide alinear [[Actividades]] y [[Home]] con sus hooks huérfanos ([[useActividades]], [[useHomeDatos]]).
- Tamaño máximo de subida: 20 MB (validado en [[useApuntes]]); bucket de Storage: `apuntes`.

#pagina #apuntes #storage #busqueda
