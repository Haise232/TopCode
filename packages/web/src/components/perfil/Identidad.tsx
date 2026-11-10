import type { ReactNode } from 'react'
import { GraduationCap, Shield, Users } from 'lucide-react'
import { claseInfo } from '@topcode/shared'
import { tinta } from '../../lib/tinta'
import { GorroNavidad } from '../Navidad'
import { SUPERFICIE, mez } from '../ui/estilos'
import { cn } from '../ui/cn'

function Chip({ children, color, style }: { children: ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-2xs font-bold px-2.5 py-1 rounded-full tracking-wide"
      style={color ? { background: mez(color, 13), color: tinta(color), ...style } : style}
    >
      {children}
    </span>
  )
}

/** Tarjeta de identidad: avatar (con gorro en Navidad), nombre, rol y clase. `ranuras` pinta contenido bajo la cabecera. */
export default function Identidad({
  nombre, rol, esSuperadmin, clase, avatarUrl, email, accionAvatar, children, className,
}: {
  nombre: string
  rol: 'alumno' | 'admin'
  esSuperadmin: boolean
  clase: string | null | undefined
  avatarUrl: string | null
  email?: string
  /** Botón superpuesto en la esquina del avatar (cambiar foto). */
  accionAvatar?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const initial = (nombre[0] ?? 'U').toUpperCase()
  const info = claseInfo(clase)
  return (
    <div className={cn(SUPERFICIE, 'p-5 flex flex-col gap-5', className)}>
      <div className="flex lg:flex-col items-center lg:items-start gap-4 lg:gap-5">
        <div className="relative shrink-0">
          <GorroNavidad className="-top-5 -left-3 w-12 -rotate-12 z-10" />
          <div className="w-20 h-20 lg:w-24 lg:h-24 overflow-hidden flex items-center justify-center rounded-2xl bg-primary/15">
            {avatarUrl
              ? <img src={avatarUrl} alt={`Foto de ${nombre}`} className="w-full h-full object-cover" />
              : <span className="font-extrabold text-3xl lg:text-4xl text-primary-light" aria-hidden="true">{initial}</span>}
          </div>
          {accionAvatar}
        </div>
        <div className="min-w-0 flex flex-col gap-2">
          <h2 className="font-extrabold text-2xl tracking-tight text-text-primary break-words leading-tight">{nombre}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {rol === 'admin' ? (
              <Chip color="#f43f5e"><Shield size={10} aria-hidden="true" />{esSuperadmin ? 'MASTER' : 'ADMIN'}</Chip>
            ) : (
              <Chip color="rgb(var(--c-primary-light))"><GraduationCap size={10} aria-hidden="true" />ALUMNO</Chip>
            )}
            <Chip style={{ backgroundColor: info?.bg ?? mez('currentColor', 10), color: tinta(info?.color ?? 'currentColor') }}>
              <Users size={10} aria-hidden="true" />{clase ?? 'Sin clase'}
            </Chip>
          </div>
          {email && <p className="text-xs text-text-muted break-all">{email}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}
