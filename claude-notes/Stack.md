# Stack Tecnológico

## Producción

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend framework | React | 18.3.1 |
| Lenguaje | TypeScript | 5.7.3 |
| Bundler | Vite | 6.0.11 |
| Estilos | Tailwind CSS | 3.4.17 |
| Routing | React Router DOM | 6.28.0 |
| Iconos | Lucide React | 0.468.0 |
| Backend / DB | Supabase JS | 2.47.10 |
| Hosting | Vercel | — |

## Supabase (Backend as a Service)

- **PostgreSQL** — base de datos principal
- **Auth** — gestión de sesiones y registro
- **Realtime** — canales para chat en tiempo real
- **Storage** — almacenamiento de PDFs e imágenes (apuntes, avatares)
- **RLS (Row Level Security)** — control de acceso a nivel de fila

## Dev tooling

| Herramienta | Uso |
|-------------|-----|
| ESLint 9 + typescript-eslint | Linting |
| Prettier | Formateo |
| rollup-plugin-visualizer | Análisis de bundle |
| PostCSS + Autoprefixer | Procesado CSS |

## Scripts NPM

```bash
npm run dev       # Servidor de desarrollo → localhost:5173
npm run build     # tsc + vite build
npm run preview   # Previsualizar build
npm run lint      # ESLint
npm run format    # Prettier
npm run analyze   # Bundle analyzer
```

## Variables de entorno

Archivo `.env.local` (no en git):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Relacionado

- [[Arquitectura]]
- [[Seguridad]]
