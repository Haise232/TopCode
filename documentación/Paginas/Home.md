# Home

**Ruta real:** `src/pages/Home.tsx` · **Ruta de la app:** `/`

## Qué es / qué hace

Dashboard principal mostrado al iniciar sesión. Muestra de un vistazo:

- Próximo evento (`proximoEvento`) y próxima actividad (`proximaActividad`), contador de actividades pendientes (`actividadesPendientes`).
- Banner de portada personalizable (`bannerUrl`, `uploadingBanner` — sube/borra imagen de Storage vía `eliminarArchivoStorage`).
- Widgets de horario (`SkeletonSchedule`) y accesos rápidos (`SkeletonQuickActions`) mientras carga.
- `HomeSkeleton`: pantalla de carga compuesta combinando varios skeletons.

Carga datos con su propia función `cargarDatos` (NO usa el hook [[useHomeDatos]] — ver nota ⚠️ abajo), apoyándose directamente en [[lib-cache]] (`cacheGet`/`cacheSet`/`cacheInvalidatePrefix`, claves con prefijo `home:`) para evitar refetch al navegar de vuelta.

## Exporta

- `export default function Home()`

## Depende de

- [[useAuth]] (incluye `loading: authLoading`, `refreshUsuario`)
- [[lib-supabase]] (`supabase`, `eliminarArchivoStorage`)
- [[lib-types]] (`EventoCalendario`, `Actividad`)
- [[Skeleton]] (`SkeletonBox`, `SkeletonCard`, `SkeletonSchedule`, `SkeletonQuickActions`)
- [[lib-cache]] (`cacheGet`, `cacheSet`, `cacheInvalidatePrefix`)
- `react-router-dom` (`useNavigate`)

## Lo usan

- [[App]] — ruta protegida `/` (raíz), primera pantalla tras el login. Enlazada desde [[Layout]] (icono `Home`, etiqueta "Inicio").

## Notas

- ⚠️ **Duplicación con [[useHomeDatos]]:** este hook agrega exactamente los mismos datos que `cargarDatos` calcula aquí manualmente, pero usando un `cacheRef` interno en lugar de [[lib-cache]]. Antes de modificar la lógica de carga del dashboard, decide si conviene migrar la página al hook (eliminando la duplicación) o eliminar el hook huérfano.
- Históricamente sufrió el bug del "flash de Estudiante" (mostrar el rol incorrecto antes de cargar el perfil real) — resuelto con skeletons y esperando a que `AuthContext` esté listo (`authLoading`). Ver [[../../claude-notes/Bugs|Bugs]].

#pagina #home #dashboard #cache
