export type Tema = 'clasico' | 'navidad'

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

/** Aplica el tema en <html> antes del primer render para evitar el parpadeo. */
export function aplicarTema(tema: Tema) {
  document.documentElement.dataset.theme = tema
  const color = tema === 'navidad' ? '#0a1310' : '#0f1117'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
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
