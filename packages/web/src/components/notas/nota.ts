import type { Nota } from '@topcode/shared'

export function calcMedia(teorica: number, practica: number) {
  return Math.round(((teorica + practica) / 2) * 100) / 100
}

export function promedioMateria(notas: Nota[]) {
  if (notas.length === 0) return null
  return notas.reduce((s, n) => s + n.media, 0) / notas.length
}

export function groupByMateria(notas: Nota[]): Record<string, Nota[]> {
  return notas.reduce<Record<string, Nota[]>>((acc, n) => {
    if (!acc[n.materia]) acc[n.materia] = []
    acc[n.materia].push(n)
    return acc
  }, {})
}

export type Nivel = 'oro' | 'bien' | 'justo' | 'suspenso'

/** Nivel de una nota. El dorado solo existe en Navidad (≥ 9). */
export function nivelNota(valor: number, navidad: boolean): Nivel {
  if (navidad && valor >= 9) return 'oro'
  if (valor >= 7) return 'bien'
  if (valor >= 5) return 'justo'
  return 'suspenso'
}

/** Texto y fondo suave por nivel (teal para aprobado, nunca primary). */
export const NIVEL_CLASE: Record<Nivel, string> = {
  oro: 'bg-gold/15 text-gold-light',
  bien: 'bg-teal/15 text-teal-light',
  justo: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  suspenso: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
}

export const NIVEL_TEXTO: Record<Nivel, string> = {
  oro: 'text-gold-light',
  bien: 'text-teal-light',
  justo: 'text-amber-700 dark:text-amber-300',
  suspenso: 'text-rose-600 dark:text-rose-300',
}

export const NIVEL_BARRA: Record<Nivel, string> = {
  oro: 'bg-gold',
  bien: 'bg-teal',
  justo: 'bg-amber-500',
  suspenso: 'bg-rose-500',
}
