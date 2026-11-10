import { Github, Globe, Link2, UserX } from 'lucide-react'
import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { SUPERFICIE, FOCO } from '../ui/estilos'
import { SkeletonBox } from '../Skeleton'
import { Cabecera } from './PerfilView'
import Identidad from './Identidad'
import { Panel } from './campos'

export type PerfilPublico = {
  id: string
  nombre: string
  avatar_url: string | null
  rol: 'alumno' | 'admin'
  clase: string | null
  es_superadmin: boolean
  bio: string | null
  stack: string[]
  github_url: string | null
  linkedin_url: string | null
  portfolio_url: string | null
}

function Marco({ onVolver, children }: { onVolver: () => void; children: React.ReactNode }) {
  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[960px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">
        <Cabecera titulo="Perfil" onVolver={onVolver} />
        {children}
      </div>
    </div>
  )
}

export function PerfilPublicoEsqueleto({ onVolver }: { onVolver: () => void }) {
  return (
    <Marco onVolver={onVolver}>
      <div role="status" aria-label="Cargando perfil" className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className={cn(SUPERFICIE, 'p-5 flex lg:flex-col items-center lg:items-start gap-4')}>
          <SkeletonBox className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl" />
          <div className="flex flex-col gap-2"><SkeletonBox className="h-6 w-40" /><SkeletonBox className="h-5 w-28" /></div>
        </div>
        <div className={cn(SUPERFICIE, 'p-5 flex flex-col gap-3')}>
          <SkeletonBox className="h-4 w-full" /><SkeletonBox className="h-4 w-3/4" /><SkeletonBox className="h-4 w-1/2" />
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

export default function PerfilPublicoView({ perfil, onVolver }: { perfil: PerfilPublico; onVolver: () => void }) {
  const enlaces = [
    { url: perfil.github_url, etiqueta: 'GitHub', Icon: Github },
    { url: perfil.linkedin_url, etiqueta: 'LinkedIn', Icon: Link2 },
    { url: perfil.portfolio_url, etiqueta: 'Portfolio', Icon: Globe },
  ].filter((e): e is { url: string; etiqueta: string; Icon: typeof Github } => !!e.url && esWeb(e.url))

  return (
    <Marco onVolver={onVolver}>
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <Identidad
          nombre={perfil.nombre}
          rol={perfil.rol}
          esSuperadmin={perfil.es_superadmin}
          clase={perfil.clase}
          avatarUrl={perfil.avatar_url}
        />
        <div className="flex flex-col gap-6 min-w-0">
          {perfil.bio && (
            <Seccion titulo="Sobre mí">
              <Panel><p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">{perfil.bio}</p></Panel>
            </Seccion>
          )}
          {perfil.stack.length > 0 && (
            <Seccion titulo="Tecnologías">
              <Panel>
                <ul className="flex flex-wrap gap-2">
                  {perfil.stack.map(tag => (
                    <li key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-ov/[0.06] text-text-primary">{tag}</li>
                  ))}
                </ul>
              </Panel>
            </Seccion>
          )}
          {enlaces.length > 0 && (
            <Seccion titulo="Enlaces">
              <Panel>
                <ul className="flex flex-wrap gap-2">
                  {enlaces.map(({ url, etiqueta, Icon }) => (
                    <li key={etiqueta}>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-ov/[0.04] text-primary-light hover:bg-ov/[0.08]', FOCO)}>
                        <Icon size={13} aria-hidden="true" />{etiqueta}
                      </a>
                    </li>
                  ))}
                </ul>
              </Panel>
            </Seccion>
          )}
          {!perfil.bio && perfil.stack.length === 0 && enlaces.length === 0 && (
            <Panel><p className="text-sm text-text-muted">Todavía no ha completado su perfil público.</p></Panel>
          )}
        </div>
      </div>
    </Marco>
  )
}
