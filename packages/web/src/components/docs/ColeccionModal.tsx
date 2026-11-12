import { useEffect, useId, useState } from 'react'
import { BookMarked, Pencil } from 'lucide-react'
import { MATERIAS } from '@topcode/shared'
import { Button } from '../ui'
import { type ColeccionInput } from '../../hooks/useDocs'
import { UtSelect } from '../ui/Unidades'
import { Dialogo, ETIQUETA, INPUT } from './Piezas'

/** Asignatura y unidad de trabajo de una colección. */
export function MateriaSelect({ value, onChange, ut, onUt }: {
  value: string; onChange: (value: string) => void; ut: number | null; onUt: (ut: number | null) => void
}) {
  const id = useId()
  const idUt = useId()
  return (
    <div className="grid grid-cols-[1fr_7.5rem] gap-3 w-full">
      <div className="flex flex-col gap-1.5 min-w-0">
        <label htmlFor={id} className={ETIQUETA}>Asignatura</label>
        <select id={id} value={value} onChange={e => onChange(e.target.value)} className={INPUT}>
          <option value="general">General</option>
          {MATERIAS.map(m => <option key={m.codigo} value={m.codigo}>{m.nombreCorto}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idUt} className={ETIQUETA}>Unidad</label>
        <UtSelect id={idUt} value={ut} onChange={onUt} className={INPUT} />
      </div>
    </div>
  )
}

interface ColeccionModalProps {
  open: boolean
  initial?: ColeccionInput
  /** Valores de partida al crear (p. ej. la asignatura que está abierta). */
  defaults?: Partial<ColeccionInput>
  title: string
  submitLabel: string
  onClose: () => void
  onSubmit: (input: ColeccionInput) => Promise<string | null>
}

const EMPTY: ColeccionInput = { titulo: '', descripcion: '', materia: 'general', ut: null }

export default function ColeccionModal({ open, initial, defaults, title, submitLabel, onClose, onSubmit }: ColeccionModalProps) {
  const [form, setForm] = useState<ColeccionInput>(initial ?? { ...EMPTY, ...defaults })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idTitulo = useId()
  const idDesc = useId()

  useEffect(() => {
    if (open) { setForm(initial ?? { ...EMPTY, ...defaults }); setError(null) }
  // defaults solo importa al abrir el diálogo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) { setError('El título es obligatorio.'); return }
    setSaving(true)
    const err = await onSubmit({
      titulo: form.titulo.trim(),
      descripcion: form.descripcion?.trim() || null,
      materia: form.materia,
      ut: form.ut,
    })
    setSaving(false)
    if (err) setError(err)
  }

  const editando = !!initial
  return (
    <Dialogo
      open={open} onClose={onClose} titulo={title} Icon={editando ? Pencil : BookMarked}
      subtitulo={editando ? 'Cambia el nombre, la descripción, la asignatura o la UT' : 'Agrupa las páginas de un mismo tema dentro de una asignatura y UT'}
      ancho="sm:max-w-md" onSubmit={handleSubmit}
      pie={<>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={saving}>{submitLabel}</Button>
      </>}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idTitulo} className={ETIQUETA}>Título</label>
        <input id={idTitulo} value={form.titulo} maxLength={200} autoFocus className={INPUT}
          onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          placeholder="Ej. PGL · Análisis de AplicacionVistas" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idDesc} className={ETIQUETA}>Descripción (opcional)</label>
        <textarea id={idDesc} value={form.descripcion ?? ''} maxLength={1000} rows={3} className={`${INPUT} resize-none`}
          onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          placeholder="¿Qué contiene esta documentación?" />
      </div>
      <MateriaSelect value={form.materia} onChange={materia => setForm(f => ({ ...f, materia }))}
        ut={form.ut} onUt={ut => setForm(f => ({ ...f, ut }))} />
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{error}</p>}
    </Dialogo>
  )
}
