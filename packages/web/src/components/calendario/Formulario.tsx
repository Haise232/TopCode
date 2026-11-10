import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Pencil, X } from 'lucide-react'
import { MATERIAS, TIPOS_EVENTO, type TipoEvento } from '@topcode/shared'
import { TIPO_EVENTO_CONFIG } from '../../lib/tiposEvento'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import { formatFechaPreview, type FormState } from './tipos'

const INPUT = 'bg-input border border-ov/[0.08] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted transition-[border-color,box-shadow] duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'
const ETIQUETA = 'text-xs font-semibold text-text-secondary'

function TipoSelector({ value, onChange }: { value: TipoEvento; onChange: (t: TipoEvento) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    const n = TIPOS_EVENTO.length
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + n) % n
    if (next < 0) return
    e.preventDefault()
    const id = TIPOS_EVENTO[next].id
    onChange(id)
    refs.current[id]?.focus()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id="tipo-evento-label" className={ETIQUETA}>Tipo</span>
      <div role="radiogroup" aria-labelledby="tipo-evento-label" className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-2">
        {TIPOS_EVENTO.map(({ id, descripcion }, idx) => {
          const cfg = TIPO_EVENTO_CONFIG[id]
          const active = value === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              ref={el => { refs.current[id] = el }}
              onClick={() => onChange(id)}
              onKeyDown={e => onKeyDown(e, idx)}
              title={descripcion}
              className={cn(
                'flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-2.5 rounded-xl border transition-colors duration-150',
                FOCO,
                !active && 'bg-ov/[0.03] border-ov/[0.08] text-text-secondary hover:bg-ov/[0.06]',
              )}
              style={active ? { background: cfg.bg, color: cfg.texto, borderColor: cfg.color } : undefined}
            >
              <cfg.Icon size={13} aria-hidden="true" />
              {cfg.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Hoja de crear/editar evento: panel inferior en móvil, diálogo centrado en escritorio. */
export default function Formulario({
  editando, form, setForm, saving, onSubmit, onClose,
}: {
  editando: boolean
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0" style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(10px)' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-evento-titulo"
        className="relative w-full sm:max-w-lg max-h-[92dvh] flex flex-col motion-safe:animate-slide-in-bottom sm:motion-safe:animate-scale-in-modal rounded-t-2xl sm:rounded-2xl bg-surface border border-ov/[0.08] shadow-modal"
      >
        <div className="w-9 h-1 mx-auto mt-3 shrink-0 sm:hidden rounded-full bg-ov/[0.15]" aria-hidden="true" />

        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-gold/15 text-gold-light">
              {editando ? <Pencil size={16} aria-hidden="true" /> : <CalendarDays size={16} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <h2 id="form-evento-titulo" className="font-extrabold text-lg leading-tight text-text-primary">
                {editando ? 'Editar evento' : 'Nuevo evento'}
              </h2>
              <p className="text-xs mt-0.5 text-text-muted">
                {editando ? 'Modifica los datos del evento' : 'Pon el título y elige de qué tipo es'}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            className={cn('w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-text-muted hover:bg-ov/[0.06] hover:text-text-primary transition-colors', FOCO)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex flex-col gap-4 px-5 sm:px-6 pb-4 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ev-titulo" className={ETIQUETA}>Título</label>
              <input id="ev-titulo" type="text" value={form.titulo} autoFocus
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ej: Actividad 2 de Informática" className={INPUT} />
            </div>

            <TipoSelector value={form.tipo} onChange={tipo => setForm(f => ({ ...f, tipo }))} />

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ev-fecha" className={ETIQUETA}>Fecha de fin</label>
                  <input id="ev-fecha" type="date" value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className={INPUT} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ev-hora" className={ETIQUETA}>Hora (opcional)</label>
                  <input id="ev-hora" type="time" value={form.hora}
                    onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} className={INPUT} />
                </div>
              </div>
              {form.fecha && (
                <p className="text-xs text-text-secondary flex items-center gap-1.5">
                  <CalendarDays size={12} aria-hidden="true" className="text-text-muted" />
                  <span className="first-letter:uppercase">
                    {formatFechaPreview(form.fecha)}
                    {form.hora && <span className="text-text-muted"> a las {form.hora}</span>}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ev-materia" className={ETIQUETA}>Asignatura (opcional)</label>
              <input id="ev-materia" value={form.materia} list="cal-materias-list"
                onChange={e => setForm(f => ({ ...f, materia: e.target.value }))}
                placeholder="Selecciona o escribe..." className={INPUT} />
              <datalist id="cal-materias-list">
                {MATERIAS.map(m => <option key={m.codigo} value={m.nombreCorto} />)}
              </datalist>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ev-descripcion" className={ETIQUETA}>Descripción (opcional)</label>
              <textarea id="ev-descripcion" value={form.descripcion} rows={3}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Más detalles..." className={cn(INPUT, 'resize-none')} />
            </div>
          </div>

          <div className="flex gap-3 px-5 sm:px-6 py-4 shrink-0 border-t border-ov/[0.07] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 py-3 text-sm">Cancelar</Button>
            <Button type="submit" disabled={saving} loading={saving} className="flex-[2] py-3 text-sm">
              {saving ? (editando ? 'Guardando...' : 'Creando...') : (editando ? 'Guardar cambios' : 'Crear Evento')}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
