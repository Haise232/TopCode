import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home, Newspaper, MessageCircle, FolderOpen, Calendar, Shield,
  GraduationCap, ClipboardCheck, BookOpen,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useUnreadCounts, type UnreadCounts } from '../hooks/useUnreadCounts'
import AnuncioModal from './AnuncioModal'
import PrivateMessageToast from './PrivateMessageToast'
import ActivityToast from './ActivityToast'
import Pattern from './Pattern'
import { cn } from './ui/cn'

const ROUTE_PREFETCH: Record<string, () => Promise<unknown>> = {
  '/':            () => import('../pages/Home'),
  '/news':        () => import('../pages/News'),
  '/chat':        () => import('../pages/Chat'),
  '/apuntes':     () => import('../pages/Apuntes'),
  '/actividades': () => import('../pages/Actividades'),
  '/calendar':    () => import('../pages/Calendar'),
  '/notas':       () => import('../pages/Notas'),
  '/admin':       () => import('../pages/Admin'),
  '/profile':     () => import('../pages/Profile'),
}

function schedulePrefetch(to: string): () => void {
  const id = setTimeout(() => { ROUTE_PREFETCH[to]?.() }, 100)
  return () => clearTimeout(id)
}

type NavItem = { to: string; label: string; Icon: React.ElementType; badgeKey?: keyof UnreadCounts }

const NAV_ITEMS: NavItem[] = [
  { to: '/',            label: 'Inicio',      Icon: Home           },
  { to: '/news',        label: 'News',        Icon: Newspaper,     badgeKey: 'news'        },
  { to: '/chat',        label: 'Chat',        Icon: MessageCircle, badgeKey: 'dm'          },
  { to: '/apuntes',     label: 'Apuntes',     Icon: FolderOpen     },
  { to: '/actividades', label: 'Actividades', Icon: ClipboardCheck, badgeKey: 'actividades' },
  { to: '/notas',       label: 'Notas',       Icon: BookOpen       },
  { to: '/calendar',    label: 'Eventos',     Icon: Calendar       },
]

const ADMIN_ITEM: NavItem = { to: '/admin', label: 'Admin', Icon: Shield }

export default function Layout({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS
  const [expanded, setExpanded] = useState(false)
  const location = useLocation()
  const unread = useUnreadCounts()

  const initial = (usuario?.nombre?.[0] ?? 'U').toUpperCase()
  const isProfile = location.pathname === '/profile'

  const sidebarWidth = expanded ? 180 : 72

  return (
    <div className="flex h-screen bg-bg">

      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 transition-all duration-300",
          "bg-surface/95 backdrop-blur-xl border-r border-white/10"
        )}
        style={{ width: sidebarWidth }}
      >
        {/* Logo — clickable to expand/collapse */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 flex items-center gap-3 px-4 h-14 w-full transition-colors duration-150 hover:bg-white/[0.03]"
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-primary to-cyan-400 shadow-[0_2px_10px_rgba(85,239,196,0.35)]">
            <img src="/logo.svg" alt="" className="w-8 h-8 rounded-lg" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            <GraduationCap size={16} className="text-white absolute hidden" aria-hidden />
          </div>
          {expanded && (
            <span className="font-bold text-sm tracking-tight text-text-primary whitespace-nowrap">
              Top<span className="text-primary-light">Code</span>
            </span>
          )}
        </button>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
          {items.map(({ to, label, Icon, badgeKey }) => {
            const count = badgeKey ? (unread[badgeKey] as number ?? 0) : 0
            const isDmItem = badgeKey === 'dm'
            const dmSenders = isDmItem ? unread.dmSenders : []
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                    isActive
                      ? "text-primary-light bg-primary/10"
                      : "text-text-muted hover:text-text-secondary hover:bg-white/5"
                  )
                }
                onMouseEnter={e => {
                  const cancel = schedulePrefetch(to)
                  ;(e.currentTarget as HTMLElement & { _cancelPrefetch?: () => void })._cancelPrefetch = cancel
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement & { _cancelPrefetch?: () => void })._cancelPrefetch?.()
                }}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full w-[3px] h-[60%] bg-gradient-to-b from-primary to-cyan-400 shadow-[0_0_8px_rgba(85,239,196,0.4)]" />
                    )}
                    <div className="relative shrink-0">
                      <Icon size={20} />
                      {count > 0 && !expanded && (
                        <span className="absolute -top-1 -right-1.5 flex items-center justify-center text-[9px] font-bold text-white rounded-full min-w-3.5 h-3.5 px-[3px] bg-gradient-to-br from-rose-400 to-rose-600 shadow-[0_1px_4px_rgba(238,90,111,0.35)]">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </div>
                    {expanded && (
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-xs font-medium whitespace-nowrap">{label}</span>
                        {isDmItem && dmSenders.length > 0 && (
                          <span className="text-[9px] font-semibold truncate" style={{ color: '#8ff5d6', lineHeight: 1.2 }}>
                            {dmSenders.length === 1
                              ? dmSenders[0]
                              : `${dmSenders[0]} +${dmSenders.length - 1}`}
                          </span>
                        )}
                      </div>
                    )}
                    {count > 0 && expanded && (
                      <span className="flex items-center justify-center text-[10px] font-bold rounded-full text-white min-w-4 h-4 px-1 bg-gradient-to-br from-rose-400 to-rose-600 shadow-[0_1px_4px_rgba(238,90,111,0.35)]">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Profile at bottom */}
        <div className="shrink-0 p-2 border-t border-white/10">
          <NavLink
            to="/profile"
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-xl transition-all duration-200",
              isProfile ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
            )}
            aria-label="Perfil"
          >
            <div className="relative shrink-0">
              {usuario?.avatar_url ? (
                <img
                  src={usuario.avatar_url}
                  alt={usuario.nombre}
                  className="w-8 h-8 rounded-lg object-cover border-[1.5px] border-primary/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-gradient-to-br from-primary/25 to-cyan-400/20 border-[1.5px] border-primary/30 text-primary-light">
                  {initial}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-[1.5px] border-bg" />
            </div>
            {expanded && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate text-text-primary">{usuario?.nombre}</span>
                <span className="text-[10px] text-text-muted">{isAdmin ? 'Admin' : 'Alumno'}</span>
              </div>
            )}
          </NavLink>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="relative flex-1 min-h-0 overflow-hidden pb-[60px] md:pb-0">
        <Pattern />
        <div className="relative z-10 h-full">
          {children}
        </div>
      </main>

      {/* ── Bottom nav — mobile only ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch bg-surface/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] h-[60px] pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, Icon, badgeKey }) => {
          const count = badgeKey ? (unread[badgeKey] as number ?? 0) : 0
          const isDmItem = badgeKey === 'dm'
          const dmSenders = isDmItem ? unread.dmSenders : []
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 relative",
                  isActive ? "text-primary-light" : "text-text-muted"
                )
              }
              onTouchStart={() => { schedulePrefetch(to) }}
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon size={20} />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex items-center justify-center text-[8px] font-bold text-white rounded-full min-w-3 h-3 px-[3px] bg-gradient-to-br from-rose-400 to-rose-600 shadow-[0_1px_4px_rgba(238,90,111,0.35)]">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </div>
                  {isDmItem && dmSenders.length > 0 && !isActive ? (
                    <span className="text-[8px] font-semibold leading-none truncate max-w-[52px]" style={{ color: '#8ff5d6' }}>
                      {dmSenders[0]}{dmSenders.length > 1 ? ` +${dmSenders.length - 1}` : ''}
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium leading-none">{label}</span>
                  )}
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full w-6 h-0.5 bg-primary-light" />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Modal de anuncios */}
      <AnuncioModal />

      {/* Toast de mensaje privado */}
      <PrivateMessageToast />

      {/* Toast de nueva actividad */}
      <ActivityToast />
    </div>
  )
}
