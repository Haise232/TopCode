import { CheckCircle2, Clock } from 'lucide-react'
import { tinta } from '../../lib/tinta'
import { categoriaForo } from './categorias'
import { mez } from '../ui/estilos'

const BASE = 'inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap'

export function Categoria({ codigo }: { codigo: string }) {
  const c = categoriaForo(codigo)
  return (
    <span className={BASE} style={{ background: mez(c.color, 14), color: tinta(c.color) }}>
      {c.singular}
    </span>
  )
}

/** Resuelto en teal; pendiente en neutro (el color solo donde significa algo). */
export function Estado({ resuelto }: { resuelto: boolean }) {
  return resuelto ? (
    <span className={`${BASE} bg-teal/[0.14] text-teal-light`}>
      <CheckCircle2 size={11} aria-hidden="true" />Resuelto
    </span>
  ) : (
    <span className={`${BASE} bg-ov/[0.06] text-text-secondary`}>
      <Clock size={11} aria-hidden="true" />Pendiente
    </span>
  )
}
