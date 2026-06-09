# Register

**Ruta real:** `src/pages/Register.tsx` · **Ruta de la app:** `/register`

## Qué es / qué hace

Pantalla de registro, con el mismo layout de dos paneles que [[Login]]. Usa `supabase.auth.signUp({ email, password, options: { data: { nombre }, emailRedirectTo } })`. Valida en cliente: campos no vacíos y contraseña ≥ 6 caracteres; muestra un indicador visual de "fortaleza" de contraseña (`passStrength`: Débil/Media/Fuerte según longitud).

Tras un registro correcto, muestra un modal de éxito ("¡Revisa tu correo!") y, al cerrarlo, navega a `/login`. También traduce errores de Supabase Auth al español (`traducirError`: email duplicado, contraseña corta, formato inválido, rate limit, sin conexión).

## Exporta

- `export default function Register()`

## Depende de

- [[lib-supabase]] (`supabase.auth.signUp`)
- [[AlertModal]] (errores de validación + modal de éxito)
- `react-router-dom` (`Link`, `useNavigate`)
- `lucide-react` (iconos)

## Lo usan

- [[App]] — montada dentro de `PublicRoute` en la ruta `/register`.

## Notas

- El registro inserta el `nombre` en `user_metadata`; el perfil real en la tabla `usuarios` se crea más tarde, la primera vez que el usuario inicia sesión, vía `fetchUsuario` en [[AuthContext]] (upsert) o el trigger `handle_new_user` (ver [[../Base-de-datos/supabase-setup|supabase-setup]]).
- `emailRedirectTo` apunta a `${window.location.origin}/login` — el enlace de confirmación de email lleva de vuelta al login.

#pagina #auth #registro
