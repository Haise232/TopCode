# Layout

**Ruta real:** `src/components/Layout.tsx`

## Qué es / qué hace

Shell de navegación de toda la aplicación autenticada. Renderiza:

- **Navbar superior** (desktop): logo, enlaces de navegación (`NAV_ITEMS`) y acceso al perfil.
- **Barra inferior** (móvil, `md:hidden`): mismos enlaces en formato de iconos + etiqueta.
- Inserta `AnuncioModal` y `PrivateMessageToast` una única vez para que estén disponibles en cualquier ruta protegida.

El elemento "Admin" (`ADMIN_ITEM`) solo se añade a la lista de navegación si `usuario.rol === 'admin'`.

### Prefetch de rutas

Mantiene un mapa `ROUTE_PREFETCH: Record<string, () => Promise<unknown>>` que asocia cada ruta con su `import()` dinámico. La función `schedulePrefetch(to)` lanza ese import con un debounce de 100 ms al pasar el ratón (o al hacer `touchstart` en móvil) sobre el enlace, para que el chunk de la página esté listo antes de que el usuario haga click — reduce el tiempo de navegación percibido.

## Exporta

- `export default function Layout({ children }: { children: React.ReactNode })`

## Depende de

- [[useAuth]]
- [[AnuncioModal]], [[PrivateMessageToast]]
- `react-router-dom` (`NavLink`)
- `lucide-react` (iconos de navegación)

## Lo usan

- [[App]] — se aplica dentro de `ProtectedRoute`, envolviendo todas las páginas autenticadas (Home, News, Chat, Apuntes, Actividades, Calendar, Admin, Profile).

## Notas

- El logo usa `/logo.svg` (en `public/`) con un `GraduationCap` de `lucide-react` como fallback si la imagen no carga.
- El indicador "online" (punto verde) bajo el avatar es estático/decorativo, no refleja presencia real.

#componente #navegacion #layout
