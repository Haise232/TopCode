export type Ciclo = 'DAM' | 'DAW' | 'ASIR'
export type Grupo = 'A' | 'B'

export type ClaseId =
  | '1º DAM A' | '1º DAM B' | '2º DAM A' | '2º DAM B'
  | '1º DAW A' | '1º DAW B' | '2º DAW A' | '2º DAW B'
  | '1º ASIR A' | '1º ASIR B' | '2º ASIR A' | '2º ASIR B'

export interface ClaseInfo {
  id: ClaseId
  ciclo: Ciclo
  curso: 1 | 2
  grupo: Grupo
  color: string
  bg: string
  border: string
}

const CICLO_COLOR: Record<Ciclo, { color: string; bg: string; border: string }> = {
  DAM:  { color: '#8ff5d6', bg: 'rgba(85,239,196,0.12)', border: 'rgba(85,239,196,0.25)' },
  DAW:  { color: '#5eead4', bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.25)' },
  ASIR: { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
}

export const CLASES: ClaseInfo[] = (['DAM', 'DAW', 'ASIR'] as Ciclo[]).flatMap(ciclo =>
  ([1, 2] as const).flatMap(curso =>
    (['A', 'B'] as Grupo[]).map(grupo => ({
      id: `${curso}º ${ciclo} ${grupo}` as ClaseId,
      ciclo, curso, grupo,
      ...CICLO_COLOR[ciclo],
    }))
  )
)

export function claseInfo(id: string | null | undefined): ClaseInfo | undefined {
  return CLASES.find(c => c.id === id)
}

// Agrupa CLASES por "curso + ciclo" (p.ej. "1º DAM" -> [A, B]) para selects con <optgroup>
export const CLASE_GROUPS: { label: string; opciones: ClaseInfo[] }[] = (() => {
  const grupos: { label: string; opciones: ClaseInfo[] }[] = []
  for (const c of CLASES) {
    const label = `${c.curso}º ${c.ciclo}`
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.label === label) ultimo.opciones.push(c)
    else grupos.push({ label, opciones: [c] })
  }
  return grupos
})()
