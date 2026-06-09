# lib/supabase

**Ruta real:** `src/lib/supabase.ts`

## Qué es / qué hace

Cliente de Supabase y helpers asociados — punto único de acceso al backend (PostgreSQL, Auth, Realtime, Storage, RPC).

### Cliente (`supabase`)
Configurado con:
- `storage: window.localStorage`, `storageKey: 'topcode-session'` — persistencia explícita entre sesiones del navegador.
- `lock`: bypass de `navigator.locks` — evita bloqueos de 5s en HMR/dev y locks huérfanos de pestañas anteriores.
- `global.fetch`: wrapper que añade `AbortSignal.timeout(8000)` a **todas** las queries — evita que una petición colgada bloquee la UI indefinidamente.

### Helpers exportados
| Función | Qué hace |
|---|---|
| `subirArchivo(file, path)` | Sube a bucket `apuntes`, devuelve URL pública o `null` |
| `subirAvatar(file, path)` | Sube a bucket `avatars` (con `upsert: true`), devuelve URL pública o `null` |
| `eliminarArchivoStorage(bucket, path)` | Borra un objeto de Storage (`apuntes` o `avatars`) |
| `actualizarPromedio(usuarioId)` | RPC a `recalcular_promedio` — recalcula `usuarios.promedio` |

## Exporta

- `export const supabase`
- `export async function subirArchivo`
- `export async function subirAvatar`
- `export async function eliminarArchivoStorage`
- `export async function actualizarPromedio`

## Depende de

- `@supabase/supabase-js` (`createClient`)
- Variables de entorno `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (de `.env.local`/`.env.example`) — lanza error si faltan.

## Lo usan

Prácticamente todo el código que toca datos: todos los hooks de [[../00 - Indice|Hooks]], [[AuthContext]], y la mayoría de páginas/componentes que hacen queries directas (`Admin`, `Actividades`, `Home`, `News`, `AnuncioModal`, `PrivateMessageToast`, etc.)

## Notas

- **Fichero crítico** — ver [[../../claude-notes/Claude-Contexto|Claude-Contexto]].
- El timeout global de 8s y el bypass de `navigator.locks` fueron decisiones explícitas para resolver bugs de "carga infinita" — no los quites sin entender el contexto (ver comentarios inline y [[../../claude-notes/Bugs|Bugs]]).

#lib #supabase #critico #storage #rpc
