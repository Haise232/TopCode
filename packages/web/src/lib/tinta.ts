/**
 * Color de texto/icono legible en los dos modos. Los colores semánticos (tipos de
 * evento, materias, avisos…) se eligieron para fondo oscuro; en modo claro se
 * oscurecen con --oscurecer (0% en oscuro, ~40% en claro).
 *   tinta('#fbbf24') → 'color-mix(in srgb, #fbbf24, black var(--oscurecer))'
 * Sirve con hex, rgb() y var(--…).
 */
export function tinta(color: string): string {
  return `color-mix(in srgb, ${color}, black var(--oscurecer))`
}
