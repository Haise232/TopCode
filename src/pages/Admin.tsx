import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Users, RefreshCw, Settings, GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Usuario } from '../lib/types'
import AlertModal from '../components/AlertModal'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

export default function Admin() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .order('nombre')
    if (data) setUsers(data as Usuario[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (usuario && usuario.rol !== 'admin') {
      navigate('/', { replace: true })
      return
    }
    cargar()
  }, [cargar, usuario, navigate])

  function toggleRol(u: Usuario) {
    const newRol: 'alumno' | 'admin' = u.rol === 'admin' ? 'alumno' : 'admin'
    const accion = newRol === 'admin'
      ? `dar rol de administrador a ${u.nombre}`
      : `quitar el rol de administrador a ${u.nombre}`
    setAlert({
      title: 'Cambiar rol',
      message: `¿Seguro que quieres ${accion}?`,
      confirmLabel: 'Confirmar',
      onConfirm: async () => {
        setUpdating(u.id)
        const { error } = await supabase
          .from('usuarios')
          .update({ rol: newRol })
          .eq('id', u.id)
        setUpdating(null)
        if (error) {
          setAlert({ type: 'error', title: 'Error', message: 'No se pudo cambiar el rol: ' + error.message })
        } else {
          await cargar()
        }
      },
    })
  }

  const admins  = users.filter(u => u.rol === 'admin')
  const alumnos = users.filter(u => u.rol === 'alumno')

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="relative px-4 md:px-6 py-5 overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Settings size={15} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>Panel Admin</h1>
              <p className="text-xs" style={{ color: '#64748b' }}>Control de accesos y roles</p>
            </div>
          </div>
          <button
            onClick={async () => { setRefreshing(true); await cargar(); setRefreshing(false) }}
            disabled={refreshing}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 flex items-center gap-3 rounded-2xl" style={{ background: '#1a1d27', border: '1px solid rgba(99,102,241,0.18)' }}>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <Shield size={16} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="font-extrabold text-2xl" style={{ color: '#818cf8' }}>{admins.length}</p>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>Admins</p>
            </div>
          </div>

          <div className="p-4 flex items-center gap-3 rounded-2xl" style={{ background: '#1a1d27', border: '1px solid rgba(16,185,129,0.15)' }}>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <Users size={16} style={{ color: '#10b981' }} />
            </div>
            <div>
              <p className="font-extrabold text-2xl" style={{ color: '#10b981' }}>{alumnos.length}</p>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>Alumnos</p>
            </div>
          </div>

          <div className="p-4 flex items-center gap-3 rounded-2xl sm:col-span-1 col-span-2" style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(139,92,246,0.12)' }}>
              <Settings size={16} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <p className="font-extrabold text-2xl" style={{ color: '#f1f5f9' }}>{users.length}</p>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>Total usuarios</p>
            </div>
          </div>
        </div>

        {/* User list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: '#6366f1', animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl" style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Table header */}
            <div className="px-4 py-3 flex items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Usuarios</h2>
              <span
                className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                {users.length}
              </span>
            </div>

            {users.map((u, idx) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors"
                style={{ borderBottom: idx < users.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {/* Avatar */}
                <div className="w-10 h-10 shrink-0 overflow-hidden rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.nombre} className="w-10 h-10 object-cover" />
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                      <span className="font-bold text-sm" style={{ color: '#818cf8' }}>
                        {u.nombre[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm" style={{ color: '#f1f5f9' }}>{u.nombre}</p>
                    {u.id === usuario?.id && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                      >
                        Tú
                      </span>
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: '#64748b' }}>{u.email}</p>
                </div>

                {/* Promedio */}
                <div className="hidden sm:block shrink-0">
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-lg"
                    style={{
                      color: u.promedio >= 8 ? '#10b981' : u.promedio >= 6 ? '#f59e0b' : '#f43f5e',
                      background: u.promedio >= 8 ? 'rgba(16,185,129,0.1)' : u.promedio >= 6 ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)',
                    }}
                  >
                    {u.promedio.toFixed(1)}
                  </span>
                </div>

                {/* Role toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  {updating === u.id ? (
                    <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '1.5px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
                  ) : (
                    <button
                      onClick={() => { if (u.id !== usuario?.id) toggleRol(u) }}
                      disabled={u.id === usuario?.id}
                      title={u.id === usuario?.id ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-150"
                      style={u.rol === 'admin' ? {
                        background: 'rgba(99,102,241,0.12)',
                        color: '#818cf8',
                        border: '1px solid rgba(99,102,241,0.25)',
                        cursor: u.id === usuario?.id ? 'not-allowed' : 'pointer',
                        opacity: u.id === usuario?.id ? 0.4 : 1,
                      } : {
                        background: 'rgba(255,255,255,0.05)',
                        color: '#64748b',
                        border: '1px solid rgba(255,255,255,0.08)',
                        cursor: u.id === usuario?.id ? 'not-allowed' : 'pointer',
                        opacity: u.id === usuario?.id ? 0.4 : 1,
                      }}
                    >
                      {u.rol === 'admin' ? (
                        <>
                          <Shield size={11} />
                          Admin
                        </>
                      ) : (
                        <>
                          <GraduationCap size={11} />
                          Alumno
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertModal
        visible={alert !== null}
        type={alert?.type}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
        onConfirm={alert?.onConfirm}
        confirmLabel={alert?.confirmLabel}
        confirmDestructive={alert?.confirmDestructive}
      />
    </div>
  )
}
