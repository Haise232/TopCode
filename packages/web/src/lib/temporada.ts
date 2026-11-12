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
  oscuro: { clasico: '#0f1117', navidad: '#0b1226' },
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

/** Texto de la cuenta atrás navideña según el día (null fuera de temporada). */
export function cuentaAtrasNavidad(): { texto: string; especial: boolean } | null {
  const dias = diasParaNavidad()
  if (dias === null) return null
  const hoy = new Date()
  const mes = hoy.getMonth()
  const dia = hoy.getDate()
  if (mes === 0 && dia === 6) return { texto: '¡Felices Reyes!', especial: true }
  if (mes === 0 && dia === 7) return { texto: '¡Felices Reyes!', especial: true }
  if (mes === 0 || (mes === 11 && dia >= 26)) return { texto: '¡Feliz año nuevo!', especial: true }
  if (mes === 11 && dia === 25) return { texto: '¡Feliz Navidad!', especial: true }
  if (mes === 11 && dia === 24) return { texto: '¡Hoy es Nochebuena!', especial: true }
  return { texto: dias === 1 ? 'Falta 1 día para Navidad' : `Faltan ${dias} días para Navidad`, especial: false }
}
