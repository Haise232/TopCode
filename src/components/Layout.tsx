import { NavLink } from 'react-router-dom'
import {
  Home, ClipboardList, MessageCircle, FolderOpen, Calendar, Shield,
  GraduationCap, ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import AnuncioModal from './AnuncioModal'
import PrivateMessageToast from './PrivateMessageToast'

const NAV_ITEMS = [
  { to: '/',            label: 'Inicio',      Icon: Home           },
  { to: '/notes',       label: 'Notas',       Icon: ClipboardList  },
  { to: '/chat',        label: 'Chat',        Icon: MessageCircle  },
  { to: '/apuntes',     label: 'Apuntes',     Icon: FolderOpen     },
  { to: '/actividades', label: 'Actividades', Icon: ClipboardCheck },
  { to: '/calendar',    label: 'Eventos',     Icon: Calendar       },
]

const ADMIN_ITEM = { to: '/admin', label: 'Admin', Icon: Shield }

export default function Layout({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS

  const initial = (usuario?.nombre?.[0] ?? 'U').toUpperCase()

  return (
    <div className="flex flex-col h-screen bg-bg">

      {/* ── Top navbar ── */}
      <nav
        className="z-50 shrink-0"
        style={{
          background: 'rgba(13, 15, 22, 0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.025), 0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        <div className="max-w-[1100px] mx-auto px-4 md:px-6 h-[56px] flex items-center gap-3">

          {/* Logo */}
          <NavLink
            to="/"
            className="flex items-center gap-2.5 mr-1 shrink-0 group"
            aria-label="TopCode — Inicio"
          >
            <div
              className="relative w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 2px 10px rgba(99,102,241,0.4)',
              }}
            >
              <img
                src="/logo.svg"
                alt=""
                className="w-7 h-7"
                style={{ borderRadius: '8px' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
              <GraduationCap size={14} className="text-white absolute" style={{ display: 'none' }} aria-hidden />
            </div>
            <span className="hidden md:block font-bold text-sm tracking-tight" style={{ color: '#f1f5f9' }}>
              Top<span style={{ color: '#818cf8' }}>Code</span>
            </span>
          </NavLink>

          {/* Separator — desktop only */}
          <div className="hidden md:block w-px h-4 shrink-0" style={{ background: 'rgba(255,255,255,0.07)' }} />

          {/* Nav links — desktop only */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 min-w-0">
            {items.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                    isActive ? 'text-primary-light' : 'text-text-muted hover:text-slate-300'
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'rgba(99,102,241,0.12)',
                  boxShadow: 'inset 0 1px 0 rgba(99,102,241,0.1)',
                } : {}}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  if (!el.classList.contains('text-primary-light')) el.style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  if (!el.classList.contains('text-primary-light')) el.style.background = 'transparent'
                }}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={14} />
                    <span>{label}</span>
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                        style={{ width: '60%', background: 'linear-gradient(90deg, transparent, #818cf8, transparent)' }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Spacer on mobile so profile sits right */}
          <div className="flex-1 md:hidden" />

          {/* Profile — always visible */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-200 shrink-0 ${
                isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
              }`
            }
            aria-label="Perfil"
          >
            <div className="relative shrink-0">
              {usuario?.avatar_url ? (
                <img
                  src={usuario.avatar_url}
                  alt={usuario.nombre}
                  className="w-7 h-7 rounded-lg object-cover"
                  style={{ border: '1.5px solid rgba(99,102,241,0.3)' }}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))',
                    border: '1.5px solid rgba(99,102,241,0.3)',
                    color: '#818cf8',
                  }}
                >
                  {initial}
                </div>
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                style={{ background: '#10b981', border: '1.5px solid #0d0f16' }}
              />
            </div>
            <span className="hidden md:block text-xs font-medium max-w-[100px] truncate" style={{ color: '#94a3b8' }}>
              {usuario?.nombre}
            </span>
          </NavLink>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="flex-1 min-h-0 overflow-hidden bg-bg pb-[60px] md:pb-0">
        {children}
      </main>

      {/* ── Bottom nav — mobile only ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch"
        style={{
          background: 'rgba(13,15,22,0.97)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
          height: '60px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 relative"
            style={({ isActive }) => ({
              color: isActive ? '#818cf8' : '#4b5563',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={20} />
                <span className="text-[9px] font-medium leading-none">{label}</span>
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                    style={{ width: '24px', height: '2px', background: '#818cf8' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Modal de anuncios */}
      <AnuncioModal />

      {/* Toast de mensaje privado */}
      <PrivateMessageToast />
    </div>
  )
}
