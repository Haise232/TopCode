export type Tema = 'clasico' | 'navidad'
export type Modo = 'claro' | 'oscuro'

const MODO_KEY = 'topcode:modo'

/** Modo guardado por el usuario; si no eligió nunca, claro. */
export function modoGuardado(): Modo {
  try {
    return localStorage.getItem(MODO_KEY) === 'oscuro' ? 'oscuro' : 'claro'
  } catch {
    return 'claro'
  }
}

export function guardarModo(modo: Modo) {
  try {
    localStorage.setItem(MODO_KEY, modo)
  } catch {
    // sin almacenamiento: el cambio dura hasta recargar
  }
}

/**
 * Tema de temporada. La decoración navideña va del 1 de noviembre al 7 de enero
 * (Reyes); el resto del año vuelve sola al tema clásico.
 */
export function temaDeTemporada(fecha = new Date()): Tema {
  const mes = fecha.getMonth() // 0 = enero
  const dia = fecha.getDate()
  if (mes === 11) return 'navidad'
  if (mes === 10) return 'navidad'
  if (mes === 0 && dia <= 7) return 'navidad'
  return 'clasico'
}

const THEME_COLOR: Record<Modo, Record<Tema, string>> = {
  oscuro: { clasico: '#0f1117', navidad: '#0a1310' },
  claro:  { clasico: '#f5f7f9', navidad: '#f8f4ed' },
}

/** Aplica tema y modo en <html> antes del primer render para evitar el parpadeo. */
export function aplicarTema(tema: Tema, modo: Modo = modoGuardado()) {
  const html = document.documentElement
  html.dataset.theme = tema
  html.dataset.mode = modo
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[modo][tema])
}

/** Días que faltan para el 25 de diciembre (0 el propio día; null fuera de temporada). */
export function diasParaNavidad(fecha = new Date()): number | null {
  if (temaDeTemporada(fecha) !== 'navidad') return null
  const hoy = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const anio = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear()
  const navidad = new Date(anio, 11, 25)
  const diff = Math.round((navidad.getTime() - hoy.getTime()) / 86_400_000)
  return Math.max(diff, 0)
}
