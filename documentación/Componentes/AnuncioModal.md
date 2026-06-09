# AnuncioModal

**Ruta real:** `src/components/AnuncioModal.tsx`

## Qué es / qué hace

Modal de "comunicado" que se muestra automáticamente al usuario autenticado cuando hay un anuncio activo (`anuncios.activo = true`) que aún no ha leído. No se puede cerrar haciendo click fuera ni con `Escape` — solo pulsando "He leído el mensaje", lo que lo marca como leído.

El estado de lectura se guarda en `localStorage` con la clave `topcode-anuncio-leido-{userId}-{anuncioId}` (funciones internas `leyoAnuncio` / `marcarLeido`), de modo que cada usuario tiene su propio registro de qué anuncios ya vio, sin tocar la base de datos.

Se suscribe al canal Realtime `anuncios-realtime` (tabla `anuncios`) para recargar el anuncio activo en cuanto se publica uno nuevo, sin necesidad de refrescar la página.

## Exporta

- `export default function AnuncioModal()` — no recibe props, usa `useAuth()` internamente.

## Depende de

- [[useAuth]] (de `hooks/useAuth` → `contexts/AuthContext`)
- [[lib-supabase]] (`supabase`, canal realtime `postgres_changes`)
- [[lib-types]] (`Anuncio`)
- `react-dom` (`createPortal`), `lucide-react` (`Megaphone`, `CheckCheck`)

## Lo usan

- [[Layout]] — se monta una sola vez dentro del shell de navegación, visible en todas las rutas protegidas.

## Notas

- Tabla relacionada: `anuncios` (ver [[../Base-de-datos/supabase-setup|supabase-setup]]).
- Solo los administradores pueden crear/editar/activar anuncios — eso ocurre en [[../Paginas/Admin|Admin]].
- Limita la consulta a `limit(1)` ordenando por `created_at desc`: solo muestra el anuncio activo más reciente.

#componente #realtime #anuncios
