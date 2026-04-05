import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Users, RefreshCw, Settings, GraduationCap, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Usuario } from '../lib/types'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

function gradeColor(n: number) {
  if (n >= 8) return '#10b981'
  if (n >= 6) return '#f59e0b'
  return '#f43f5e'
}

function AdminSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SkeletonBox className="h-7 w-36 shimmer" />
        <SkeletonBox className="h-9 w-9 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i} className="flex items-center gap-3 py-5">
              <SkeletonBox className="h-10 w-10 shrink-0 shimmer rounded-xl" />
              <div className="flex flex-col gap-2">
                <SkeletonBox className="h-6 w-10 shimmer" />
                <SkeletonBox className="h-3 w-16 shimmer" />
              </div>
            </SkeletonCard>
          ))}
        </div>
        <SkeletonCard className="p-0 overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <SkeletonBox className="h-5 w-24 shimmer" />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <SkeletonBox className="h-10 w-10 shrink-0 shimmer rounded-xl" />
              <div className="flex-1 flex flex-col gap-2">
                <SkeletonBox className="h-4 w-32 shimmer" />
                <SkeletonBox className="h-3 w-48 shimmer" />
              </div>
              <SkeletonBox className="h-8 w-20 shimmer rounded-xl" />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </div>
  )
}

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

  if (loading) return <AdminSkeleton />

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div
        className="relative px-4 md:px-6 py-5 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
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
            aria-label="Actualizar"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-5">

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Admins */}
          <div
            className="p-4 md:p-5 flex items-center gap-3.5 rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(99,102,241,0.18)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)' }}
            >
              <Shield size={17} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="font-extrabold text-2xl tabular-nums" style={{ color: '#818cf8' }}>
                {admins.length}
              </p>
              <p className="text-xs font-medium uppercase tracking-wider mt-0.5" style={{ color: '#4b5563' }}>
                Admins
              </p>
            </div>
          </div>

          {/* Alumnos */}
          <div
            className="p-4 md:p-5 flex items-center gap-3.5 rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(16,185,129,0.15)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0"
              style={{ background: 'rgba(16,185,129,0.1)' }}
            >
              <Users size={17} style={{ color: '#10b981' }} />
            </div>
            <div>
              <p className="font-extrabold text-2xl tabular-nums" style={{ color: '#10b981' }}>
                {alumnos.length}
              </p>
              <p className="text-xs font-medium uppercase tracking-wider mt-0.5" style={{ color: '#4b5563' }}>
                Alumnos
              </p>
            </div>
          </div>

          {/* Total */}
          <div
            className="p-4 md:p-5 flex items-center gap-3.5 rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0"
              style={{ background: 'rgba(139,92,246,0.12)' }}
            >
              <TrendingUp size={17} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <p className="font-extrabold text-2xl tabular-nums" style={{ color: '#f1f5f9' }}>
                {users.length}
              </p>
              <p className="text-xs font-medium uppercase tracking-wider mt-0.5" style={{ color: '#4b5563' }}>
                Total
              </p>
            </div>
          </div>
        </div>

        {/* ── User table ── */}
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(145deg, #1a1d27, #141720)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Table head */}
          <div
            className="px-5 py-3.5 flex items-center gap-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h2 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>Usuarios</h2>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(99,102,241,0.12)',
                color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            >
              {users.length}
            </span>
          </div>

          {/* User rows */}
          {users.map((u, idx) => (
            <div
              key={u.id}
              className="flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-100"
              style={{
                borderBottom: idx < users.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 shrink-0 overflow-hidden rounded-xl"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt={u.nombre} className="w-9 h-9 object-cover" />
                ) : (
                  <div
                    className="w-9 h-9 flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.12)' }}
                  >
                    <span className="font-bold text-xs" style={{ color: '#818cf8' }}>
                      {u.nombre[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>
                )}
              </div>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm" style={{ color: '#f1f5f9' }}>{u.nombre}</p>
                  {u.id === usuario?.id && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(99,102,241,0.1)',
                        color: '#818cf8',
                        border: '1px solid rgba(99,102,241,0.2)',
                      }}
                    >
                      Tú
                    </span>
                  )}
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: '#4b5563' }}>{u.email}</p>
              </div>

              {/* Promedio */}
              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-lg tabular-nums"
                  style={{
                    color: gradeColor(u.promedio),
                    background: `${gradeColor(u.promedio)}12`,
                    border: `1px solid ${gradeColor(u.promedio)}22`,
                  }}
                >
                  {u.promedio.toFixed(1)}
                </span>
              </div>

              {/* Role toggle */}
              <div className="flex items-center shrink-0">
                {updating === u.id ? (
                  <div
                    className="w-6 h-6 rounded-full animate-spin"
                    style={{ border: '1.5px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }}
                  />
                ) : (
                  <button
                    onClick={() => { if (u.id !== usuario?.id) toggleRol(u) }}
                    disabled={u.id === usuario?.id}
                    title={u.id === usuario?.id ? 'No puedes cambiar tu propio rol' : `Cambiar a ${u.rol === 'admin' ? 'alumno' : 'admin'}`}
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
                    onMouseEnter={e => {
                      if (u.id === usuario?.id) return
                      const el = e.currentTarget as HTMLElement
                      el.style.opacity = '0.8'
                      el.style.transform = 'scale(0.97)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.opacity = u.id === usuario?.id ? '0.4' : '1'
                      el.style.transform = 'scale(1)'
                    }}
                  >
                    {u.rol === 'admin' ? (
                      <>
                        <Shield size={10} />
                        Admin
                      </>
                    ) : (
                      <>
                        <GraduationCap size={10} />
                        Alumno
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      <AlertModal
        visible={alert !== null}
        type={alert?.type}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
        onClose={() => setAlert(null)}
        onConfirm={alert?.onConfirm}
        confirmLabel={alert?.confirmLabel}
        confirmDestructive={alert?.confirmDestructive}
      />
    </div>
  )
}
