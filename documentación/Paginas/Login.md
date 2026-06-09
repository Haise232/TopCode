# Login

**Ruta real:** `src/pages/Login.tsx` · **Ruta de la app:** `/login`

## Qué es / qué hace

Pantalla de inicio de sesión con diseño de dos paneles (branding a la izquierda en desktop, formulario a la derecha). Usa `supabase.auth.signInWithPassword({ email, password })`. Tiene una función `traducirError(msg)` que mapea mensajes de error de Supabase Auth (en inglés) a mensajes en español comprensibles para el usuario (credenciales incorrectas, email no confirmado, rate limit, sin conexión, etc.).

Tras un login correcto, navega a `/`.

## Exporta

- `export default function Login()`

## Depende de

- [[lib-supabase]] (`supabase.auth.signInWithPassword`)
- [[AlertModal]] (errores de validación/login)
- `react-router-dom` (`Link`, `useNavigate`)
- `lucide-react` (iconos)

## Lo usan

- [[App]] — montada dentro de `PublicRoute` en la ruta `/login` (solo accesible si no hay sesión activa).

## Notas

- Comparte casi todo el layout visual (branding, glows, tarjeta de formulario) con [[Register]] — si rediseñas una, probablemente quieras tocar la otra para mantener coherencia.
- El control de mostrar/ocultar contraseña usa un `useState<boolean>` local (`showPass`).

#pagina #auth #login
