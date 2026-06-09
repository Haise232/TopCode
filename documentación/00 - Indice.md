# TopCode — Mapa de ficheros del proyecto

> Índice de referencia técnica: una nota por cada fichero relevante del código fuente,
> con su ruta real, qué hace, qué exporta y de qué depende.
> Pensado para que cualquier IA (o persona) localice rápido cualquier pieza del código sin tener que leer todo el repo.
>
> Para contexto de alto nivel (arquitectura, decisiones, seguridad, bugs) ver la carpeta [[../claude-notes/00 - Index|claude-notes]].

---

## Cómo está organizada esta carpeta

```
documentación/
├── 00 - Indice.md          ← estás aquí
├── Componentes/            componentes reutilizables de UI (src/components/)
├── Hooks/                  hooks de datos y utilidades (src/hooks/)
├── Paginas/                una nota por página/ruta (src/pages/)
├── Lib-y-Contexts/         contexts, clientes, tipos y constantes (src/contexts/, src/lib/, src/constants/)
├── Base-de-datos/          esquema SQL, RLS y funciones de Supabase (supabase/)
└── Configuracion/          ficheros de configuración y entrada de la app (raíz, vite, tailwind, etc.)
```

Cada nota sigue el mismo esqueleto: **Ruta real** → **Qué es / qué hace** → **Exporta** → **Depende de** → **Lo usan** → **Notas**.

---

## Componentes (`src/components/`)

| Fichero | Nota | Resumen |
|---|---|---|
| `AlertModal.tsx` | [[AlertModal]] | Modal genérico de alerta/confirmación (error, success, info, warning) |
| `AnuncioModal.tsx` | [[AnuncioModal]] | Modal de comunicados/anuncios para el alumnado, con realtime y "marcar como leído" |
| `ErrorBoundary.tsx` | [[ErrorBoundary]] | Boundary de errores de React a nivel de toda la app |
| `Layout.tsx` | [[Layout]] | Shell de navegación (navbar superior + barra inferior móvil) |
| `Loading.tsx` | [[Loading]] | Pantalla de carga a pantalla completa con logo animado |
| `PrivateMessageToast.tsx` | [[PrivateMessageToast]] | Toast flotante de mensajes privados entrantes + notificaciones del navegador |
| `Skeleton.tsx` | [[Skeleton]] | Familia de componentes "shimmer" para estados de carga |

## Hooks (`src/hooks/`)

| Fichero | Nota | Resumen |
|---|---|---|
| `useAuth.ts` | [[useAuth]] | Re-exporta `useAuth` desde `AuthContext` |
| `useActividades.ts` | [[useActividades]] ⚠️ | CRUD + estado de actividades/tareas, con caché y updates optimistas — **huérfano**, [[Actividades]] usa lógica inline propia |
| `useApuntes.ts` | [[useApuntes]] | Listado, subida y borrado de apuntes (Storage + tabla `apuntes`) — usado por [[Apuntes]] |
| `useDataInit.ts` | [[useDataInit]] | Wrapper de `useEffect` para ejecutar una carga inicial una sola vez |
| `useEventos.ts` | [[useEventos]] | CRUD de eventos del calendario, con caché y updates optimistas — usado por [[Calendar]] |
| `useHomeDatos.ts` | [[useHomeDatos]] ⚠️ | Agrega los datos del dashboard (Home) en una sola carga — **huérfano**, [[Home]] usa lógica inline + [[lib-cache]] |
| `useMensajes.ts` | [[useMensajes]] | Chat público (`usePublicMensajes`) y privado (`usePrivateMensajes`) vía Supabase Realtime — usado por [[Chat]] |
| `useNotas.ts` | [[useNotas]] ⚠️ | CRUD de notas/calificaciones, con caché y updates optimistas — **huérfano**, ningún componente lo importa actualmente |
| `useNotifications.ts` | [[useNotifications]] | Wrapper de la Notification API del navegador — usado por [[PrivateMessageToast]] |

> ⚠️ = hook sin consumidores detectados por `grep` en `src/pages`/`src/components` al momento de escribir esta documentación (2026-06-08). Puede tratarse de una refactorización a medias o código a limpiar — verifica con `git log` antes de modificar o borrar.

## Páginas (`src/pages/`)

| Fichero | Nota | Resumen |
|---|---|---|
| `Login.tsx` | [[Login]] | Pantalla de inicio de sesión |
| `Register.tsx` | [[Register]] | Pantalla de registro de usuario |
| `Home.tsx` | [[Home]] | Dashboard principal tras iniciar sesión |
| `News.tsx` | [[News]] | Listado y gestión (admin) de noticias/anuncios del centro |
| `Chat.tsx` | [[Chat]] | Chat público y chat privado 1-a-1 |
| `Apuntes.tsx` | [[Apuntes]] | Biblioteca compartida de apuntes (subida/descarga de PDFs e imágenes) |
| `Actividades.tsx` | [[Actividades]] | Listado y seguimiento de actividades/tareas con estado por alumno |
| `Calendar.tsx` | [[Calendar]] | Calendario de eventos académicos |
| `Admin.tsx` | [[Admin]] | Panel de administración (gestión de roles + anuncios) |
| `Profile.tsx` | [[Profile]] | Perfil de usuario (avatar, nombre, tema, logout) |

## Lib, Contexts y Constants

| Fichero | Nota | Resumen |
|---|---|---|
| `contexts/AuthContext.tsx` | [[AuthContext]] | Estado global de sesión/perfil de usuario (Supabase Auth) |
| `contexts/ThemeContext.tsx` | [[ThemeContext]] | Estado global de tema claro/oscuro |
| `lib/supabase.ts` | [[lib-supabase]] | Cliente de Supabase + helpers de Storage y RPC |
| `lib/cache.ts` | [[lib-cache]] | Caché en memoria con TTL para queries |
| `lib/types.ts` | [[lib-types]] | Interfaces TypeScript que reflejan las tablas de Supabase |
| `constants/materias.ts` | [[constants-materias]] | Catálogo estático de asignaturas del ciclo |

## Base de datos (`supabase/`)

| Fichero | Nota | Resumen |
|---|---|---|
| `setup.sql` | [[supabase-setup]] | Script único: tablas, RLS, funciones, triggers y políticas de Storage |

## Configuración y entrada de la app

| Fichero | Nota | Resumen |
|---|---|---|
| `src/App.tsx` | [[App]] | Definición de rutas y guards (Protected/Public/Admin) |
| `src/main.tsx` | [[main]] | Punto de entrada — monta React fuera de StrictMode |
| `vite.config.ts` | [[vite-config]] | Configuración de build, chunks y plugin de preconnect |
| `vercel.json` | [[vercel-config]] | Rewrites SPA, headers de seguridad y CSP en producción |
| `tailwind.config.js` | [[tailwind-config]] | Theming, paleta de colores (verde menta) y animaciones |
| `index.html` | [[index-html]] | HTML raíz — script anti-flash de tema y restauración SPA |

---

## Relacionado

- [[../claude-notes/Arquitectura|Arquitectura (claude-notes)]]
- [[../claude-notes/Stack|Stack tecnológico (claude-notes)]]
- [[../claude-notes/Seguridad|Seguridad y RLS (claude-notes)]]

#documentacion #mapa-de-ficheros
