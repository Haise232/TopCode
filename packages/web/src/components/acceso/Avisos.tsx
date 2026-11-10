import type { ElementType, ReactNode } from 'react'
import { CloudOff, Clock, Download, Share, UserX, X } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { Nieve } from '../Pattern'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE } from '../ui/estilos'
import { BOTON_PRINCIPAL, LogoMarca, Nombre } from './Marca'

/** Pantalla a pantalla completa con una sola columna centrada (avisos y cambio de contraseña). */
export function PantallaCentrada({ children, ancho = 'max-w-[400px]' }: { children: ReactNode; ancho?: string }) {
  const { navidad } = useTheme()
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-8 sm:p-8 bg-bg relative">
      {navidad && <div className="absolute inset-0 pointer-events-none"><Nieve densidad={0.6} /></div>}
      <div className={cn('w-full relative', ancho)}>
        <div className="flex items-center gap-3 mb-8">
          <LogoMarca />
          <Nombre />
        </div>
        {children}
      </div>
    </main>
  )
}

const TONOS = {
  gold: 'bg-gold/15 text-gold-light',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
} as const

function Aviso({ Icon, tono, titulo, children, acciones }: {
  Icon: ElementType; tono: keyof typeof TONOS; titulo: string; children: ReactNode; acciones: ReactNode
}) {
  return (
    <PantallaCentrada ancho="max-w-md">
      <section className={cn(SUPERFICIE, 'p-6 sm:p-8')}>
        <span className={cn('w-12 h-12 flex items-center justify-center rounded-2xl', TONOS[tono])}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-extrabold tracking-tight text-text-primary">{titulo}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{children}</p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center gap-2">{acciones}</div>
      </section>
    </PantallaCentrada>
  )
}

const BOTON_SECUNDARIO = cn(
  'flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-text-secondary bg-ov/[0.04] border border-ov/[0.08]',
  'hover:bg-ov/[0.07] hover:text-text-primary transition-colors', FOCO,
)

export function PerfilErrorView({ onReintentar, onSalir }: { onReintentar: () => void; onSalir: () => void }) {
  return (
    <Aviso
      Icon={CloudOff} tono="rose" titulo="No se pudo cargar tu perfil"
      acciones={<>
        <button onClick={onSalir} className={BOTON_SECUNDARIO}>Cerrar sesión</button>
        <button onClick={onReintentar} className={cn(BOTON_PRINCIPAL, 'sm:w-auto sm:px-5')}>Reintentar</button>
      </>}
    >
      Estás conectado, pero no hemos podido comprobar el estado de tu cuenta.
      Revisa tu conexión e inténtalo de nuevo.
    </Aviso>
  )
}

export function AccesoPendienteView({ rechazado, onSalir }: { rechazado: boolean; onSalir: () => void }) {
  return (
    <Aviso
      Icon={rechazado ? UserX : Clock} tono={rechazado ? 'rose' : 'gold'}
      titulo={rechazado ? 'Solicitud no aceptada' : 'Solicitud pendiente'}
      acciones={<button onClick={onSalir} className={BOTON_SECUNDARIO}>Cerrar sesión</button>}
    >
      {rechazado
        ? 'El administrador de tu clase no ha aceptado esta cuenta. Contacta con él si crees que es un error.'
        : 'Tu cuenta se ha creado correctamente. Un administrador de tu clase debe aceptarla antes de que puedas entrar.'}
    </Aviso>
  )
}

/** Tarjeta flotante «Instala TopCode». `conNav` la sube sobre el menú inferior del móvil. */
export function AvisoInstalar({ puedeInstalar, conNav, onInstalar, onCerrar }: {
  puedeInstalar: boolean; conNav: boolean; onInstalar: () => void; onCerrar: () => void
}) {
  return (
    <div
      className={cn(
        'fixed inset-x-3 z-[60] mx-auto max-w-md rounded-2xl bg-surface border border-ov/[0.1] shadow-elevated p-3 flex items-center gap-3',
        conNav ? 'bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-4' : 'bottom-[calc(16px+env(safe-area-inset-bottom))]',
      )}
      role="dialog"
      aria-label="Instalar TopCode"
    >
      <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">Instala TopCode</p>
        {puedeInstalar ? (
          <p className="text-xs text-text-muted">Ábrela como una app, a pantalla completa.</p>
        ) : (
          <p className="text-xs text-text-muted">
            Pulsa <Share size={12} className="inline -mt-0.5" aria-label="Compartir" /> y luego «Añadir a pantalla de inicio».
          </p>
        )}
      </div>
      {puedeInstalar && (
        <button
          onClick={onInstalar}
          className={cn('shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-primary-dark hover:brightness-110 transition-[filter]', FOCO)}
        >
          <Download size={15} aria-hidden="true" />
          Instalar
        </button>
      )}
      <button onClick={onCerrar} aria-label="Cerrar"
        className={cn('shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-ov/[0.06] hover:text-text-primary transition-colors', FOCO)}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
