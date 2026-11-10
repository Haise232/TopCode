import { cn } from '../ui/cn'
import { mez } from '../ui/estilos'
import { tinta } from '../../lib/tinta'
import { TIPO_CONFIG, type TipoApunte } from './tipos'

/** Baldosa con el icono del tipo de archivo en su color semántico. */
export default function IconoTipo({ tipo, size = 40, className }: { tipo: TipoApunte; size?: number; className?: string }) {
  const { Icon, color } = TIPO_CONFIG[tipo]
  return (
    <span className={cn('flex items-center justify-center rounded-xl shrink-0', className)}
      style={{ width: size, height: size, background: mez(color, 14), color: tinta(color) }}>
      <Icon size={Math.round(size * 0.47)} aria-hidden="true" />
    </span>
  )
}
