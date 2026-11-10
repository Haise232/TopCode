import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import { SkeletonBox } from '../Skeleton'
import { Avatar } from './Avatar'
import Burbuja from './Burbuja'
import Compositor from './Compositor'
import type { ItemMensaje } from './tipos'

// ── Piezas ───────────────────────────────────────────────────────────────────

/** Cabecera del hilo: en móvil lleva la flecha para volver a la lista de conversaciones. */
export function CabeceraHilo({ onVolver, icono, titulo, subtitulo, derecha }: {
  onVolver?: () => void
  icono: ReactNode
  titulo: ReactNode
  subtitulo: ReactNode
  derecha?: ReactNode
}) {
  return (
    <header className="shrink-0 flex items-center gap-3 px-3 md:px-5 h-[68px] bg-surface border-b border-ov/[0.07]">
      {onVolver && (
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a conversaciones"
          className={cn('md:hidden w-10 h-10 -ml-1 shrink-0 flex items-center justify-center rounded-full text-text-secondary hover:bg-ov/[0.06]', FOCO)}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
      )}
      {icono}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base leading-tight text-text-primary truncate">{titulo}</div>
        <div className="mt-0.5 text-xs text-text-muted flex items-center gap-1.5 min-w-0">{subtitulo}</div>
      </div>
      {derecha}
    </header>
  )
}

function SeparadorDia({ etiqueta }: { etiqueta: string }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-4 first:mt-0" role="separator" aria-label={etiqueta}>
      <span className="flex-1 h-px bg-ov/[0.08]" />
      <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">{etiqueta}</span>
      <span className="flex-1 h-px bg-ov/[0.08]" />
    </div>
  )
}

function EsqueletoMensajes() {
  const filas = [
    { mio: false, w: 'w-48' }, { mio: false, w: 'w-64' }, { mio: true, w: 'w-40' },
    { mio: false, w: 'w-56' }, { mio: true, w: 'w-60' }, { mio: true, w: 'w-32' },
  ]
  return (
    <div role="status" aria-label="Cargando mensajes" className="flex flex-col gap-3 pt-2">
      {filas.map((f, i) => (
        <div key={i} className={cn('flex items-end gap-2', f.mio && 'justify-end')}>
          {!f.mio && <SkeletonBox className="w-8 h-8 rounded-full shrink-0" />}
          <SkeletonBox className={cn('h-10 rounded-2xl', f.w)} />
        </div>
      ))}
    </div>
  )
}

export function VacioCanal() {
  const { navidad } = useTheme()
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12 px-6">
      <span className="w-14 h-14 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
        <MessageCircle size={26} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-bold text-lg text-text-primary">El canal está tranquilo por ahora</p>
        <p className="text-sm leading-relaxed max-w-xs text-text-muted">
          {navidad
            ? 'Sé el primero en escribir algo y reparte un poco de espíritu navideño'
            : 'Sé el primero en escribir algo y empieza la conversación'}
        </p>
      </div>
    </div>
  )
}

export function VacioPrivado({ nombre, avatarUrl }: { nombre: string; avatarUrl?: string | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12 px-6">
      <Avatar nombre={nombre} url={avatarUrl} size={64} />
      <div className="flex flex-col gap-1.5">
        <p className="font-bold text-lg text-text-primary">Hola, ¡empieza la conversación!</p>
        <p className="text-sm leading-relaxed max-w-xs text-text-muted">Envía tu primer mensaje a {nombre}</p>
      </div>
    </div>
  )
}

/** Sin conversación elegida (solo escritorio). */
export function SinConversacion() {
  return (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-center px-6 bg-surface">
      <span className="w-14 h-14 flex items-center justify-center rounded-full bg-ov/[0.06] text-text-muted">
        <MessageCircle size={26} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-bold text-lg text-text-primary">Selecciona una conversación</p>
        <p className="text-sm text-text-muted">Elige un usuario del panel izquierdo</p>
      </div>
    </div>
  )
}

// ── Hilo ─────────────────────────────────────────────────────────────────────

export interface HiloProps {
  cabecera: ReactNode
  items: ItemMensaje[]
  loading: boolean
  vacio: ReactNode
  /** Mostrar avatar y nombre de los demás (canal) o nada (conversación a dos). */
  mostrarAutores: boolean
  escribiendo?: string[]
  onPerfil: (id: string) => void
  editandoId?: string | null
  onEmpezarEditar?: (id: string) => void
  onCancelarEditar?: () => void
  onConfirmarEditar?: (id: string, texto: string) => void
  onEliminar?: (id: string) => void
  // Compositor
  valor: string
  onCambiar: (v: string) => void
  onEnviar: (e: React.FormEvent) => void
  onEscribiendo?: () => void
  placeholder: string
  inputRef?: React.RefObject<HTMLInputElement>
}

export default function Hilo(p: HiloProps) {
  const finRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [p.items])

  const escribiendo = p.escribiendo ?? []

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-surface">
      {p.cabecera}

      <div className="flex-1 min-h-0 overflow-y-auto px-3 md:px-6 py-4">
        <div className="max-w-3xl mx-auto w-full min-h-full flex flex-col">
          {p.loading ? (
            <EsqueletoMensajes />
          ) : p.items.length === 0 ? (
            p.vacio
          ) : (
            p.items.map((m, i) => {
              const prev = p.items[i - 1]
              const next = p.items[i + 1]
              const nuevoDia = !prev || prev.dia !== m.dia
              const agrupado = !!prev && prev.autorId === m.autorId && !nuevoDia
              const ultimo = !next || next.autorId !== m.autorId || next.dia !== m.dia
              return (
                <div key={m.id}>
                  {nuevoDia && <SeparadorDia etiqueta={m.dia} />}
                  <Burbuja
                    mio={m.mio}
                    agrupado={agrupado}
                    ultimo={ultimo}
                    mostrarAutor={p.mostrarAutores && !m.mio && !agrupado}
                    mostrarAvatar={p.mostrarAutores}
                    autor={m.autor}
                    avatarUrl={m.avatarUrl}
                    texto={m.texto}
                    hora={m.hora}
                    editado={m.editado}
                    eliminado={m.eliminado}
                    editando={p.editandoId === m.id}
                    puedeEditar={m.mio && !!p.onConfirmarEditar}
                    onPerfil={() => p.onPerfil(m.autorId)}
                    onEmpezarEditar={() => p.onEmpezarEditar?.(m.id)}
                    onCancelarEditar={p.onCancelarEditar}
                    onConfirmarEditar={t => p.onConfirmarEditar?.(m.id, t)}
                    onEliminar={() => p.onEliminar?.(m.id)}
                  />
                </div>
              )
            })
          )}
          <div ref={finRef} />
        </div>
      </div>

      {escribiendo.length > 0 && (
        <div className="shrink-0 px-5 md:px-8 pb-2 flex items-center gap-2 text-xs text-text-muted" role="status">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-text-muted motion-safe:animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </span>
          {escribiendo.length === 1
            ? `${escribiendo[0]} está escribiendo…`
            : `${escribiendo.slice(0, 2).join(', ')} están escribiendo…`}
        </div>
      )}

      <Compositor
        valor={p.valor}
        onCambiar={p.onCambiar}
        onEnviar={p.onEnviar}
        onEscribiendo={p.onEscribiendo}
        placeholder={p.placeholder}
        inputRef={p.inputRef}
      />
    </div>
  )
}
