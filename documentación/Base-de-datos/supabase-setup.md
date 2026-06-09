# supabase/setup.sql

**Ruta real:** `supabase/setup.sql` (1069 líneas)

## Qué es / qué hace

Script SQL único que define **todo el backend de Supabase**: tablas, Row Level Security (RLS), funciones, triggers y políticas de Storage. Se ejecuta manualmente contra el proyecto de Supabase (no hay sistema de migraciones versionadas — es el único fichero en `supabase/`).

## Tablas (`public.*`)

| Tabla | Para qué | Tipo TS equivalente |
|---|---|---|
| `usuarios` | Perfiles de usuario (incl. `email`, `es_superadmin`, `rol`, `promedio`, `avatar_url`, `banner_url`) | [[../Lib-y-Contexts/lib-types\|Usuario]] |
| `notas` | Calificaciones por materia/tema | `Nota` |
| `noticias` | Noticias del centro (listado con enlace externo) | `Noticia` |
| `mensajes` | Chat público | `Mensaje` |
| `mensajes_privados` | Chat 1-a-1 | `MensajePrivado` |
| `apuntes` | Metadatos de apuntes subidos a Storage | `Apunte` |
| `eventos` | Calendario de eventos académicos | `EventoCalendario` |
| `actividades` | Actividades/tareas | `Actividad` |
| `actividades_estado` | Estado de completado por usuario (clave compuesta `actividad_id, usuario_id`) | `ActividadEstado` |
| `anuncios` | Comunicados modales obligatorios | `Anuncio` |

## Vistas

- **`usuarios_publicos`**: expone solo campos no sensibles (`id`, `nombre`, `avatar_url`, `rol`) — sin `email` ni `es_superadmin`. Usada por [[../Paginas/Chat|Chat]] (`UserList`) para listar usuarios sin filtrar por RLS de columna. Decisión documentada en [[../../claude-notes/Decisiones|Decisiones]] (commit `aa9581f`).

## Funciones (`SECURITY DEFINER`)

| Función | Para qué |
|---|---|
| `handle_new_user()` | Trigger — crea la fila en `usuarios` al registrarse un nuevo `auth.users` |
| `recalcular_promedio(p_usuario_id)` | Recalcula `usuarios.promedio` tras alta/baja de notas — invocada desde [[../Hooks/useNotas\|useNotas]] vía `actualizarPromedio` |
| `get_mi_perfil()` | Devuelve el perfil completo (incl. `email`, `es_superadmin`) **solo del propio usuario** — usada en [[../Lib-y-Contexts/AuthContext\|AuthContext]] |
| `get_todos_usuarios()` | Devuelve perfiles con campos sensibles para administradores (gestión de roles en [[../Paginas/Admin\|Admin]]) |

> Estas 4 funciones son la pieza central de la solución de seguridad descrita en `ff7ad65`: actúan como **proxy `SECURITY DEFINER`** para columnas (`email`, `es_superadmin`) que el rol `authenticated` no puede leer directamente por `REVOKE` a nivel de columna — RLS por sí solo no era suficientemente granular.

## RLS y políticas (resumen por tabla)

Todas las tablas tienen RLS activado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Patrones recurrentes:

- `*_select_auth` / `*_select_authenticated`: cualquier usuario autenticado puede leer.
- `*_insert_own` / `*_update_own` / `*_delete_own`: solo el propio autor puede modificar/borrar sus filas (`notas`, `mensajes`, `apuntes`, `mensajes_privados`, `actividades_estado`).
- `*_insert_admin` / `*_update_admin` / `*_delete_admin`: solo administradores pueden gestionar (`noticias`, `eventos`, `actividades`, `anuncios`).
- `usuarios_update_own` / `usuarios_update_admin`: el propio usuario puede editar su perfil; los admins pueden editar roles de otros.

Políticas de **Storage** (`storage.objects`):
- Bucket `apuntes`: select/insert/delete con reglas propias (`apuntes_storage_*`).
- Bucket `avatars`: select público, insert/update/delete solo del propio usuario (`avatars_*_own`).

## Lo usan

Indirectamente, todo el frontend — cada query de [[../Lib-y-Contexts/lib-supabase|lib-supabase]] depende de que estas tablas/políticas existan y se comporten como espera [[../Lib-y-Contexts/lib-types|lib-types]].

## Notas

- **Fichero crítico de seguridad** — cualquier cambio aquí requiere repasar [[../../claude-notes/Seguridad|Seguridad]] (commits `1c1fc57`, `ff7ad65`) antes de modificar políticas existentes. Una política mal escrita puede provocar HTTP 500 en toda la tabla (bug histórico documentado en [[../../claude-notes/Bugs|Bugs]]).
- No hay migraciones incrementales: este SQL es el "estado deseado" completo, con `IF NOT EXISTS` para poder re-ejecutarse de forma idempotente.

#sql #supabase #rls #seguridad #critico #base-de-datos
