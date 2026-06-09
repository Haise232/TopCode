# vite.config

**Ruta real:** `vite.config.ts`

## Qué es / qué hace

Configuración de Vite (build, dev server, plugins). Puntos clave:

- **`preconnectPlugin`** (plugin custom): extrae el origen del host de Supabase de `VITE_SUPABASE_URL` e inyecta un `<link rel="preconnect">` en el `<head>` durante el build, para acelerar la primera conexión a la API/Auth/Realtime de Supabase.
- **`build.manualChunks`**: separa vendor chunks — `vendor-react`, `vendor-router`, `vendor-supabase`, `vendor-icons` — para mejor cacheo y carga paralela.
- **`build.modulePreload.polyfill = true`**: polyfill para Firefox < 115 / Safari < 17 (relacionado con el bug histórico de `modulePreload` mal posicionado, commit `98c5072`, ver [[../../claude-notes/Bugs|Bugs]]).
- `cssCodeSplit: true`: cada ruta lazy carga solo el CSS que necesita.
- Puertos: dev `5173`, preview `4173`.

## Exporta

- `export default defineConfig(...)`

## Depende de

- `vite`, `@vitejs/plugin-react`
- Variable de entorno `VITE_SUPABASE_URL` (para el plugin de preconnect)

## Lo usan

- El propio Vite, al ejecutar `npm run dev` / `npm run build` / `npm run preview` / `npm run analyze`.

## Notas

- **Fichero crítico** — ver [[../../claude-notes/Claude-Contexto|Claude-Contexto]] ("CSP y configuración de build").
- Si cambia el dominio del proyecto Supabase, el plugin de preconnect lo detecta automáticamente desde `VITE_SUPABASE_URL` — no requiere cambios manuales aquí.

#configuracion #vite #build #rendimiento #critico
