import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home, Newspaper, MessageCircle, FolderOpen, Calendar, Shield,
  GraduationCap, ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useUnreadCounts, type UnreadCounts } from '../hooks/useUnreadCounts'
import AnuncioModal from './AnuncioModal'
import PrivateMessageToast from './PrivateMessageToast'
import ActivityToast from './ActivityToast'
import StarField from './StarField'

const ROUTE_PREFETCH: Record<string, () => Promise<unknown>> = {
  '/':            () => import('../pages/Home'),
  '/news':        () => import('../pages/News'),
  '/chat':        () => import('../pages/Chat'),
  '/apuntes':     () => import('../pages/Apuntes'),
  '/actividades': () => import('../pages/Actividades'),
  '/calendar':    () => import('../pages/Calendar'),
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
  { to: '/chat',        label: 'Chat',        Icon: MessageCircle, badgeKey: 'chat'        },
  { to: '/apuntes',     label: 'Apuntes',     Icon: FolderOpen     },
  { to: '/actividades', label: 'Actividades', Icon: ClipboardCheck, badgeKey: 'actividades' },
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
        className="hidden md:flex flex-col shrink-0 transition-all duration-300"
        style={{
          width: sidebarWidth,
          background: 'var(--color-nav-glass)',
          borderRight: '1px solid var(--color-nav-border)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Logo — clickable to expand/collapse */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 flex items-center gap-3 px-4 h-[56px] w-full transition-colors duration-150 hover:bg-white/[0.03]"
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-primary"
            style={{ boxShadow: '0 2px 10px rgba(85,239,196,0.35)' }}
          >
            <img src="/logo.svg" alt="" className="w-8 h-8 rounded-lg" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            <GraduationCap size={16} className="text-white absolute" style={{ display: 'none' }} aria-hidden />
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
            const count = badgeKey ? (unread[badgeKey] ?? 0) : 0
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    isActive ? 'text-primary-light' : 'text-text-muted hover:text-text-secondary'
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive ? 'rgba(85,239,196,0.10)' : 'transparent',
                } as React.CSSProperties)}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  if (!el.classList.contains('text-primary-light')) el.style.background = 'var(--overlay-04)'
                  const cancel = schedulePrefetch(to)
                  ;(el as HTMLElement & { _cancelPrefetch?: () => void })._cancelPrefetch = cancel
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  if (!el.classList.contains('text-primary-light')) el.style.background = 'transparent'
                  ;(el as HTMLElement & { _cancelPrefetch?: () => void })._cancelPrefetch?.()
                }}
              >
                {({ isActive }) => (
                  <>
                    {/* Active indicator bar */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                        style={{
                          width: 3,
                          height: '60%',
                          background: 'linear-gradient(180deg, #55efc4, #00cec9)',
                          boxShadow: '0 0 8px rgba(85,239,196,0.4)',
                        }}
                      />
                    )}
                    <div className="relative shrink-0">
                      <Icon size={20} />
                      {count > 0 && !expanded && (
                        <span
                          className="absolute -top-1 -right-1.5 flex items-center justify-center text-[9px] font-bold text-white rounded-full"
                          style={{
                            minWidth: 14,
                            height: 14,
                            padding: '0 3px',
                            background: 'linear-gradient(135deg, #ff6b6b, #ee5a6f)',
                            boxShadow: '0 1px 4px rgba(238,90,111,0.35)',
                          }}
                        >
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </div>
                    {expanded && (
                      <span className="text-xs font-medium whitespace-nowrap flex-1">{label}</span>
                    )}
                    {count > 0 && expanded && (
                      <span
                        className="flex items-center justify-center text-[10px] font-bold rounded-full text-white"
                        style={{
                          minWidth: 16,
                          height: 16,
                          padding: '0 4px',
                          background: 'linear-gradient(135deg, #ff6b6b, #ee5a6f)',
                          boxShadow: '0 1px 4px rgba(238,90,111,0.35)',
                        }}
                      >
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
        <div className="shrink-0 p-2 border-t" style={{ borderColor: 'var(--color-nav-border)' }}>
          <NavLink
            to="/profile"
            className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-all duration-200 ${
              isProfile ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
            }`}
            aria-label="Perfil"
          >
            <div className="relative shrink-0">
              {usuario?.avatar_url ? (
                <img
                  src={usuario.avatar_url}
                  alt={usuario.nombre}
                  className="w-8 h-8 rounded-lg object-cover"
                  style={{ border: '1.5px solid rgba(85,239,196,0.3)' }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(85,239,196,0.25), rgba(0,206,201,0.2))',
                    border: '1.5px solid rgba(85,239,196,0.3)',
                    color: '#8ff5d6',
                  }}
                >
                  {initial}
                </div>
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                style={{ background: '#10b981', border: '1.5px solid var(--color-bg)' }}
              />
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
      <main className="relative flex-1 min-h-0 overflow-hidden bg-bg pb-[60px] md:pb-0">
        <StarField />
        {children}
      </main>

      {/* ── Bottom nav — mobile only ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch"
        style={{
          background: 'var(--color-nav-glass)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--color-nav-border)',
          boxShadow: 'var(--shadow-nav-bottom)',
          height: '60px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {items.map(({ to, label, Icon, badgeKey }) => {
          const count = badgeKey ? (unread[badgeKey] ?? 0) : 0
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 relative ${
                  isActive ? 'text-primary-light' : 'text-text-muted'
                }`
              }
              onTouchStart={() => { schedulePrefetch(to) }}
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon size={20} />
                    {count > 0 && (
                      <span
                        className="absolute -top-1.5 -right-2 flex items-center justify-center text-[8px] font-bold text-white rounded-full"
                        style={{
                          minWidth: 13,
                          height: 13,
                          padding: '0 3px',
                          background: 'linear-gradient(135deg, #ff6b6b, #ee5a6f)',
                          boxShadow: '0 1px 4px rgba(238,90,111,0.35)',
                        }}
                      >
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-medium leading-none">{label}</span>
                  {isActive && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: '24px', height: '2px', background: '#8ff5d6' }}
                    />
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
