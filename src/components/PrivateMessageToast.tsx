import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { MensajePrivado } from '../lib/types'

function getHue(nombre: string) {
  return nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
}

export default function PrivateMessageToast() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { requestPermission, notify } = useNotifications()

  const [toast, setToast] = useState<MensajePrivado | null>(null)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathnameRef = useRef(location.pathname)

  // Solicitar permiso de notificaciones en cuanto el usuario está autenticado
  useEffect(() => {
    if (!usuario) return
    requestPermission()
  }, [usuario?.id, requestPermission])

  // Mantener pathnameRef actualizado sin re-suscribir el canal
  useEffect(() => {
    pathnameRef.current = location.pathname
  }, [location.pathname])

  const dismiss = useCallback(() => {
    setVisible(false)
    setTimeout(() => setToast(null), 300)
  }, [])

  const show = useCallback((msg: MensajePrivado) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(msg)
    setVisible(true)
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => setToast(null), 300)
    }, 5000)
  }, [])

  useEffect(() => {
    if (!usuario) return

    const uid = usuario.id

    const channel = supabase
      .channel(`private-msg-toast-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes_privados', filter: `para_id=eq.${uid}` },
        payload => {
          const msg = payload.new as MensajePrivado
          // No notificar mensajes propios (por si acaso)
          if (msg.de_id === uid) return

          const preview = msg.texto.length > 60 ? msg.texto.slice(0, 60) + '…' : msg.texto

          // Notificación del navegador cuando la pestaña no está visible
          notify(`💬 ${msg.de_nombre}`, {
            body: preview,
            icon: '/favicon.png',
            tag: `pm-${msg.de_id}`,
            onClick: () => navigate('/chat'),
          })

          // Toast en app solo si no está en /chat
          if (pathnameRef.current.startsWith('/chat')) return
          show(msg)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [usuario?.id, show, notify, navigate])

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!toast) return null

  const hue = getHue(toast.de_nombre)
  const preview = toast.texto.length > 40 ? toast.texto.slice(0, 40) + '…' : toast.texto

  return (
    <div
      className="fixed bottom-[76px] left-4 z-[9998] md:bottom-5"
      style={{
        transition: 'opacity 300ms ease, transform 300ms ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(-110%)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="flex items-center gap-3 pr-3 pl-3 py-3 rounded-2xl shadow-lg"
        style={{
          background: 'rgba(20, 22, 34, 0.97)',
          border: '1px solid rgba(255,255,255,0.09)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          maxWidth: '280px',
        }}
      >
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 text-sm"
          style={{
            background: `hsla(${hue}, 55%, 18%, 0.95)`,
            border: `1.5px solid hsla(${hue}, 55%, 38%, 0.35)`,
            color: `hsla(${hue}, 75%, 72%, 1)`,
          }}
        >
          {toast.de_nombre[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MessageCircle size={10} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#818cf8' }}>
              Mensaje privado
            </span>
          </div>
          <p className="text-xs font-semibold leading-tight truncate" style={{ color: '#f1f5f9' }}>
            {toast.de_nombre}
          </p>
          <p className="text-xs leading-snug mt-0.5" style={{ color: '#64748b' }}>
            {preview}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={dismiss}
            className="w-5 h-5 flex items-center justify-center rounded-md transition-all duration-150 hover:bg-white/[0.08]"
            style={{ color: '#4b5563' }}
            aria-label="Cerrar"
          >
            <X size={11} />
          </button>
          <button
            onClick={() => { navigate('/chat'); dismiss() }}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-lg transition-all duration-150"
            style={{
              background: 'rgba(99,102,241,0.15)',
              color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.25)',
            }}
          >
            Abrir
          </button>
        </div>
      </div>
    </div>
  )
}
