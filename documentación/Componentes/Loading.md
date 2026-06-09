# Loading

**Ruta real:** `src/components/Loading.tsx`

## Qué es / qué hace

Pantalla de carga a pantalla completa, mostrada mientras `AuthContext` resuelve la sesión (`loading === true`). Combina un anillo SVG animado (`spin-smooth`), el icono `GraduationCap` en el centro y tres puntos con animación de "rebote" (`dot-bounce`) bajo el wordmark "TopCode". Las animaciones CSS se definen inline en un bloque `<style>`.

## Exporta

- `export default function Loading()` — sin props.

## Depende de

- `lucide-react` (`GraduationCap`)
- Variables CSS del tema (`--color-bg`)

## Lo usan

- [[App]] — como `fallback` de `<Suspense>` al cargar páginas lazy, y dentro de `ProtectedRoute`/`PublicRoute`/`AdminRoute` mientras `loading === true` en `AuthContext`.

## Notas

- Es la pantalla que el usuario ve durante el arranque de la app (mientras se resuelve la sesión de Supabase) — un fallo aquí significa "carga infinita" (ver bug histórico en [[../../claude-notes/Bugs|Bugs]]).

#componente #ui #carga
