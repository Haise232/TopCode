# ThemeContext

**Ruta real:** `src/contexts/ThemeContext.tsx`

## Qué es / qué hace

Contexto global muy simple para el **tema claro/oscuro** de la aplicación:

- Estado `theme: 'dark' | 'light'`, persistido en `localStorage` bajo la clave `topcode-theme` (por defecto `'dark'`).
- Aplica el atributo `data-theme` al elemento `<html>` (`document.documentElement.setAttribute('data-theme', theme)`), lo que dispara el cambio de variables CSS del tema (definidas presumiblemente en `index.css`/`tailwind.config.js`).
- `toggleTheme()` alterna entre ambos valores.

## Exporta

- `export function ThemeProvider({ children })`
- `export function useTheme()` → `{ theme, toggleTheme }`

## Depende de

- Solo de `react` y la API de `localStorage`/`document`.

## Lo usan

- [[App]] (`ThemeProvider` envuelve toda la app, fuera de `AuthProvider`)
- [[Profile]] — único consumidor de `useTheme` (switch "Apariencia")

## Notas

- `index.html` tiene un script inline que lee `localStorage.getItem('topcode-theme')` y aplica `data-theme` **antes** de que React monte, para evitar el "flash" del tema incorrecto al cargar la página — coordínalo con este contexto si cambias la clave de almacenamiento.
- Funcionalidad añadida recientemente: commits `5235664` (toggle desde el perfil) y `e813865` (repintado de la app en modo claro + paleta verde menta). Ver [[../../claude-notes/00 - Index|claude-notes]].

#contexto #tema #ui
