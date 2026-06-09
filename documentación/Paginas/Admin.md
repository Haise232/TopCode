# Admin

**Ruta real:** `src/pages/Admin.tsx` · **Ruta de la app:** `/admin` (solo `rol === 'admin'`)

## Qué es / qué hace

Panel de administración con dos bloques principales:

1. **Gestión de roles de usuario**: lista todos los usuarios (`users: Usuario[]`), permite alternar entre `alumno` ↔ `admin` (`updating` controla el spinner por fila). Muestra estadísticas (`AdminSkeleton` durante la carga).
2. **Gestión de anuncios** (`anuncios`): formulario para publicar nuevos comunicados (`handlePublicar`), listado de los últimos 10 (`cargarAnuncios`), capacidad de activar/desactivar (`handleToggleActivo`) y eliminar (`handleEliminarAnuncio`, con confirmación vía `AlertModal`).

Las operaciones de red (publicar/activar anuncio) usan `Promise.race` con un timeout manual de 30 segundos para evitar quedarse colgado indefinidamente si Supabase no responde.

## Exporta

- `export default function Admin()`

## Depende de

- [[useAuth]]
- [[lib-supabase]] (`supabase`, llamadas directas a `usuarios` y `anuncios`)
- [[lib-types]] (`Usuario`, `Anuncio`)
- [[AlertModal]], [[Skeleton]] (`SkeletonBox`, `SkeletonCard`)
- `react-router-dom` (`useNavigate`)

## Lo usan

- [[App]] — ruta protegida y además envuelta en `AdminRoute` (verifica `usuario.rol === 'admin'`, redirige a `/` si no), enlazada desde [[Layout]] (solo visible para administradores, icono `Shield`).

## Notas

- Esta es la única página que puede **crear/editar/desactivar anuncios** — los anuncios activos se muestran después a todo el alumnado vía [[AnuncioModal]].
- El control de acceso real está en RLS (`usuarios_update_admin`, `anuncios_*_admin` — ver [[../Base-de-datos/supabase-setup|supabase-setup]]); `AdminRoute` en [[App]] es solo una capa de UX, no de seguridad.

#pagina #admin #anuncios #roles
