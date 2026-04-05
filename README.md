# TopCode

Intranet académica para el ciclo de **Desarrollo de Aplicaciones Web (DAW)**. Gestión de notas, apuntes compartidos, chat en tiempo real y calendario de eventos.

**Demo en vivo:** [haise232.github.io/TopCode](https://haise232.github.io/TopCode/)

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite 6 |
| Estilos | Tailwind CSS 3 |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Hosting | GitHub Pages (CI/CD via GitHub Actions) |

---

## Funcionalidades

- **Notas** — Registro de calificaciones teórica/práctica por materia, media automática y promedio global
- **Apuntes** — Subida y descarga de PDFs e imágenes compartidos entre alumnos
- **Chat público** — Sala general en tiempo real con Supabase Realtime
- **Chat privado** — Mensajes directos 1-a-1 entre alumnos
- **Calendario** — Eventos académicos gestionados por administradores
- **Perfil** — Foto de avatar, nombre editable y estadísticas personales
- **Panel Admin** — Gestión de roles de usuario (alumno / admin)

---

## Desarrollo local

```bash
# 1. Clona el repositorio
git clone https://github.com/Haise232/TopCode.git
cd TopCode

# 2. Instala dependencias
npm install

# 3. Configura las variables de entorno
cp .env.example .env.local
# Edita .env.local con tus credenciales de Supabase

# 4. Inicia el servidor de desarrollo
npm run dev
# → http://localhost:5173
```

---

## Variables de entorno

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_publica
```

Obtenlos en: **Supabase Dashboard → Settings → API**

---

## Base de datos

Ejecuta el script en **Supabase → SQL Editor**:

```
supabase/setup.sql
```

El script es **idempotente** — seguro de ejecutar sobre una instancia existente o desde cero. Incluye tablas, RLS, índices, Storage buckets y Realtime.

Para promover al primer administrador:

```sql
UPDATE public.usuarios SET rol = 'admin' WHERE email = 'tu@email.com';
```

---

## Despliegue (GitHub Pages)

El deploy es **automático** al hacer push a `main` via GitHub Actions.

### Configuración inicial (una vez)

1. **Secrets** → `Settings → Secrets → Actions`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. **GitHub Pages** → `Settings → Pages → Source: GitHub Actions`

3. **Supabase Auth** → `Authentication → URL Configuration`:
   - Site URL: `https://haise232.github.io`
   - Redirect URLs: `https://haise232.github.io/TopCode/**`

---

## Estructura del proyecto

```
├── .github/workflows/deploy.yml   # CI/CD → GitHub Pages
├── public/
│   ├── _redirects                 # SPA routing (Netlify)
│   └── 404.html                   # SPA routing (GitHub Pages)
├── src/
│   ├── components/                # Layout, Loading, Skeleton, AlertModal, ErrorBoundary
│   ├── contexts/                  # AuthContext
│   ├── hooks/                     # useAuth
│   ├── lib/                       # supabase.ts, types.ts
│   ├── constants/                 # materias.ts
│   └── pages/                     # Login, Register, Home, Notes, Chat, Apuntes, Calendar, Profile, Admin
├── supabase/setup.sql             # Schema completo
├── .env.example
└── vite.config.ts
```

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build local |

---

## Licencia

MIT
