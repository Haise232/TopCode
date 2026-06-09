# AuthContext

**Ruta real:** `src/contexts/AuthContext.tsx`

## Qué es / qué hace

Contexto global de **autenticación y perfil de usuario** — el estado más crítico de la app. Gestiona:

- `session` / `user`: estado de sesión de Supabase Auth, vía `supabase.auth.onAuthStateChange` (única fuente de verdad — sustituyó a `getSession()` para evitar race conditions).
- `usuario: Usuario | null`: perfil enriquecido (incluye `email` y `es_superadmin`, normalmente vetados por RLS) obtenido vía RPC `get_mi_perfil()` (función `SECURITY DEFINER`).
- **Caché en `sessionStorage`** (`getCachedUsuario`/`setCachedUsuario`, clave `topcode-usuario-cache`): sirve el perfil cacheado de inmediato al montar para eliminar el parpadeo de carga.
- **Timeout de seguridad** (`AUTH_TIMEOUT_MS = 8000`): si Supabase no responde en 8s, libera `loading` igualmente (proyecto pausado, red caída, env vars incorrectas).
- **`fetchUsuario`**: lógica robusta con reintentos — si el perfil no existe (usuario nuevo), hace `upsert` en `usuarios`; si el RPC falla transitoriamente, reintenta una vez. Usa `fetchCountRef` para descartar respuestas obsoletas si se llama dos veces concurrentemente (race condition).
- `refreshUsuario()`: recarga el perfil bajo demanda (usado tras editar nombre/avatar en [[Profile]]).

## Exporta

- `export const AuthContext`
- `export function AuthProvider({ children })`
- `export function useAuth()` → `{ session, user, usuario, loading, refreshUsuario }`

## Depende de

- [[lib-supabase]] (`supabase`, incl. `supabase.auth`, `supabase.rpc('get_mi_perfil')`)
- [[lib-types]] (`Usuario`)
- `@supabase/supabase-js` (`Session`, `User`)

## Lo usan

- [[App]] (`AuthProvider` envuelve toda la app)
- [[useAuth]] (re-exporta este `useAuth`)
- Indirectamente, prácticamente todas las páginas y varios componentes vía [[useAuth]]

## Notas

- **Fichero crítico** — cualquier cambio aquí afecta el arranque completo de la app. Ver [[../../claude-notes/Claude-Contexto|Claude-Contexto]] (listado de "archivos críticos").
- Históricamente fuente de varios bugs graves: HTTP 500 por RLS mal configurada (`1c1fc57`), perfiles perdidos por race condition (`3d82cee`), flash de rol incorrecto. Ver [[../../claude-notes/Bugs|Bugs]] y [[../../claude-notes/Seguridad|Seguridad]].
- `get_mi_perfil()` y `get_todos_usuarios()` son funciones `SECURITY DEFINER` que actúan como proxy seguro para columnas que el rol `authenticated` no puede leer directamente (`email`, `es_superadmin`) — ver [[supabase-setup]].

#contexto #auth #critico #seguridad
