import type { CSSProperties } from 'react'
import { cn } from './cn'
import { tinta } from '../../lib/tinta'

// Mezcla un color con transparente (Tailwind no aplica /N a var() arbitrarias)
export const mez = (c: string, n: number) => `color-mix(in srgb, ${c} ${n}%, transparent)`

/** Variables CSS de un color semántico: fondo suave (--c-bg), tinta legible (--c-ink) y plano (--c). */
export const varsColor = (c: string) =>
  ({ '--c': c, '--c-ink': tinta(c), '--c-suave': mez(c, 12), '--c-medio': mez(c, 22) }) as CSSProperties

/** Clase de foco visible común a todo lo pulsable de Inicio. */
export const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

/** Superficie base de todas las tarjetas de Inicio: un solo borde fino y sombra del tema. */
export const SUPERFICIE = 'rounded-2xl bg-surface border border-ov/[0.07] shadow-card'

/** Superficie pulsable (tarjeta que navega). */
export const SUPERFICIE_PULSABLE = cn(
  SUPERFICIE,
  'transition-[transform,box-shadow] duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-card-hover',
  FOCO,
)

// Hash determinista del nombre de materia → color suave
export function materiaColor(nombre: string): string {
  let hash = 0
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 60%)`
}
