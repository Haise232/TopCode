import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { MensajePrivado, onBroadcast } from '@topcode/shared'
import { ToastMensaje } from './chat/Toasts'

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

    return onBroadcast(`dm:${uid}`, 'INSERT', (msg: MensajePrivado) => {
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
      // Guardar último remitente para deep-link desde el nav
      try { sessionStorage.setItem('lastDmSender', JSON.stringify({ id: msg.de_id, nombre: msg.de_nombre })) } catch { /* ignore */ }
    })
  }, [usuario?.id, show, notify, navigate])

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!toast) return null

  return (
    <ToastMensaje
      nombre={toast.de_nombre}
      texto={toast.texto}
      visible={visible}
      onCerrar={dismiss}
      onAbrir={() => {
        navigate(`/chat?dm=${toast.de_id}&from=${encodeURIComponent(toast.de_nombre)}`)
        dismiss()
      }}
    />
  )
}
