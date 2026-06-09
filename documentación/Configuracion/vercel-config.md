# vercel.json

**Ruta real:** `vercel.json`

## Qué es / qué hace

Configuración de despliegue en Vercel (hosting de producción — ver [[../../claude-notes/Decisiones|Decisiones]], "Vercel como hosting"). Define:

- **`rewrites`**: redirige todas las rutas que no empiecen por `/api/` a `/index.html` — necesario para el routing SPA de React Router (sin esto, recargar `/profile` daría 404).
- **`headers`**:
  - Caché agresiva e inmutable para `/assets/*` (`max-age=31536000, immutable`).
  - Cabeceras de seguridad globales: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security` (HSTS con preload), `Permissions-Policy` (deshabilita cámara/micro/geolocalización).
  - **`Content-Security-Policy`**: `default-src 'self'`, permite conexiones a `https://*.supabase.co` / `wss://*.supabase.co`, imágenes de cualquier origen HTTPS (`img-src ... https:`), bloquea `object-src 'none'` y `frame-ancestors 'none'`.

## Exporta

N/A — fichero de configuración declarativa (JSON).

## Depende de

Nada — es leído directamente por la plataforma Vercel en el despliegue.

## Lo usan

- Vercel, en cada deploy desde `main` (`git push → Vercel`).

## Notas

- Si necesitas permitir un nuevo origen externo (por ejemplo, para cargar imágenes de un nuevo dominio), la CSP de aquí es el lugar a modificar — coordínalo con cualquier configuración equivalente en [[vite-config]] o `index.html`.
- Las cabeceras de seguridad reflejan buenas prácticas OWASP — pregunta antes de relajar cualquiera de ellas.

#configuracion #vercel #seguridad #csp #despliegue
