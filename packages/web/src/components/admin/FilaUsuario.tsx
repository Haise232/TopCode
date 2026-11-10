import { Check, GraduationCap, KeyRound, Shield, Trash2, X } from 'lucide-react'
import { claseInfo, type Usuario } from '@topcode/shared'
import { tinta } from '../../lib/tinta'
import { Badge, Button, Spinner } from '../ui'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'

export interface AccionesUsuario {
  yoId: string | undefined
  esSuperadmin: boolean
  updating: string | null
  puedeGestionar: (u: Usuario) => boolean
  puedeTemporal: (u: Usuario) => boolean
  puedeEliminar: (u: Usuario) => boolean
  onToggleRol: (u: Usuario) => void
  onAcceso: (u: Usuario, estado: 'aprobado' | 'rechazado') => void
  onTemporal: (u: Usuario) => void
  onEliminar: (u: Usuario) => void
}

const ICONO = 'w-9 h-9 shrink-0 flex items-center justify-center rounded-xl border transition-colors disabled:opacity-40'

function Avatar({ u }: { u: Usuario }) {
  return (
    <div className="w-10 h-10 shrink-0 overflow-hidden rounded-xl bg-primary/15 flex items-center justify-center">
      {u.avatar_url
        ? <img src={u.avatar_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        : <span className="font-bold text-sm text-primary-light" aria-hidden="true">{u.nombre[0]?.toUpperCase() ?? '?'}</span>}
    </div>
  )
}

/** Selector Alumno / Admin: pulsar la opción inactiva cambia el rol (con confirmación en la página). */
function SelectorRol({ u, a }: { u: Usuario; a: AccionesUsuario }) {
  const esYo = u.id === a.yoId
  const bloqueado = esYo || !a.puedeGestionar(u)
  const titulo = esYo ? 'No puedes cambiar tu propio rol' : !a.puedeGestionar(u) ? 'Solo puedes gestionar usuarios de tu clase' : undefined
  const opciones = [
    { rol: 'alumno' as const, etiqueta: 'Alumno', Icon: GraduationCap, color: 'rgb(var(--c-primary-light))' },
    { rol: 'admin' as const, etiqueta: 'Admin', Icon: Shield, color: '#f43f5e' },
  ]
  return (
    <div role="radiogroup" aria-label={`Rol de ${u.nombre}`} title={titulo}
      className={cn('inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-ov/[0.06] border border-ov/[0.08]', bloqueado && 'opacity-60')}>
      {opciones.map(({ rol, etiqueta, Icon, color }) => {
        const activo = u.rol === rol
        return (
          <button
            key={rol}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={bloqueado}
            onClick={() => { if (!activo) a.onToggleRol(u) }}
            title={!bloqueado && !activo ? (rol === 'admin' ? 'Dar permisos de administrador' : 'Quitar administrador') : undefined}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-colors disabled:cursor-not-allowed',
              FOCO,
              activo ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-secondary',
            )}
          >
            <Icon size={13} aria-hidden="true" style={activo ? { color: tinta(color) } : undefined} />
            {etiqueta}
          </button>
        )
      })}
    </div>
  )
}

export default function FilaUsuario({ u, a }: { u: Usuario; a: AccionesUsuario }) {
  const ocupado = a.updating === u.id
  const clase = claseInfo(u.clase)
  const pendiente = u.estado_acceso === 'pendiente'
  const rechazado = u.estado_acceso === 'rechazado'

  return (
    <li className={cn('flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3.5', rechazado && 'bg-ov/[0.02]')}>
      {/* Identidad */}
      <div className="flex items-center gap-3 basis-full sm:basis-0 sm:flex-1 min-w-0">
        <Avatar u={u} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={cn('font-semibold text-sm truncate max-w-full', rechazado ? 'text-text-muted' : 'text-text-primary')}>{u.nombre}</p>
            {u.id === a.yoId && <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-ov/[0.07] text-text-secondary">Tú</span>}
            {rechazado && <Badge variant="danger">Rechazado</Badge>}
            {a.esSuperadmin && u.clase && (
              <span className="text-2xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: clase?.bg, color: tinta(clase?.color ?? 'currentColor') }}>{u.clase}</span>
            )}
          </div>
          <p className="text-xs truncate mt-0.5 text-text-muted">{u.email}</p>
        </div>
      </div>

      {/* Decisión o rol */}
      <div className="flex items-center gap-2">
        {ocupado ? (
          <span className="w-9 h-9 flex items-center justify-center" role="status" aria-label="Aplicando cambio"><Spinner size="sm" /></span>
        ) : pendiente ? (
          <>
            <Button variant="subtle" size="sm" disabled={!a.puedeGestionar(u)} onClick={() => a.onAcceso(u, 'aprobado')}
              icon={<Check size={14} aria-hidden="true" />} aria-label={`Aceptar acceso de ${u.nombre}`} title="Aceptar acceso">
              Aceptar
            </Button>
            <Button variant="ghost" size="sm" disabled={!a.puedeGestionar(u)} onClick={() => a.onAcceso(u, 'rechazado')}
              icon={<X size={14} aria-hidden="true" />} aria-label={`Rechazar acceso de ${u.nombre}`} title="Rechazar acceso"
              className="flex items-center justify-center gap-2 text-rose-600 dark:text-rose-300">
              Rechazar
            </Button>
          </>
        ) : rechazado && a.puedeGestionar(u) ? (
          <Button variant="subtle" size="sm" onClick={() => a.onAcceso(u, 'aprobado')} icon={<Check size={14} aria-hidden="true" />}
            aria-label={`Aceptar acceso de ${u.nombre}`}>
            Aceptar
          </Button>
        ) : !rechazado ? (
          <SelectorRol u={u} a={a} />
        ) : null}
      </div>

      {/* Acciones: la contraseña a un lado; lo irreversible, separado al final */}
      {(a.puedeTemporal(u) || a.puedeEliminar(u)) && (
        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          {a.puedeTemporal(u) && (
            <button onClick={() => a.onTemporal(u)} disabled={ocupado}
              title="Generar contraseña temporal" aria-label={`Generar contraseña temporal para ${u.nombre}`}
              className={cn(ICONO, 'text-amber-700 dark:text-amber-300 bg-amber-400/10 border-amber-400/25 hover:bg-amber-400/20', FOCO)}>
              <KeyRound size={15} aria-hidden="true" />
            </button>
          )}
          {a.puedeTemporal(u) && a.puedeEliminar(u) && <span className="w-px h-5 bg-ov/[0.12] mx-0.5" aria-hidden="true" />}
          {a.puedeEliminar(u) && (
            <button onClick={() => a.onEliminar(u)} disabled={ocupado}
              title="Eliminar usuario" aria-label={`Eliminar a ${u.nombre}`}
              className={cn(ICONO, 'text-rose-600 dark:text-rose-300 bg-rose-400/10 border-rose-400/25 hover:bg-rose-400/20', FOCO)}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  )
}
