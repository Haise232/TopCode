import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, Share, X } from 'lucide-react'

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

  return (
    <div
      className={`fixed inset-x-3 z-[60] mx-auto max-w-md rounded-2xl border border-white/10 bg-surface/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-3 flex items-center gap-3 ${
        withNav ? 'bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-4' : 'bottom-[calc(16px+env(safe-area-inset-bottom))]'
      }`}
      role="dialog"
      aria-label="Instalar TopCode"
    >
      <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">Instala TopCode</p>
        {canPrompt ? (
          <p className="text-xs text-text-muted">Ábrela como una app, a pantalla completa.</p>
        ) : (
          <p className="text-xs text-text-muted">
            Pulsa <Share size={12} className="inline -mt-0.5" aria-label="Compartir" /> y luego «Añadir a pantalla de inicio».
          </p>
        )}
      </div>
      {canPrompt && (
        <button
          onClick={() => { void install() }}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-dark transition-colors"
        >
          <Download size={16} />
          Instalar
        </button>
      )}
      <button onClick={close} className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-text-primary" aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  )
}
