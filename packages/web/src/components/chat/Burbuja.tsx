import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import { FONDO_PRIMARIO } from './estilos'
import { Avatar } from './Avatar'
import { colorNombre } from './color'

export interface BurbujaProps {
  mio: boolean
  /** Continúa un grupo del mismo autor (sin nombre arriba, menos separación). */
  agrupado: boolean
  /** Último del grupo: lleva la hora (y el avatar si procede). */
  ultimo: boolean
  mostrarAutor: boolean
  mostrarAvatar: boolean
  autor: string
  avatarUrl?: string | null
  texto: string
  hora: string
  editado?: boolean
  eliminado?: boolean
  editando?: boolean
  puedeEditar?: boolean
  onPerfil?: () => void
  onEmpezarEditar?: () => void
  onCancelarEditar?: () => void
  onConfirmarEditar?: (texto: string) => void
  onEliminar?: () => void
}

const BOTON_ACCION = cn(
  'w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-ov/[0.1] text-text-secondary shadow-card transition-colors',
  FOCO,
)

export default function Burbuja({
  mio, agrupado, ultimo, mostrarAutor, mostrarAvatar, autor, avatarUrl, texto, hora,
  editado, eliminado, editando, puedeEditar,
  onPerfil, onEmpezarEditar, onCancelarEditar, onConfirmarEditar, onEliminar,
}: BurbujaProps) {
  const [textoEdicion, setTextoEdicion] = useState(texto)
  // En pantallas táctiles no hay hover: tocar el mensaje muestra sus acciones
  const [tocado, setTocado] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editando) {
      setTextoEdicion(texto)
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [editando, texto])

  const fila = cn('flex items-end gap-2', mio ? 'justify-end' : 'justify-start', agrupado ? 'mt-0.5' : 'mt-3 first:mt-0')

  const columnaAvatar = mostrarAvatar && !mio && (
    <div className="shrink-0 w-8">
      {ultimo && !eliminado && (
        <button
          type="button"
          onClick={onPerfil}
          aria-label={`Ver perfil de ${autor}`}
          className={cn('rounded-full block transition-opacity hover:opacity-80', FOCO)}
        >
          <Avatar nombre={autor} url={avatarUrl} size={32} />
        </button>
      )}
    </div>
  )

  if (eliminado) {
    return (
      <div className={fila}>
        {columnaAvatar}
        <p className="px-3.5 py-2 text-xs italic rounded-2xl border border-dashed border-ov/[0.14] text-text-muted">
          Mensaje eliminado
        </p>
      </div>
    )
  }

  const forma = mio
    ? cn('rounded-2xl rounded-br-md', agrupado && 'rounded-tr-md')
    : cn('rounded-2xl rounded-bl-md', agrupado && 'rounded-tl-md')

  return (
    <div className={cn(fila, 'group/burbuja')}>
      {columnaAvatar}

      <div className={cn('flex items-end gap-1.5 max-w-[82%] md:max-w-[70%] min-w-0', mio ? 'flex-row-reverse' : 'flex-row')}>
        <div className={cn('flex flex-col min-w-0', mio ? 'items-end' : 'items-start')}>
          {mostrarAutor && !mio && (
            <button
              type="button"
              onClick={onPerfil}
              className={cn('text-xs font-semibold mb-1 ml-1 rounded hover:underline underline-offset-2', FOCO)}
              style={{ color: colorNombre(autor) }}
            >
              {autor}
            </button>
          )}

          {editando ? (
            <div className="flex items-center gap-1.5 pl-3.5 pr-1.5 py-1.5 rounded-2xl bg-surface-2 border border-primary/50 ring-2 ring-primary/15 w-[min(300px,70vw)]">
              <input
                ref={inputRef}
                value={textoEdicion}
                onChange={e => setTextoEdicion(e.target.value)}
                aria-label="Editar mensaje"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onConfirmarEditar?.(textoEdicion) }
                  if (e.key === 'Escape') onCancelarEditar?.()
                }}
                className="flex-1 min-w-0 bg-transparent text-sm text-text-primary outline-none"
              />
              <button
                type="button"
                onClick={() => onConfirmarEditar?.(textoEdicion)}
                aria-label="Guardar cambios"
                className={cn('w-8 h-8 flex items-center justify-center rounded-full hover:opacity-90', FONDO_PRIMARIO, FOCO)}
              >
                <Check size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onCancelarEditar}
                aria-label="Cancelar edición"
                className={cn('w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:bg-ov/[0.08]', FOCO)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p
              onClick={puedeEditar ? () => setTocado(t => !t) : undefined}
              className={cn(
                'px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]',
                forma,
                mio
                  ? FONDO_PRIMARIO
                  : 'bg-surface-2 text-text-primary border border-ov/[0.07]',
              )}
            >
              {texto}
            </p>
          )}

          {ultimo && !editando && (
            <span className="mt-1 mx-1 text-2xs text-text-muted tabular-nums">
              {hora}
              {editado && <span> · editado</span>}
            </span>
          )}
        </div>

        {/* Acciones sobre mis mensajes: hover, foco de teclado o toque */}
        {puedeEditar && !editando && (
          <div
            className={cn(
              'flex items-center gap-1 shrink-0 mb-5 transition-opacity',
              tocado ? 'opacity-100' : 'opacity-0 group-hover/burbuja:opacity-100 focus-within:opacity-100',
            )}
          >
            <button type="button" onClick={onEmpezarEditar} aria-label="Editar mensaje" title="Editar" className={cn(BOTON_ACCION, 'hover:text-text-primary')}>
              <Pencil size={13} aria-hidden="true" />
            </button>
            <button type="button" onClick={onEliminar} aria-label="Eliminar mensaje" title="Eliminar" className={cn(BOTON_ACCION, 'hover:text-rose-600 dark:hover:text-rose-300')}>
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
