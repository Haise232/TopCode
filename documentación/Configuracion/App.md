# App

**Ruta real:** `src/App.tsx`

## Qué es / qué hace

Componente raíz que define el **árbol de providers y el sistema de rutas** (React Router v6), todas las páginas son `lazy()`-loaded y envueltas en `<Suspense fallback={<Loading />}>`.

### Guards de ruta
| Guard | Condición | Comportamiento |
|---|---|---|
| `ProtectedRoute` | requiere `session` | si no hay sesión → redirige a `/login`; envuelve en [[../Componentes/Layout\|Layout]] |
| `PublicRoute` | requiere **no** tener `session` | si hay sesión → redirige a `/` (usado en `/login`, `/register`) |
| `AdminRoute` | requiere `usuario.rol === 'admin'` | si no es admin → redirige a `/` |

### Mapa de rutas
`/login`, `/register` (públicas) · `/`, `/news`, `/chat`, `/apuntes`, `/calendar`, `/actividades`, `/profile` (protegidas) · `/admin` (protegida + admin) · `*` → redirige a `/`.

## Exporta

- `export default function App()`

## Depende de

- [[../Lib-y-Contexts/AuthContext|AuthContext]] (`AuthProvider`, `useAuth`)
- [[../Lib-y-Contexts/ThemeContext|ThemeContext]] (`ThemeProvider`)
- [[../Componentes/Layout|Layout]], [[../Componentes/Loading|Loading]]
- Todas las páginas en `src/pages/` (vía `lazy(() => import(...))`)
- `react-router-dom` (`Routes`, `Route`, `Navigate`, `useLocation`)

## Lo usan

- [[main]] — montado dentro de `<BrowserRouter>`.

## Notas

- **Fichero crítico** de routing — ver [[../../claude-notes/Claude-Contexto|Claude-Contexto]].
- El control de acceso real de administración vive en RLS (ver [[../Base-de-datos/supabase-setup|supabase-setup]]); `AdminRoute` es solo una capa de UX para evitar mostrar la página a quien no debería verla.
- El orden de providers importa: `ThemeProvider` envuelve a `AuthProvider`.

#configuracion #routing #critico
