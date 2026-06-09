# Profile

**Ruta real:** `src/pages/Profile.tsx` · **Ruta de la app:** `/profile`

## Qué es / qué hace

Pantalla de perfil de usuario, con tres secciones en tarjetas:

1. **Hero / cabecera**: avatar (subible vía `<input type="file">`), nombre, badge de rol (Admin/Alumno), email, chips de estadísticas (promedio con color según nota — `gradeColor`/`gradeLabel`, fecha de alta).
2. **Editar nombre**: formulario que actualiza `usuarios.nombre` y refresca el perfil global (`refreshUsuario`).
3. **Apariencia**: switch para alternar entre modo claro/oscuro, usando [[ThemeContext]].
4. **Sesión**: botón de cerrar sesión (`supabase.auth.signOut()` + redirección a `/login`).

La subida de avatar (`handleAvatarChange`) valida tipo de imagen y tamaño máx. 5 MB, sube a Storage (`subirAvatar`), guarda la URL en `usuarios.avatar_url` y refresca el contexto de autenticación.

## Exporta

- `export default function Profile()`

## Depende de

- [[useAuth]] (`usuario`, `refreshUsuario`)
- [[ThemeContext]] (`theme`, `toggleTheme`)
- [[lib-supabase]] (`supabase`, `subirAvatar`)
- [[AlertModal]]
- `react-router-dom` (`useNavigate`)

## Lo usan

- [[App]] — ruta protegida `/profile`, accesible desde el icono de perfil en [[Layout]].

## Notas

- `gradeColor`/`gradeLabel` son funciones puras locales que mapean la nota numérica a un color (verde/ámbar/rojo) y una etiqueta cualitativa (Excelente/Notable/Bien/Suficiente/Insuficiente) — patrón replicado en otras páginas que muestran notas/promedios.
- El toggle de tema fue añadido recientemente (commit `5235664` "Añadir toggle de modo claro/oscuro desde el perfil") — ver [[../../claude-notes/00 - Index|claude-notes]].

#pagina #perfil #avatar #tema
