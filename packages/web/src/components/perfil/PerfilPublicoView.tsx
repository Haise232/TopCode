import type { ElementType, ReactNode } from 'react'
import { ArrowUpRight, CalendarDays, Code, Github, Globe, GraduationCap, Linkedin, MessageCircle, PenLine, Shield, UserX, Users } from 'lucide-react'
import { claseInfo } from '@topcode/shared'
import { tinta } from '../../lib/tinta'
import { GorroNavidad } from '../Navidad'
import { cn } from '../ui/cn'
import { SUPERFICIE, FOCO, mez } from '../ui/estilos'
import { SkeletonBox } from '../Skeleton'
import { BOTON_PRINCIPAL } from '../acceso/Marca'
import { Cabecera } from './PerfilView'

export type PerfilPublico = {
  id: string
  nombre: string
  avatar_url: string | null
  rol: 'alumno' | 'admin'
  clase: string | null
  es_superadmin: boolean
  bio: string | null
  stack: string[] | null
  github_url: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  created_at?: string | null
}

function Marco({ onVolver, children }: { onVolver: () => void; children: ReactNode }) {
  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[860px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">
        <Cabecera titulo="Perfil" onVolver={onVolver} />
        {children}
      </div>
    </div>
  )
}

export function PerfilPublicoEsqueleto({ onVolver }: { onVolver: () => void }) {
  return (
    <Marco onVolver={onVolver}>
      <div role="status" aria-label="Cargando perfil" className={cn(SUPERFICIE, 'overflow-hidden')}>
        <SkeletonBox className="h-28 sm:h-36 rounded-none" />
        <div className="px-5 sm:px-8 pb-6 -mt-12 flex flex-col gap-3">
          <SkeletonBox className="w-24 h-24 rounded-3xl" />
          <SkeletonBox className="h-7 w-48" /><SkeletonBox className="h-5 w-32" />
          <SkeletonBox className="h-4 w-full mt-2" /><SkeletonBox className="h-4 w-2/3" />
        </div>
      </div>
    </Marco>
  )
}

export function PerfilPublicoVacio({ mensaje, onVolver }: { mensaje: string; onVolver: () => void }) {
  return (
    <Marco onVolver={onVolver}>
      <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-3 text-center px-6 py-14')}>
        <span className="w-14 h-14 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
          <UserX size={26} aria-hidden="true" />
        </span>
        <p className="text-sm text-text-muted">{mensaje}</p>
      </div>
    </Marco>
  )
}

const esWeb = (url: string) => /^https?:\/\//i.test(url)

/** Texto corto del enlace: dominio + ruta, sin protocolo ni barra final. */
function corto(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
}

function Chip({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-bold px-2.5 py-1 rounded-full tracking-wide"
      style={{ background: mez(color, 14), color: tinta(color) }}>
      {children}
    </span>
  )
}

function Bloque({ titulo, Icon, children }: { titulo: string; Icon: ElementType; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-text-muted">
        <Icon size={12} aria-hidden="true" />{titulo}
      </h3>
      {children}
    </section>
  )
}

export default function PerfilPublicoView({ perfil, onVolver, onMensaje, onEditar }: {
  perfil: PerfilPublico
  onVolver: () => void
  /** Abrir chat privado (no se pasa en el perfil propio). */
  onMensaje?: () => void
  /** Ir a editar (solo en el perfil propio). */
  onEditar?: () => void
}) {
  const info = claseInfo(perfil.clase)
  const color = info?.color ?? 'rgb(var(--c-primary))'
  const stack = perfil.stack ?? []
  const enlaces = [
    { url: perfil.github_url, etiqueta: 'GitHub', Icon: Github },
    { url: perfil.linkedin_url, etiqueta: 'LinkedIn', Icon: Linkedin },
    { url: perfil.portfolio_url, etiqueta: 'Portfolio', Icon: Globe },
  ].filter((e): e is { url: string; etiqueta: string; Icon: typeof Github } => !!e.url && esWeb(e.url))
  const vacio = !perfil.bio && stack.length === 0 && enlaces.length === 0
  const desde = perfil.created_at
    ? new Date(perfil.created_at).toLocaleDateString('es', { month: 'long', year: 'numeric' })
    : null

  return (
    <Marco onVolver={onVolver}>
      <article className={cn(SUPERFICIE, 'overflow-hidden')}>
        {/* Portada con el color de la clase */}
        <div aria-hidden="true" className="relative h-28 sm:h-36"
          style={{ background: `linear-gradient(135deg, ${mez(color, 55)}, ${mez(color, 15)} 70%)` }}>
          <div className="absolute inset-0 opacity-[0.18]"
            style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '14px 14px', color: tinta(color) }} />
        </div>

        <div className="px-5 sm:px-8 pb-6 sm:pb-8">
          {/* Avatar + acciones */}
          <div className="flex items-end justify-between gap-3 -mt-12 sm:-mt-14">
            <div className="relative shrink-0">
              <GorroNavidad className="-top-5 -left-3 w-12 -rotate-12 z-10" />
              <div className="w-24 h-24 sm:w-28 sm:h-28 overflow-hidden flex items-center justify-center rounded-3xl bg-surface ring-4 ring-surface shadow-card">
                {perfil.avatar_url
                  ? <img src={perfil.avatar_url} alt={`Foto de ${perfil.nombre}`} className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center font-extrabold text-4xl"
                      style={{ background: mez(color, 16), color: tinta(color) }} aria-hidden="true">
                      {(perfil.nombre[0] ?? 'U').toUpperCase()}
                    </span>}
              </div>
            </div>
            {onMensaje && (
              <button onClick={onMensaje} className={cn(BOTON_PRINCIPAL, 'w-auto px-4 py-2.5')}>
                <MessageCircle size={15} aria-hidden="true" />
                <span>Mensaje</span>
              </button>
            )}
            {onEditar && (
              <button onClick={onEditar}
                className={cn('inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-text-secondary bg-ov/[0.05] hover:bg-ov/[0.09] transition-colors', FOCO)}>
                <PenLine size={15} aria-hidden="true" />Editar perfil
              </button>
            )}
          </div>

          {/* Nombre y datos */}
          <h2 className="mt-4 font-extrabold text-2xl sm:text-3xl tracking-tight leading-tight text-text-primary break-words">{perfil.nombre}</h2>
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            {perfil.rol === 'admin'
              ? <Chip color="#f43f5e"><Shield size={10} aria-hidden="true" />{perfil.es_superadmin ? 'MASTER' : 'ADMIN'}</Chip>
              : <Chip color="rgb(var(--c-primary-light))"><GraduationCap size={10} aria-hidden="true" />ALUMNO</Chip>}
            <Chip color={color}><Users size={10} aria-hidden="true" />{perfil.clase ?? 'Sin clase'}</Chip>
            {desde && (
              <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                <CalendarDays size={12} aria-hidden="true" />
                <span>Desde <span className="first-letter:lowercase">{desde}</span></span>
              </span>
            )}
          </div>

          {perfil.bio && (
            <p className="mt-5 text-[0.95rem] leading-relaxed text-text-secondary whitespace-pre-wrap break-words max-w-[60ch]">{perfil.bio}</p>
          )}

          {(stack.length > 0 || enlaces.length > 0) && (
            <div className="mt-7 pt-6 border-t border-ov/[0.07] grid gap-7 md:grid-cols-2">
              {stack.length > 0 && (
                <Bloque titulo="Tecnologías" Icon={Code}>
                  <ul className="flex flex-wrap gap-1.5">
                    {stack.map(tag => (
                      <li key={tag} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-ov/[0.08] bg-ov/[0.03] text-text-primary">{tag}</li>
                    ))}
                  </ul>
                </Bloque>
              )}
              {enlaces.length > 0 && (
                <Bloque titulo="Enlaces" Icon={Globe}>
                  <ul className="flex flex-col gap-2">
                    {enlaces.map(({ url, etiqueta, Icon }) => (
                      <li key={etiqueta}>
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className={cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 border border-ov/[0.07] hover:bg-ov/[0.04] hover:border-ov/[0.12] transition-colors', FOCO)}>
                          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-ov/[0.06] text-text-primary">
                            <Icon size={15} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-text-primary">{etiqueta}</span>
                            <span className="block text-xs text-text-muted truncate">{corto(url)}</span>
                          </span>
                          <ArrowUpRight size={15} aria-hidden="true"
                            className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </Bloque>
              )}
            </div>
          )}

          {vacio && (
            <p className="mt-6 rounded-xl px-4 py-3 text-sm text-text-muted bg-ov/[0.03] border border-dashed border-ov/[0.1]">
              {onEditar ? 'Aún no has completado tu perfil público: añade una bio, tus tecnologías y enlaces.' : 'Todavía no ha completado su perfil público.'}
            </p>
          )}
        </div>
      </article>
    </Marco>
  )
}
