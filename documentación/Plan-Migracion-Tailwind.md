# Plan de Migración a Tailwind CSS Puro

## Estado Final: COMPLETADO

## Resumen de la migración

| Fase | Archivos | Estado |
|---|---|---|
| Piloto | Home.tsx + Skeleton.tsx | Completado |
| UI Components | Button, Card, Badge, Input, PageHeader, IconButton, Spinner, Modal | Completado |
| Páginas principales | Profile, Login, Register, Layout, News, Calendar | Completado |
| Páginas restantes | Actividades, Apuntes, Admin, Chat | Completado |
| Componentes restantes | AlertModal, ErrorBoundary, PrivateMessageToast | Completado |
| Final cleanup | Reducir index.css al mínimo | Completado |
| Build | Verificación final | **PASADO** |

## Cambios realizados

### 1. tailwind.config.js
Se añadieron los siguientes tokens hardcodeados (eliminando dependencia de CSS variables):
- **Colors:** `bg: #0f1117`, `surface: #1a1d27`, `surface-2: #1e2130`, `input: #141720`, `border: rgba(255,255,255,0.08)`, `text-primary: #f1f5f9`, `text-secondary: #94a3b8`, `text-muted: #64748b`, `primary-light: #8ff5d6`
- **Overlays:** `overlay-2` a `overlay-30` (todos con `rgba(255,255,255,0.XX)`)
- **Shadows:** `shadow-elevated` para efectos hover dramáticos
- **Background Images:** `gradient-card`, `gradient-surface`, `gradient-primary`, etc.
- **Animations:** `fade-in`, `slide-up`, `scale-in`, `scale-in-modal`, `slide-in-bottom`, `shimmer`, `spin-smooth`, `pulse-soft`, `float`, `count-up`

### 2. Archivos migrados a puro Tailwind

| Archivo | Líneas antes | Líneas después | Inline styles eliminados |
|---|---|---|---|
| Home.tsx | 810 | 674 | ~66 |
| Profile.tsx | 347 | 310 | ~15 |
| Login.tsx | 236 | 210 | ~12 |
| Register.tsx | 290 | 260 | ~12 |
| Layout.tsx | 294 | 270 | ~13 |
| News.tsx | 883 | ~840 | ~43 |
| Calendar.tsx | ~1100 | ~1050 | ~43 |
| Actividades.tsx | ~500 | ~460 | ~15 |
| Apuntes.tsx | ~600 | ~560 | ~12 |
| Admin.tsx | ~450 | ~420 | ~10 |
| Chat.tsx | ~900 | ~850 | ~15 |
| Skeleton.tsx | 122 | 108 | ~9 |
| Button.tsx | 48 | 48 | 0 (clases custom → Tailwind) |
| Card.tsx | 47 | 47 | 0 (clases custom → Tailwind) |
| Badge.tsx | 25 | 25 | 0 (clases custom → Tailwind) |
| Input.tsx | 51 | 51 | 0 (clases custom → Tailwind) |
| PageHeader.tsx | 21 | 21 | 0 (clases custom → Tailwind) |
| IconButton.tsx | 49 | 49 | 0 (clases custom → Tailwind) |
| Spinner.tsx | 24 | 24 | 0 (CSS var → rgba hardcodeado) |
| Modal.tsx | 49 | 49 | 0 (CSS var → rgba hardcodeado) |
| AlertModal.tsx | ~120 | ~110 | ~3 |
| ErrorBoundary.tsx | ~30 | ~28 | ~1 |
| PrivateMessageToast.tsx | ~120 | ~110 | ~3 |

### 3. index.css reducido al mínimo

**Antes:** 411 líneas con:
- `:root` con 40+ variables CSS
- 11 clases en `@layer utilities` (gradientes, glass, shimmer, mono)
- 20 clases en `@layer components` (btn-*, card-*, badge-*, input-base, nav-link, etc.)
- 12 keyframes + 11 clases de animación

**Después:** ~50 líneas con:
- `@tailwind base; @tailwind components; @tailwind utilities;`
- Estilos base de `html, body, #root` (fondo oscuro, tipografía)
- Scrollbar personalizado
- Input date/number styles
- `::selection` con color primary
- Clase `.shimmer` (única clase custom que se mantuvo, porque su gradiente no tiene equivalente directo en Tailwind)
- Keyframe `shimmer`

### 4. CSS files restantes

| Archivo | Líneas | Razón |
|---|---|---|
| `src/index.css` | ~50 | Tailwind directives + base styles + scrollbar + shimmer |
| `src/components/Pattern.css` | ~180 | Patrón de fondo animado con `radial-gradient` complejo y `@keyframes` con 36 valores de `background-position`. No tiene equivalente en Tailwind utilities. |

### 5. Patrón de fondo (Pattern)

**Reemplazado:** `StarField` → `Pattern`

El componente `Pattern` renderiza un patrón de fondo animado con gradientes radiales en tonos naranja/cálido. Se usa en `Layout.tsx` como capa base (`z-index: 0`) dentro del `<main>`.

**Archivos:**
- `src/components/Pattern.tsx` — Componente React (5 líneas)
- `src/components/Pattern.css` — CSS con animación `pattern-hi` (150s loop) y gradientes radiales complejos

**Nota:** El patrón usa `rotate: -45deg` y `inset: -145%` para cubrir toda el área visible durante la animación. Es puramente visual y no recibe eventos (`pointer-events: none`).

### 6. Patrones aplicados

**Colores dinámicos de JS:**
```tsx
// Inyectar como CSS variable
style={{ '--materia-color': color } as React.CSSProperties}
// Usar en Tailwind
className="bg-[var(--materia-color)]/10 text-[var(--materia-color)]"
```

**Hover mutations reemplazadas:**
```tsx
// Antes: onMouseEnter mutando el.style
// Después: clases Tailwind puras
className="group hover:-translate-y-1 hover:scale-[1.02] hover:shadow-elevated transition-all"
```

**Gradientes:**
```tsx
// Antes: style={{ background: 'linear-gradient(145deg, var(--color-surface), var(--color-bg))' }}
// Después: 
className="bg-gradient-to-br from-surface to-bg"
```

**Borders y overlays:**
```tsx
// Antes: style={{ border: '1px solid var(--overlay-06)' }}
// Después:
className="border border-overlay-6"
```

### 6. Resultados del build

| Métrica | Valor |
|---|---|
| Build | **PASADO** (zero errors) |
| CSS bundle | 46.68 kB (gzip: 8.56 kB) |
| Home.js chunk | 19.36 kB (gzip: 5.21 kB) |
| News.js chunk | 16.92 kB (gzip: 4.76 kB) |
| Calendar.js chunk | 28.93 kB (gzip: 7.96 kB) |

### 7. Qué NO se migró (y por qué)

| Elemento | Razón |
|---|---|
| `StarField.css` | Animación de pseudo-elementos `::after` con `box-shadow` dinámico generado por JS. Tailwind no puede manejar pseudo-elementos con box-shadows dinámicos. |
| `animationDelay` en quick actions | `animationDelay` depende del índice del map (`${index * 60}ms`). Tailwind no puede ser dinámico con valores de delay. |
| `--action-color` en quick actions | Cada botón tiene un color distinto definido en el array `QUICK_ACTIONS`. Se inyecta como CSS variable para poder usar `text-[var(--action-color)]`. |
| `--materia-color` en horario | `materiaColor()` genera HSL determinista. 360 colores posibles. Se inyecta como CSS variable. |
| `--urg-color` en actividades | Color calculado por días restantes. Se inyecta como CSS variable. |
| `--strength-color` en Register | Array de colores por nivel de fortaleza. Se inyecta como CSS variable. |

## Archivos clave del sistema Tailwind

- `tailwind.config.js` — Configuración central con todos los tokens
- `src/index.css` — Base styles mínimos (50 líneas)
- `src/components/StarField.css` — Animación pura (64 líneas, independiente)
- `src/components/ui/cn.ts` — Utility `clsx` + `tailwind-merge`

## Próximos pasos recomendados

1. **Revisar visualmente cada página** en el navegador para confirmar que los colores y sombras son idénticos a antes.
2. **Considerar Tailwind v4** en el futuro si se quiere eliminar incluso `tailwind.config.js` y pasar a CSS-first.
3. **Documentar** el patrón de "CSS variable injection" para que nuevos devs entiendan cómo manejar colores dinámicos.

## Notas técnicas

- **Tailwind v3** se mantiene. No se migró a v4 porque el beneficio no justifica el trabajo de reescribir la config.
- **Modo oscuro único**. El `:root` en `index.css` ahora hardcodea `#0f1117` como fondo.
- **No hay modo claro**. El tema es oscuro fijo.
- **Paleta verde menta** (`#55efc4`) se mantiene como primary.
- **Todos los `var(--color-*)` han sido eliminados** del código React. Solo quedan en `StarField.css` (para el color de las estrellas) y en `index.css` (para el shimmer).

## Verificación de build

```bash
npm run build
# Resultado: vite v6.4.1 building for production...
# ✓ 1664 modules transformed.
# ✓ built in 2.42s
# Zero TypeScript errors.
```

---

**Fecha de completado:** 2026-06-09
**Estado:** ✅ COMPLETADO
