// Cache en memoria con TTL simple para queries de Supabase.
// Evita re-fetches innecesarios cuando el usuario navega de vuelta a Home
// en menos de TTL_MS milisegundos. No persiste entre recargas de página.

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

/** Devuelve el valor cacheado si existe y no ha expirado, o null en caso contrario. */
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

/** Guarda un valor en caché durante ttlMs milisegundos (por defecto 60 s). */
export function cacheSet<T>(key: string, data: T, ttlMs = 60_000): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

/** Invalida manualmente una entrada (útil al hacer refresh explícito). */
export function cacheInvalidate(key: string): void {
  store.delete(key)
}

/** Invalida todas las entradas cuya clave empiece por el prefijo dado. */
export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
