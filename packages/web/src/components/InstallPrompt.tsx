import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AvisoInstalar } from './acceso/Avisos'

// Evento de Chrome/Android para instalar la app con un botón propio (no viene en los tipos del DOM).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Chrome lanza el evento una sola vez y muy pronto, a veces antes de que se monte el aviso:
// se guarda a nivel de módulo, que se carga con App al arrancar.
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as BeforeInstallPromptEvent
  listeners.forEach(fn => fn())
})
window.addEventListener('appinstalled', () => {
  deferred = null
  listeners.forEach(fn => fn())
})

const DISMISS_KEY = 'topcode:instalar-cerrado'
const DISMISS_DAYS = 7

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

// iPhone/iPad en Safari: no hay evento de instalación, solo «Compartir → Añadir a pantalla de inicio».
function isIosSafari() {
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

function dismissedRecently() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY)) || 0
    return Date.now() - t < DISMISS_DAYS * 86400000
  } catch {
    return false
  }
}

export default function InstallPrompt() {
  const location = useLocation()
  const [canPrompt, setCanPrompt] = useState(!!deferred)
  const [hidden, setHidden] = useState(() => isStandalone() || dismissedRecently())
  const ios = isIosSafari()

  useEffect(() => {
    const update = () => setCanPrompt(!!deferred)
    listeners.add(update)
    return () => { listeners.delete(update) }
  }, [])

  if (hidden) return null
  if (!canPrompt && !ios) return null

  const close = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignorar
    }
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    setCanPrompt(false)
    if (outcome === 'accepted') setHidden(true)
  }

  // Encima del menú inferior del móvil cuando lo hay
  const withNav = !['/login', '/register'].includes(location.pathname)

  return <AvisoInstalar puedeInstalar={canPrompt} conNav={withNav} onInstalar={() => { void install() }} onCerrar={close} />
}
