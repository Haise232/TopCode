# lib/types

**Ruta real:** `src/lib/types.ts`

## Qué es / qué hace

Fichero único de **interfaces TypeScript** que reflejan el esquema de las tablas (y vistas) de Supabase. Es la fuente de verdad de tipos para todo el frontend — al añadir/modificar una columna en `supabase/setup.sql`, este fichero debe actualizarse en consecuencia.

## Exporta

| Interfaz | Tabla/vista relacionada |
|---|---|
| `Usuario` | `usuarios` (incluye `email`, `es_superadmin` — campos sensibles, ver [[../../claude-notes/Seguridad\|Seguridad]]) |
| `UsuarioPublico` | vista `usuarios_publicos` (sin campos sensibles) |
| `Nota` | `notas` |
| `Noticia` | `noticias` |
| `Mensaje` | `mensajes` (chat público) |
| `MensajePrivado` | `mensajes_privados` |
| `Apunte` | `apuntes` |
| `EventoCalendario` | `eventos` |
| `Actividad` | `actividades` |
| `ActividadEstado` | `actividades_estado` |
| `Anuncio` | `anuncios` |

## Depende de

- Nada — son solo definiciones de tipos.

## Lo usan

Prácticamente todos los hooks de datos y páginas que tipan resultados de Supabase: [[useNotas]], [[useEventos]], [[useActividades]], [[useApuntes]], [[useMensajes]], [[useHomeDatos]], [[AuthContext]], [[Chat]], [[Admin]], [[Calendar]], [[Actividades]], [[PrivateMessageToast]], [[AnuncioModal]], etc.

## Notas

- Compara siempre estos tipos con el esquema real en [[supabase-setup]] — son la "vista del frontend" sobre la base de datos, pueden desincronizarse si se modifica el SQL sin actualizar este fichero (o viceversa).
- `NewsItem` (en [[News]]) está definido localmente en la página, no aquí — verifica si debería unificarse con `Noticia`.

#lib #tipos #typescript #esquema
