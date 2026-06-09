# index.html

**Ruta real:** `index.html`

## Qué es / qué hace

HTML raíz de la SPA. Contiene tres scripts inline críticos que se ejecutan **antes** de que React monte:

1. **Anti-flash de tema**: lee `localStorage.getItem('topcode-theme')` y aplica `data-theme` al `<html>` de inmediato — evita el parpadeo del tema incorrecto al cargar (coordina con [[ThemeContext]]).
2. **Restauración de ruta SPA**: lee `sessionStorage.getItem('spa_redirect')` (mecanismo típico de despliegues en GitHub Pages con `404.html`) y restaura la URL original con `history.replaceState`.
3. Carga el punto de entrada: `<script type="module" src="/src/main.tsx">`.

También incluye metadatos (`description`, `theme-color`, `robots: noindex,nofollow` — la app no debe indexarse en buscadores por ser una intranet privada) y un `<link rel="dns-prefetch" href="https://supabase.co">` como fallback del plugin de preconnect de [[vite-config]].

## Exporta

N/A — documento HTML.

## Depende de

- `localStorage` (clave `topcode-theme`, gestionada también por [[ThemeContext]])
- `sessionStorage` (clave `spa_redirect`, mecanismo de redirect SPA de GitHub Pages — relevante si la app sigue desplegándose ahí además de Vercel)
- `/logo.svg` (favicon/apple-touch-icon, en `public/`)

## Lo usan

- El navegador, como documento raíz servido para cualquier ruta (gracias a los `rewrites` de [[vercel-config]]).

## Notas

- El script de restauración SPA sugiere que el proyecto **también** se despliega en GitHub Pages (la demo enlazada en `claude-notes` apunta a `haise232.github.io/TopCode`) además de Vercel (producción) — confírmalo si vas a tocar el routing o el `base` de [[vite-config]].
- Si cambias la clave `topcode-theme` en [[ThemeContext]], debes actualizarla también aquí para que el anti-flash siga funcionando.

#configuracion #html #tema #spa
