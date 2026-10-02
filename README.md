# TopCode

Intranet académica para estudiantes de ciclos formativos de informática (DAM, DAW y ASIR). Reúne en un solo sitio actividades, calendario, apuntes, documentación en Markdown, foro de dudas, recursos y chat en tiempo real, con acceso aprobado por administradores y permisos por clase.

![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-backend-3ecf8e?logo=supabase&logoColor=white)

**Demo:** [topcode-chi.vercel.app](https://topcode-chi.vercel.app)

---

## Contenido

- [Funcionalidades](#funcionalidades)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Requisitos previos](#requisitos-previos)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Variables de entorno](#variables-de-entorno)
- [Configuración de Supabase](#configuración-de-supabase)
- [Scripts](#scripts)
- [Despliegue en Vercel](#despliegue-en-vercel)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

---

## Funcionalidades

Rutas definidas en `packages/web/src/App.tsx`:

| Sección | Ruta | Descripción |
|---------|------|-------------|
| Inicio | `/` | Panel principal con acceso al horario semanal |
| Actividades | `/actividades` | Seguimiento de actividades con filtros (todas / pendientes / completadas) |
| Calendario | `/calendar` | Eventos académicos |
| Explorar | `/explorar` | Vista general: dudas sin resolver, recursos y documentación recientes |
| Docs | `/docs` | Biblioteca de documentación en Markdown tipo wiki (colecciones y páginas, con historial de revisiones) |
| Apuntes | `/apuntes` | Apuntes compartidos entre alumnos |
| Foro | `/foro` | Foro de dudas y fallos, con detalle de cada publicación |
| Recursos | `/recursos` | Enlaces, documentos, vídeos, repositorios y herramientas |
| Chat | `/chat` | Chat en tiempo real y mensajes privados |
| Perfil | `/profile` | Perfil propio y de otros usuarios |
| Admin | `/admin` | Panel de administración (solo administradores): aceptar o rechazar solicitudes de acceso y gestionar usuarios |

Además:

- **Acceso con aprobación**: las cuentas nuevas quedan en estado "Solicitud pendiente" hasta que un administrador las acepta.
- **Permisos por clase**: la gestión de recursos como apuntes, eventos y horario se limita a la clase del administrador (ver `supabase/migracion_permisos_por_clase.sql`).
- **App móvil** (`packages/mobile`): cliente Expo con pantallas de inicio de sesión, inicio, actividades, chat y notas.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend web | React 18, TypeScript 5, Vite 6, React Router 6 |
| Estilos | Tailwind CSS 3 |
| Markdown | react-markdown 9, remark-gfm, rehype-highlight |
| Iconos | lucide-react |
| Móvil | Expo ~53, React Native 0.76, Expo Router ~4 |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage) vía `@supabase/supabase-js` ^2 |
| Calidad | ESLint 9, Prettier 3 |
| Hosting | Vercel |

---

## Estructura del monorepo

Monorepo gestionado con npm workspaces (`packages/*`).

```
.
├── packages/
│   ├── web/       # Aplicación web (React + Vite + TypeScript)
│   ├── mobile/    # Aplicación móvil (Expo / React Native)
│   └── shared/    # Código compartido (lib, hooks, constantes)
├── supabase/      # Esquema y migraciones SQL
├── .github/       # Plantillas de issues
├── .env.example   # Plantilla de variables de entorno
└── vercel.json    # Configuración de despliegue
```

---

## Requisitos previos

- Node.js y npm (el repositorio no fija una versión de Node concreta; usa una versión LTS reciente).
- Un proyecto de [Supabase](https://supabase.com).
- Para la app móvil: Expo (se lanza con `npm run mobile`).

---

## Puesta en marcha local

```bash
# 1. Clona el repositorio
git clone https://github.com/Haise232/TopCode.git
cd TopCode

# 2. Instala las dependencias de todos los paquetes
npm install

# 3. Crea tu archivo de entorno
cp .env.example .env.local
# Edita .env.local con los datos de tu proyecto de Supabase

# 4. Arranca el servidor de desarrollo web
npm run dev
```

Vite sirve la web en `http://localhost:5173` por defecto. El archivo `.env.local` se lee desde la **raíz del repositorio** (así lo configura `packages/web/vite.config.ts`).

> Vercel instala con `npm install --legacy-peer-deps` (ver `vercel.json`). Si `npm install` te da conflictos de dependencias, prueba con esa misma opción.

---

## Variables de entorno

Web (en `.env.local`, ver `.env.example`):

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL de tu proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (`anon`) de Supabase |

Ambas se obtienen en **Supabase Dashboard → Settings → API**.

App móvil (`packages/mobile/src/lib/supabase.ts`): lee `Constants.expoConfig.extra.supabaseUrl` y `supabaseAnonKey`, o bien, como alternativa, estas variables:

| Variable | Descripción |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL de tu proyecto de Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (`anon`) de Supabase |

No subas nunca `.env.local` al repositorio (está en `.gitignore`).

---

## Configuración de Supabase

Los scripts SQL están en `supabase/` y se ejecutan en **Supabase → SQL Editor**. Todos son idempotentes (según indican sus cabeceras).

1. `supabase/setup.sql`: esquema base (tablas, RLS, índices, buckets de Storage y Realtime).
2. Migraciones, en este orden:
   1. `supabase/migracion_clase.sql`: columna `clase` en `usuarios` (12 grupos de DAM/DAW/ASIR).
   2. `supabase/migracion_permisos_por_clase.sql`: gestión limitada a la clase del administrador (se ejecuta después de `setup.sql`).
   3. `supabase/migracion_horario.sql`: tabla `horario` (horario semanal por clase).
   4. `supabase/migracion_documentacion.sql`: biblioteca de documentación en Markdown (requiere las funciones `tc_usuario_*` de la migración de permisos; elimina la antigua sección de Noticias).
   5. `supabase/migracion_foro_recursos.sql`: tablas del foro de dudas (`foro_posts`, `foro_respuestas`) y de recursos compartidos.
   6. `supabase/migracion_seguridad.sql`: protege las columnas sensibles de `usuarios` (rol, superadmin, promedio, clase) y ajusta las políticas de Storage.

Para promover al primer administrador, una vez registrado el usuario:

```sql
UPDATE public.usuarios SET rol = 'admin' WHERE email = 'tu@email.com';
```

Después, en **Authentication → URL Configuration** configura la *Site URL* y las *Redirect URLs* con la URL de tu despliegue.

---

## Scripts

Desde la raíz del repositorio:

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo de la web |
| `npm run build` | Build de producción de la web (`tsc && vite build`) |
| `npm run preview` | Previsualiza el build de producción |
| `npm run lint` | Ejecuta ESLint sobre `packages/web/src` |
| `npm run mobile` | Inicia la app móvil con Expo |

Adicionales en `packages/web` (con `npm run <script> --workspace=packages/web`): `format` (Prettier) y `analyze` (build en modo `analyze`).

---

## Despliegue en Vercel

El proyecto se despliega en Vercel con la configuración de `vercel.json`:

- Instalación: `npm install --legacy-peer-deps`
- Build: `npm run build`
- Directorio de salida: `packages/web/dist`
- Reescritura de rutas a `/index.html` (SPA con React Router)
- Cabeceras de seguridad (CSP, HSTS, `X-Frame-Options`, etc.) y caché larga para `/assets/`

Pasos:

1. Importa el repositorio en [vercel.com](https://vercel.com) con **Add New Project**.
2. Define las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Configura la *Site URL* y las *Redirect URLs* en Supabase con el dominio resultante.

La política CSP de `vercel.json` solo permite conectar con `https://*.supabase.co` y `wss://*.supabase.co`.

---

## Contribuir

Las contribuciones son bienvenidas. Abre un issue con las plantillas de `.github/ISSUE_TEMPLATE` (informe de error o solicitud de funcionalidad) antes de proponer cambios grandes. Antes de enviar un pull request, ejecuta `npm run lint` y `npm run build`.

---

## Licencia

Distribuido bajo la licencia [MIT](LICENSE).
