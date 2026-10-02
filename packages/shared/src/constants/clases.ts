export type ClaseId = '2º DAM A'

export interface ClaseInfo {
  id: ClaseId
  color: string
  bg: string
  border: string
}

export const CLASE_UNICA: ClaseInfo = {
  id: '2º DAM A',
  color: '#8ff5d6',
  bg: 'rgba(85,239,196,0.12)',
  border: 'rgba(85,239,196,0.25)',
}

export const CLASES: ClaseInfo[] = [CLASE_UNICA]

export function claseInfo(id: string | null | undefined): ClaseInfo | undefined {
  return CLASES.find(c => c.id === id)
}
