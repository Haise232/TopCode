import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, ClipboardList, MessageCircle, FolderOpen, Calendar, Shield, LogOut,
  GraduationCap,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const NAV_ITEMS = [
  { to: '/',         label: 'Inicio',   Icon: Home          },
  { to: '/notes',    label: 'Notas',    Icon: ClipboardList },
  { to: '/chat',     label: 'Chat',     Icon: MessageCircle },
  { to: '/apuntes',  label: 'Apuntes',  Icon: FolderOpen    },
  { to: '/calendar', label: 'Eventos',  Icon: Calendar      },
]

const ADMIN_ITEM = { to: '/admin', label: 'Admin', Icon: Shield }

export default function Layout({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const isAdmin = usuario?.rol === 'admin'
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initial = (usuario?.nombre?.[0] ?? 'U').toUpperCase()

  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* ── Top navbar ── */}
      <nav
        className="z-50 shrink-0"
        style={{
          background: 'rgba(15, 17, 23, 0.96)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.03), 0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div className="max-w-[1100px] mx-auto px-4 md:px-6 h-[58px] flex items-center gap-4">

          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 mr-2 shrink-0 group">
            <img
              src="/logo.svg"
              alt="TopCode"
              className="w-8 h-8 transition-all duration-200 group-hover:scale-105"
              style={{ borderRadius: '10px', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}
            />
            <span className="hidden md:block font-bold text-sm" style={{ color: '#f1f5f9' }}>
              Top<span style={{ color: '#818cf8' }}>Code</span>
            </span>
          </NavLink>

          {/* Divider */}
          <div className="hidden md:block w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Nav links */}
          <div className="flex items-center gap-0.5 flex-1">
            {items.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-200 rounded-lg ${
                    isActive
                      ? 'text-primary-light'
                      : 'text-text-muted hover:text-slate-300 hover:bg-white/[0.04]'
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'rgba(99,102,241,0.1)',
                } : {}}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={14} />
                    <span className="hidden sm:block">{label}</span>
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4/5 rounded-full"
                        style={{ background: 'linear-gradient(90deg, transparent, #6366f1, transparent)' }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Right: profile + logout */}
          <div className="flex items-center gap-1.5 shrink-0">
            <NavLink
              to="/profile"
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-200 hover:bg-white/[0.04]"
            >
              {/* Avatar */}
              <div className="relative">
                {usuario?.avatar_url ? (
                  <img
                    src={usuario.avatar_url}
                    alt={usuario.nombre}
                    className="w-7 h-7 rounded-lg object-cover"
                    style={{ border: '1.5px solid rgba(99,102,241,0.35)' }}
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                      border: '1.5px solid rgba(99,102,241,0.35)',
                      color: '#818cf8',
                    }}
                  >
                    {initial}
                  </div>
                )}
                {/* Online dot */}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{
                    background: '#10b981',
                    border: '1.5px solid #0f1117',
                  }}
                />
              </div>
              <span className="hidden md:block text-xs font-medium max-w-[110px] truncate" style={{ color: '#94a3b8' }}>
                {usuario?.nombre}
              </span>
            </NavLink>

            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200"
              style={{ color: '#64748b' }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = '#f43f5e'
                el.style.background = 'rgba(244,63,94,0.08)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.color = '#64748b'
                el.style.background = 'transparent'
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto bg-bg">
        {children}
      </main>
    </div>
  )
}
