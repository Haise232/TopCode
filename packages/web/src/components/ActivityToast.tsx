import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ClipboardCheck, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useBellSound } from '../hooks/useBellSound'
import { Actividad } from '@topcode/shared'

export default function ActivityToast() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useNotifications()
  const playBell = useBellSound()

  const [toast, setToast] = useState<Actividad | null>(null)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathnameRef = useRef(location.pathname)

  useEffect(() => {
    pathnameRef.current = location.pathname
  }, [location.pathname])

  const dismiss = useCallback(() => {
    setVisible(false)
    setTimeout(() => setToast(null), 300)
  }, [])

  const show = useCallback((item: Actividad) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(item)
    setVisible(true)
    playBell()
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => setToast(null), 300)
    }, 6000)
  }, [playBell])

  useEffect(() => {
    if (!usuario) return

    const channel = supabase
      .channel('activity-toast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'actividades' },
        payload => {
          const item = payload.new as Actividad

          notify('Nueva actividad en TopCode', {
            body: `${item.titulo}`,
            icon: '/favicon.png',
            tag: `act-${item.id}`,
            onClick: () => navigate('/actividades'),
          })

          if (pathnameRef.current.startsWith('/actividades')) return
          show(item)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [usuario?.id, show, notify, navigate])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!toast) return null

  return (
    <div
      className="fixed bottom-[76px] right-4 z-[9998] md:bottom-5"
      style={{
        transition: 'opacity 300ms ease, transform 300ms ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="flex items-center gap-3 pr-3 pl-3 py-3 rounded-2xl shadow-lg"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px var(--color-border)',
          maxWidth: '280px',
        }}
      >
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(85,239,196,0.25), rgba(0,206,201,0.2))',
            border: '1.5px solid rgba(85,239,196,0.3)',
          }}
        >
          <ClipboardCheck size={16} style={{ color: '#55efc4' }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#55efc4' }}>
              Nueva actividad
            </span>
          </div>
          <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--color-text)' }}>
            {toast.titulo}
          </p>
          <p className="text-[10px] leading-snug mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {toast.materia} — {toast.fecha_entrega}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={dismiss}
            className="w-5 h-5 flex items-center justify-center rounded-md transition-all duration-150"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Cerrar"
          >
            <X size={11} />
          </button>
          <button
            onClick={() => { navigate('/actividades'); dismiss() }}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-lg transition-all duration-150"
            style={{
              background: 'rgba(85,239,196,0.15)',
              color: '#55efc4',
              border: '1px solid rgba(85,239,196,0.25)',
            }}
          >
            Ver
          </button>
        </div>
      </div>
    </div>
  )
}
