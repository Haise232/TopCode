# Funcionalidades

## Módulos activos

### Notas / Calificaciones
- Registro de calificaciones teórica y práctica por materia
- Cálculo automático de media por materia
- Promedio global del alumno
- Hook: `useNotas.ts` | Página: ~~`Notes.tsx`~~ (eliminado, integrado en otro módulo)

### Apuntes
- Subida de PDFs e imágenes compartidos entre alumnos
- Descarga de archivos
- Storage en Supabase
- Hook: `useApuntes.ts` | Página: `Apuntes.tsx`

### Chat público
- Sala general en tiempo real
- Implementado con Supabase Realtime (canales)
- Hook: `useMensajes.ts` | Página: `Chat.tsx`

### Chat privado
- Mensajes directos 1-a-1 entre alumnos
- También vía Supabase Realtime
- Toast de notificación al recibir mensaje: `PrivateMessageToast.tsx`

### Calendario
- Eventos académicos visibles para todos
- Solo admins pueden crear/editar eventos
- Hook: `useEventos.ts` | Página: `Calendar.tsx`

### News / Noticias
- Anuncios generales del centro
- Los admins pueden crear, editar y borrar noticias
- Modal con preview de imagen: `AnuncioModal.tsx`
- Página: `News.tsx`

### Actividades
- Hook: `useActividades.ts` | Página: `Actividades.tsx`

### Perfil
- Foto de avatar (upload a Storage)
- Nombre editable
- Estadísticas personales
- Página: `Profile.tsx`

### Panel Admin
- Gestión de roles de usuario (alumno ↔ admin)
- Solo visible para `es_superadmin = true`
- Página: `Admin.tsx`

### Home / Dashboard
- Vista de resumen al iniciar sesión
- Skeleton de carga para evitar flash
- Hook: `useHomeDatos.ts` | Página: `Home.tsx`

## Relacionado

- [[Arquitectura]]
- [[Seguridad]]
