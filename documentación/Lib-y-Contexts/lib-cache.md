# lib/cache

**Ruta real:** `src/lib/cache.ts`

## Qué es / qué hace

Caché **en memoria** (un `Map` a nivel de módulo) con TTL simple, para evitar refetches innecesarios de queries de Supabase al navegar entre pantallas en poco tiempo. No persiste entre recargas de página (a diferencia de la caché de `usuario` en `sessionStorage` dentro de [[AuthContext]]).

## Exporta

| Función | Qué hace |
|---|---|
| `cacheGet<T>(key)` | Devuelve el valor cacheado si existe y no ha expirado, o `null` |
| `cacheSet<T>(key, data, ttlMs = 60_000)` | Guarda un valor con expiración |
| `cacheInvalidate(key)` | Borra una entrada concreta |
| `cacheInvalidatePrefix(prefix)` | Borra todas las entradas cuya clave empiece por el prefijo dado |

## Depende de

- Nada externo — solo `Map` y `Date.now()`.

## Lo usan

- [[Home]] — único consumidor actual, con claves prefijadas `home:*` (`cacheInvalidatePrefix('home:')` al forzar recarga).

## Notas

- Es un mecanismo **distinto y paralelo** al `cacheRef` (con `useRef`) que implementan los hooks de datos como [[useNotas]], [[useEventos]], [[useApuntes]], [[useActividades]], [[useHomeDatos]] — cada uno mantiene su propia caché local por instancia del hook. Si vas a unificar estrategias de caché en el proyecto, esta es la pieza más reutilizable y centralizada de las dos.

#lib #cache #rendimiento
