# Seguridad

#seguridad #supabase #rls

## Modelo de seguridad

TopCode usa **Row Level Security (RLS)** de PostgreSQL para controlar el acceso a los datos. Todas las tablas tienen RLS activado.

## Roles de usuario

| Campo en DB | Valor | Acceso |
|-------------|-------|--------|
| `es_superadmin` | `false` | Alumno estándar |
| `es_superadmin` | `true` | Administrador (Panel Admin, edición de noticias, eventos) |

## Campos sensibles protegidos

### `email` y `es_superadmin` en tabla `usuarios`

**Problema resuelto (commit `ff7ad65`):**  
Estos campos eran accesibles para cualquier usuario autenticado via RLS normal.

**Solución:** Funciones `SECURITY DEFINER` que actúan como boundary de seguridad:
- Solo el propio usuario puede leer su `email`
- Solo el propio usuario puede leer su `es_superadmin`
- Los admins pueden leer `es_superadmin` de otros para gestionar roles

## Historial de bugs de seguridad / RLS

### HTTP 500 en tabla usuarios (commit `1c1fc57`)
- **Causa:** Políticas RLS mal configuradas que bloqueaban el acceso a la propia fila del usuario
- **Fix:** Reescribir políticas para permitir `SELECT` del propio perfil sin romper el acceso de admin

### Perfiles perdidos (commit `3d82cee`)
- **Causa:** `fetchUsuario` fallaba sin reintento cuando el perfil no existía aún en la tabla
- **Fix:** Lógica de reintento en `fetchUsuario`

### Flash de rol incorrecto (commit `20b622f`)
- **Causa:** La Home mostraba "Estudiante" antes de cargar el rol real
- **Fix:** Skeleton hasta que el contexto de auth esté listo

## Content Security Policy (CSP)

- Configurada en `vite.config.ts`
- Permite imágenes externas HTTPS (commit `568e14...`)
- `modulePreload` en posición correcta (commit `98c507...`)

## Vista pública de usuarios

- Vista SQL que expone solo campos no sensibles (sin `email`, sin `es_superadmin`) para listados públicos
- Commit: `aa9581f`

## Relacionado

- [[Decisiones]]
- [[Bugs]]
