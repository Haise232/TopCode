import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useBellSound } from '../hooks/useBellSound'
import { onBroadcast, type EventoCalendario } from '@topcode/shared'
import { ToastActividad } from './chat/Toasts'

const RUTA_ACTIVIDADES = '/calendar?vista=actividades'

export default function ActivityToast() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useNotifications()
  const playBell = useBellSound()
  const miId = usuario?.id
  const miClase = usuario?.clase

  const [toast, setToast] = useState<EventoCalendario | null>(null)
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

  const show = useCallback((item: EventoCalendario) => {
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
    if (!miId) return

    return onBroadcast('eventos', 'INSERT', (item: EventoCalendario) => {
      if (item.tipo !== 'actividad' && item.tipo !== 'trabajo') return
      if (item.clase && miClase && item.clase !== miClase) return

      notify('Nueva actividad en TopCode', {
        body: `${item.titulo}`,
        icon: '/favicon.png',
        tag: `act-${item.id}`,
        onClick: () => navigate(RUTA_ACTIVIDADES),
      })

      if (pathnameRef.current.startsWith('/calendar') && window.location.search.includes('vista=actividades')) return
      show(item)
    })
  }, [miId, miClase, show, notify, navigate])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!toast) return null

  return (
    <ToastActividad
      titulo={toast.titulo}
      detalle={`${toast.materia ? `${toast.materia} — ` : ''}${toast.fecha}`}
      visible={visible}
      onCerrar={dismiss}
      onVer={() => { navigate(RUTA_ACTIVIDADES); dismiss() }}
    />
  )
}
