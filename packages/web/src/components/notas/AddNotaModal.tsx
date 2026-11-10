import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { MATERIAS } from '@topcode/shared'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import Dialogo from './Dialogo'
import MediaBadge from './MediaBadge'
import { calcMedia } from './nota'

const INPUT = 'bg-input border border-ov/[0.08] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted transition-[border-color,box-shadow] duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'
const ETIQUETA = 'text-xs font-semibold text-text-secondary'

type AddForm = { materia: string; tema: string; teorica: string; practica: string }
const VACIO: AddForm = { materia: '', tema: '', teorica: '', practica: '' }

export default function AddNotaModal({
  visible, onClose, onSubmit, saving, targetNombre,
}: {
  visible: boolean
  onClose: () => void
  onSubmit: (f: { materia: string; tema: string; teorica: number; practica: number; media: number }) => void
  saving: boolean
  targetNombre?: string
}) {
  const [form, setForm] = useState<AddForm>(VACIO)

  useEffect(() => { if (visible) setForm(VACIO) }, [visible])

  if (!visible) return null

  const teoricaNum = parseFloat(form.teorica)
  const practicaNum = parseFloat(form.practica)
  const valid =
    form.materia !== '' &&
    form.tema.trim() !== '' &&
    !isNaN(teoricaNum) && teoricaNum >= 0 && teoricaNum <= 10 &&
    !isNaN(practicaNum) && practicaNum >= 0 && practicaNum <= 10

  const preview = valid ? calcMedia(teoricaNum, practicaNum) : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSubmit({
      materia: form.materia,
      tema: form.tema.trim(),
      teorica: teoricaNum,
      practica: practicaNum,
      media: calcMedia(teoricaNum, practicaNum),
    })
  }

  return (
    <Dialogo
      idTitulo="add-nota-titulo"
      titulo="Añadir nota"
      subtitulo={targetNombre}
      onClose={onClose}
      icono={
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-gold/15 text-gold-light">
          <Plus size={16} aria-hidden="true" />
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-5 sm:px-6 pb-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nota-materia" className={ETIQUETA}>Materia</label>
            <select id="nota-materia" value={form.materia} required
              onChange={e => setForm(f => ({ ...f, materia: e.target.value }))}
              className={cn(INPUT, !form.materia && 'text-text-muted')}>
              <option value="" disabled>Seleccionar materia…</option>
              {MATERIAS.map(m => <option key={m.codigo} value={m.nombreCorto}>{m.nombreCorto}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nota-tema" className={ETIQUETA}>Tema / Unidad</label>
            <input id="nota-tema" type="text" value={form.tema} required autoFocus
              onChange={e => setForm(f => ({ ...f, tema: e.target.value }))}
              placeholder="Ej: Tema 1 — Introducción" className={INPUT} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nota-teorica" className={ETIQUETA}>Teórica (0–10)</label>
              <input id="nota-teorica" type="number" inputMode="decimal" value={form.teorica} required
                onChange={e => setForm(f => ({ ...f, teorica: e.target.value }))}
                min="0" max="10" step="0.01" placeholder="0.00" className={INPUT} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nota-practica" className={ETIQUETA}>Práctica (0–10)</label>
              <input id="nota-practica" type="number" inputMode="decimal" value={form.practica} required
                onChange={e => setForm(f => ({ ...f, practica: e.target.value }))}
                min="0" max="10" step="0.01" placeholder="0.00" className={INPUT} />
            </div>
          </div>

          {preview !== null && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-ov/[0.04] border border-ov/[0.08]">
              <span className="text-xs font-semibold text-text-muted">Media calculada</span>
              <MediaBadge value={preview} />
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 sm:px-6 py-4 shrink-0 border-t border-ov/[0.07] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 py-3 text-sm">Cancelar</Button>
          <Button type="submit" disabled={!valid || saving} loading={saving} className="flex-[2] py-3 text-sm">
            {saving ? 'Guardando…' : 'Añadir'}
          </Button>
        </div>
      </form>
    </Dialogo>
  )
}
