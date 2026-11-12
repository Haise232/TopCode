import { useEffect, useState, type ElementType } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, LayoutGrid, X } from 'lucide-react'
import type { UnreadCounts } from '../hooks/useUnreadCounts'
import { cn } from './ui/cn'
import { FOCO } from './ui/estilos'

export interface ItemMovil {
  to: string
  label: string
  Icon: ElementType
  badgeKey?: keyof UnreadCounts
  /** Texto de apoyo en el panel «Más». */
  desc?: string
}

function Insignia({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null
  return (
    <span className={cn('flex items-center justify-center text-[9px] font-bold text-white rounded-full min-w-4 h-4 px-1 bg-rose-500 ring-2 ring-surface', className)}>
      {n > 9 ? '9+' : n}
    </span>
  )
}

/**
 * Barra inferior del móvil: 4 destinos principales + «Más», que abre un panel con el resto.
 * El destino activo lleva una píldora de color detrás del icono.
 */
export default function MobileNav({ principales, resto, unread, perfil, onPrefetch }: {
  principales: ItemMovil[]
  resto: ItemMovil[]
  unread: UnreadCounts
  perfil: { nombre: string; avatarUrl: string | null; rol: string }
  onPrefetch: (to: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Cerrar el panel al cambiar de ruta o con Escape
  useEffect(() => { setAbierto(false) }, [location.pathname])
  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto])

  const cuenta = (k?: keyof UnreadCounts) => (k ? (unread[k] as number) ?? 0 : 0)
  const enResto = resto.some(i => location.pathname.startsWith(i.to)) || location.pathname.startsWith('/profile')
  const pendientesResto = resto.reduce((s, i) => s + cuenta(i.badgeKey), 0)
  const inicial = (perfil.nombre[0] ?? 'U').toUpperCase()

  return (
    <>
      {/* Panel «Más» */}
      {abierto && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 motion-safe:animate-fade-in" onClick={() => setAbierto(false)}
            style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(6px)' }} />
          <div role="dialog" aria-modal="true" aria-label="Más secciones"
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface border-t border-ov/[0.08] shadow-modal motion-safe:animate-slide-in-bottom
              pb-[calc(76px+env(safe-area-inset-bottom))] px-4 pt-3">
            <div className="w-9 h-1 mx-auto mb-3 rounded-full bg-ov/[0.15]" aria-hidden="true" />

            {/* Perfil */}
            <button onClick={() => navigate('/profile')}
              className={cn('w-full flex items-center gap-3 p-3 rounded-2xl bg-ov/[0.04] hover:bg-ov/[0.07] transition-colors text-left', FOCO)}>
              {perfil.avatarUrl
                ? <img src={perfil.avatarUrl} alt="" className="w-11 h-11 rounded-xl object-cover" />
                : <span className="w-11 h-11 rounded-xl flex items-center justify-center font-bold bg-primary/15 text-primary-light" aria-hidden="true">{inicial}</span>}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-text-primary truncate">{perfil.nombre}</span>
                <span className="block text-xs text-text-muted">Ver y editar tu perfil · {perfil.rol}</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className="text-text-muted" />
            </button>

            <ul className="mt-3 grid grid-cols-3 gap-2">
              {resto.map(({ to, label, Icon, badgeKey, desc }) => {
                const n = cuenta(badgeKey)
                return (
                  <li key={to}>
                    <NavLink to={to} onTouchStart={() => onPrefetch(to)}
                      className={({ isActive }) => cn(
                        'relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3.5 text-center transition-colors',
                        isActive ? 'bg-primary/[0.12] text-primary-light' : 'bg-ov/[0.03] text-text-secondary hover:bg-ov/[0.06]',
                        FOCO,
                      )}>
                      <Icon size={22} aria-hidden="true" />
                      <span className="text-xs font-semibold leading-tight">{label}</span>
                      {desc && <span className="text-[10px] leading-tight text-text-muted">{desc}</span>}
                      <Insignia n={n} className="absolute top-2 right-2" />
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Barra */}
      <nav aria-label="Navegación principal"
        className="md:hidden fixed bottom-0 inset-x-0 z-[70] bg-surface/95 backdrop-blur-xl border-t border-ov/[0.08]
          shadow-[0_-6px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-6px_24px_rgba(0,0,0,0.45)] pb-[env(safe-area-inset-bottom)]">
        <ul className="flex items-stretch h-16 px-1.5">
          {principales.map(({ to, label, Icon, badgeKey }) => {
            const n = cuenta(badgeKey)
            const dm = to === '/chat' ? unread.dmSenders : []
            return (
              <li key={to} className="flex-1 min-w-0">
                <NavLink to={to} end={to === '/'} onTouchStart={() => onPrefetch(to)}
                  aria-label={n > 0 ? `${label}, ${n} sin leer` : label}
                  className={({ isActive }) => cn(
                    'group h-full flex flex-col items-center justify-center gap-1 select-none',
                    isActive && !abierto ? 'text-primary-light' : 'text-text-muted', FOCO, 'focus-visible:ring-offset-0 rounded-xl')}>
                  {({ isActive }) => {
                    const activo = isActive && !abierto
                    return (
                      <>
                        <span className={cn('relative flex items-center justify-center w-14 h-8 rounded-full transition-colors duration-200',
                          activo ? 'bg-primary/15' : 'group-active:bg-ov/[0.06]')}>
                          <Icon size={21} strokeWidth={activo ? 2.4 : 2} aria-hidden="true" />
                          <Insignia n={n} className="absolute -top-1 right-1.5" />
                        </span>
                        <span className={cn('text-[10.5px] leading-none truncate max-w-full px-1', activo ? 'font-bold' : 'font-medium')}>
                          {dm.length > 0 && !activo ? dm[0] : label}
                        </span>
                      </>
                    )
                  }}
                </NavLink>
              </li>
            )
          })}
          <li className="flex-1 min-w-0">
            <button onClick={() => setAbierto(v => !v)} aria-expanded={abierto} aria-label={abierto ? 'Cerrar menú' : 'Más secciones'}
              className={cn('group w-full h-full flex flex-col items-center justify-center gap-1 select-none rounded-xl',
                abierto || enResto ? 'text-primary-light' : 'text-text-muted', FOCO, 'focus-visible:ring-offset-0')}>
              <span className={cn('relative flex items-center justify-center w-14 h-8 rounded-full transition-colors duration-200',
                abierto || enResto ? 'bg-primary/15' : 'group-active:bg-ov/[0.06]')}>
                {abierto ? <X size={21} strokeWidth={2.4} aria-hidden="true" /> : <LayoutGrid size={21} strokeWidth={enResto ? 2.4 : 2} aria-hidden="true" />}
                {!abierto && <Insignia n={pendientesResto} className="absolute -top-1 right-1.5" />}
              </span>
              <span className={cn('text-[10.5px] leading-none', abierto || enResto ? 'font-bold' : 'font-medium')}>Más</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
