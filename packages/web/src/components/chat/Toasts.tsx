import type { ReactNode } from 'react'
import { ClipboardCheck, MessageCircle, X } from 'lucide-react'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE } from '../ui/estilos'
import { FONDO_PRIMARIO } from './estilos'
import { Avatar } from './Avatar'

/** Marco común de los avisos flotantes (esquina inferior; sobre la barra de navegación en móvil). */
function Marco({ lado, visible, children }: { lado: 'izquierda' | 'derecha'; visible: boolean; children: ReactNode }) {
  const izq = lado === 'izquierda'
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-[calc(76px+env(safe-area-inset-bottom))] z-[9998] md:bottom-5 motion-safe:transition-[opacity,transform] motion-safe:duration-300',
        izq ? 'left-4' : 'right-4',
        visible
          ? 'opacity-100 translate-x-0'
          : cn('opacity-0 pointer-events-none', izq ? '-translate-x-[110%]' : 'translate-x-[110%]'),
      )}
    >
      <div className={cn(SUPERFICIE, 'shadow-elevated flex items-center gap-3 p-3 w-[min(320px,calc(100vw-2rem))]')}>
        {children}
      </div>
    </div>
  )
}

function Acciones({ onCerrar, etiqueta, onAccion }: { onCerrar: () => void; etiqueta: string; onAccion: () => void }) {
  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0">
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className={cn('w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:bg-ov/[0.08]', FOCO)}
      >
        <X size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onAccion}
        className={cn('text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90', FONDO_PRIMARIO, FOCO)}
      >
        {etiqueta}
      </button>
    </div>
  )
}

export function ToastMensaje({ nombre, texto, visible, onCerrar, onAbrir }: {
  nombre: string; texto: string; visible: boolean; onCerrar: () => void; onAbrir: () => void
}) {
  const vista = texto.length > 40 ? texto.slice(0, 40) + '…' : texto
  return (
    <Marco lado="izquierda" visible={visible}>
      <Avatar nombre={nombre} size={40} />
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-primary-light">
          <MessageCircle size={11} aria-hidden="true" />
          Mensaje privado
        </p>
        <p className="mt-0.5 text-sm font-semibold leading-tight truncate text-text-primary">{nombre}</p>
        <p className="mt-0.5 text-xs leading-snug text-text-muted line-clamp-2">{vista}</p>
      </div>
      <Acciones onCerrar={onCerrar} etiqueta="Abrir" onAccion={onAbrir} />
    </Marco>
  )
}

export function ToastActividad({ titulo, detalle, visible, onCerrar, onVer }: {
  titulo: string; detalle: string; visible: boolean; onCerrar: () => void; onVer: () => void
}) {
  return (
    <Marco lado="derecha" visible={visible}>
      <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary/10 text-primary-light">
        <ClipboardCheck size={18} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-2xs font-bold uppercase tracking-wider text-primary-light">Nueva actividad</p>
        <p className="mt-0.5 text-sm font-semibold leading-tight truncate text-text-primary">{titulo}</p>
        <p className="mt-0.5 text-xs leading-snug truncate text-text-muted">{detalle}</p>
      </div>
      <Acciones onCerrar={onCerrar} etiqueta="Ver" onAccion={onVer} />
    </Marco>
  )
}
