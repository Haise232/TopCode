import {
  Calendar, GraduationCap, ExternalLink, Github, Palette, School,
  MessageCircle, FolderOpen, Sparkles, BookMarked, HelpCircle, Dices,
} from 'lucide-react'
import type { ElementType } from 'react'
import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { FOCO, SUPERFICIE, SUPERFICIE_PULSABLE, varsColor } from '../ui/estilos'

const ENLACES_INTERES = [
  { label: 'GitHub', desc: 'Código', Icon: Github, href: 'https://github.com', color: '#a78bfa' },
  {
    label: 'Campus',
    desc: 'Virtual',
    Icon: GraduationCap,
    href: 'https://www3.gobiernodecanarias.org/educacion/cau_ce/cas/login?service=https%3A%2F%2Fwww3.gobiernodecanarias.org%2Fmedusa%2Feforma%2Fcampus%2Flogin%2Findex.php',
    color: '#fbbf24',
  },
  {
    label: 'Pincel Ekade',
    desc: 'Diseño',
    Icon: Palette,
    href: 'https://www3.gobiernodecanarias.org/educacion/cau_ce/cas/login?service=https%3a%2f%2fwww.gobiernodecanarias.org%2feducacion%2fsinfo%2fcasclientsua%2f',
    color: '#fb7185',
  },
  {
    label: 'CIFP Villa',
    desc: 'Agüimes',
    Icon: School,
    href: 'https://www3.gobiernodecanarias.org/medusa/edublog/cifpvilladeaguimes/',
    color: 'rgb(var(--c-primary-light))',
  },
  { label: 'GcGames', desc: 'Casino', Icon: Dices, href: 'https://play.gcgames.workers.dev', color: '#ffc83d' },
]

const ACCESOS_INTERNOS = [
  { label: 'Docs',          desc: 'Documentación', Icon: BookMarked,     to: '/docs',                        color: '#fbbf24' },
  { label: 'Chat',          desc: 'General',       Icon: MessageCircle,  to: '/chat',                        color: 'rgb(var(--c-primary))' },
  { label: 'Apuntes',       desc: 'Archivos',      Icon: FolderOpen,     to: '/apuntes',                     color: '#fb923c' },
  { label: 'Calendario',    desc: 'Eventos y tareas', Icon: Calendar,       to: '/calendar',                    color: '#22d3ee' },
  { label: 'Foro de dudas', desc: 'Preguntas',     Icon: HelpCircle,     to: '/foro',                        color: '#60a5fa' },
  { label: 'Prompts IA',    desc: 'Para la IA',    Icon: Sparkles,       to: '/prompts',                     color: '#a78bfa' },
]

function IconoColor({ Icon, className }: { Icon: ElementType; className?: string }) {
  return (
    <span className={cn('shrink-0 flex items-center justify-center rounded-xl bg-[color:var(--c-suave)] text-[color:var(--c-ink)] transition-transform duration-200 motion-safe:group-hover:scale-105', className)}>
      <Icon size={20} aria-hidden="true" />
    </span>
  )
}

/** «Tu espacio»: navegación interna. Fila en móvil, baldosa vertical en escritorio. */
export function AccesosInternos({ onNavigate }: { onNavigate: (to: string) => void }) {
  return (
    <Seccion titulo="Tu espacio">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 lg:gap-3">
        {ACCESOS_INTERNOS.map(({ label, desc, Icon, to, color }) => (
          <button
            key={to}
            onClick={() => onNavigate(to)}
            style={varsColor(color)}
            className={cn(
              'group flex items-center gap-3 p-3 text-left lg:flex-col lg:gap-2.5 lg:py-5 lg:text-center',
              SUPERFICIE_PULSABLE,
            )}
          >
            <IconoColor Icon={Icon} className="w-10 h-10 lg:w-12 lg:h-12" />
            <span className="min-w-0 flex flex-col leading-tight">
              <span className="text-sm font-bold text-text-primary lg:truncate">{label}</span>
              <span className="text-2xs text-text-muted truncate">{desc}</span>
            </span>
          </button>
        ))}
      </div>
    </Seccion>
  )
}

/** Enlaces externos: una sola tarjeta con filas ligeras, más discretos que «Tu espacio». */
export function EnlacesExternos() {
  return (
    <Seccion titulo="Enlaces externos">
      <div className={cn(SUPERFICIE, 'grid grid-cols-1 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-ov/[0.06] overflow-hidden')}>
        {ENLACES_INTERES.map(({ label, desc, Icon, href, color }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={varsColor(color)}
            className={cn('group flex items-center gap-3 px-4 py-2.5 sm:py-3 transition-colors hover:bg-ov/[0.04] focus-visible:bg-ov/[0.04]', FOCO, 'focus-visible:ring-inset focus-visible:ring-offset-0')}
          >
            <IconoColor Icon={Icon} className="w-9 h-9 [&>svg]:w-4 [&>svg]:h-4" />
            <span className="min-w-0 flex-1 flex flex-col leading-tight">
              <span className="text-sm font-semibold text-text-primary truncate">{label}</span>
              <span className="text-2xs text-text-muted truncate">{desc}</span>
            </span>
            <ExternalLink size={12} className="shrink-0 text-text-faint transition-colors group-hover:text-text-secondary" aria-label="Se abre en una pestaña nueva" />
          </a>
        ))}
      </div>
    </Seccion>
  )
}
