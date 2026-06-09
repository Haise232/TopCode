# tailwind.config

**Ruta real:** `tailwind.config.js` (158 líneas)

## Qué es / qué hace

Configuración de Tailwind CSS — define el theming de la aplicación mapeando nombres de utilidad a **variables CSS** (lo que permite cambiar de tema claro/oscuro sin recompilar):

- Colores base: `bg`, `surface`, `surface-2`, `card`, `input`, `border` → todos referencian `var(--color-*)`.
- Paleta de marca: **`primary`** (verde menta `#55efc4`/`#00b894` — paleta adoptada en el commit `e813865`), `secondary`, `teal`, `rose`, `amber` (y posiblemente más — el fichero continúa más allá de la línea 40).
- `content`: escanea `index.html` y `src/**/*.{js,ts,jsx,tsx}`.

## Exporta

- `export default { content, theme: { extend: {...} } }` (config de Tailwind)

## Depende de

- `tailwindcss`, `postcss.config.js`, `autoprefixer`
- Variables CSS definidas en `src/index.css` (que no se ha leído en detalle — revisar ahí si necesitas localizar las definiciones de `--color-*`)

## Lo usan

- El pipeline de build de Tailwind/PostCSS, en cada compilación.
- Indirectamente, toda la UI: la mayoría de componentes mezclan clases Tailwind con `style={{ background: 'var(--color-surface)', ... }}` inline.

## Notas

- La paleta verde menta es relativamente reciente (commit `e813865` "...cambiar la paleta a verde menta") — si encuentras referencias a colores índigo/morado en componentes antiguos, probablemente sean residuos de la paleta anterior.
- Para cambiar el tema global (claro/oscuro), el punto de partida real son las variables `--color-*` en `index.css` + el atributo `data-theme` gestionado por [[../Lib-y-Contexts/ThemeContext|ThemeContext]] — este fichero solo expone esas variables como utilidades de Tailwind.

#configuracion #tailwind #estilos #tema
