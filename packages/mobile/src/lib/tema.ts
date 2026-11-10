// Paleta centralizada con dos temporadas: clásico y navidad.
// La decoración navideña va del 1 de noviembre al 7 de enero (inclusive).

export interface Paleta {
  bg: string
  surface: string
  surface2: string
  border: string
  primary: string
  primaryDark: string
  primaryLight: string
  teal: string
  gold: string
  text: string
  textSecondary: string
  textMuted: string
}

// Clásico = los colores que la app móvil tenía antes de las temporadas
export const CLASICO: Paleta = {
  bg: '#0a0f0a',
  surface: '#111812',
  surface2: '#0d1a0d',
  border: '#1e2d1e',
  primary: '#22c55e',
  primaryDark: '#14532d',
  primaryLight: '#8ff5d6',
  teal: '#22c55e',
  gold: '#e7b75a',
  text: '#e5e7eb',
  textSecondary: '#d1d5db',
  textMuted: '#6b7280',
}

// Navidad «Noche de paz»: azul medianoche, azul hielo y dorado (igual que la web en oscuro)
export const NAVIDAD: Paleta = {
  bg: '#0b1226',
  surface: '#131c36',
  surface2: '#192442',
  border: '#24304f',
  primary: '#4c8fe0',
  primaryDark: '#2f6fc4',
  primaryLight: '#9cc7f5',
  teal: '#4fb38a',
  gold: '#e8be60',
  text: '#eef2fa',
  textSecondary: '#a0aecc',
  textMuted: '#6a7a9c',
}

export type Temporada = 'navidad' | 'clasico'

export function temaDeTemporada(fecha: Date = new Date()): Temporada {
  const mes = fecha.getMonth() + 1 // 1-12
  const dia = fecha.getDate()
  if (mes === 11) return 'navidad'
  if (mes === 12) return 'navidad'
  if (mes === 1 && dia <= 7) return 'navidad'
  return 'clasico'
}

export const esNavidad = temaDeTemporada() === 'navidad'
export const colores: Paleta = esNavidad ? NAVIDAD : CLASICO
