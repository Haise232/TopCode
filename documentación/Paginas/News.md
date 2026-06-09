# News

**Ruta real:** `src/pages/News.tsx` · **Ruta de la app:** `/news`

## Qué es / qué hace

Listado de **noticias/anuncios del centro** (tabla `noticias` — distinta de `anuncios`, que son los comunicados modales gestionados en [[Admin]]/[[AnuncioModal]]). Cada noticia tiene `titulo`, `descripcion`, `url_fuente` (enlace externo) y `url_imagen` opcional.

Componentes internos:
- `NewsSkeleton`: estado de carga.
- `NewsCard`: tarjeta de noticia, con manejo de error de imagen (`imgError`).
- `ImagePreview`: vista previa de imagen en el formulario de creación/edición, con manejo de error (`errored`, reseteado al cambiar `url`).

Los administradores pueden **crear, editar y eliminar** noticias (`editingItem` controla si el modal está en modo creación o edición; `formError` valida campos del formulario). La carga (`cargarNews`) usa `mountedRef` para evitar actualizar estado tras desmontar.

## Exporta

- `export default function News()`

## Depende de

- [[useAuth]]
- [[lib-supabase]] (`supabase`, llamadas directas a `noticias`)
- [[AlertModal]]
- `react-dom` (`createPortal` — modal de creación/edición)

## Lo usan

- [[App]] — ruta protegida `/news`, enlazada desde [[Layout]] (icono `Newspaper`, etiqueta "News").

## Notas

- ⚠️ No confundir con **anuncios** (`anuncios`, gestionados en [[Admin]] y mostrados vía [[AnuncioModal]] como modal obligatorio): `noticias` son tarjetas de listado con enlace externo, mientras que `anuncios` son comunicados que el alumno debe marcar como leídos.
- Esta sección se renombró de "Anuncios" a "News" (commit `6411993` — ver [[../../claude-notes/Decisiones|Decisiones]]).
- Tipo `NewsItem` definido localmente en el fichero (revisar si coincide con `Noticia` de [[lib-types]] antes de unificarlos).

#pagina #news #noticias #admin
