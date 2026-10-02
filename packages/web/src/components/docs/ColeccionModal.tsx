import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { MATERIAS } from '@topcode/shared'
import { Modal, Button, Input, TextArea } from '../ui'
import { SELECT_CLASS, type ColeccionInput } from '../../hooks/useDocs'

export function MateriaSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 w-full">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Asignatura</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={SELECT_CLASS}>
        <option value="general">General</option>
        {MATERIAS.map(m => <option key={m.codigo} value={m.codigo}>{m.nombreCorto}</option>)}
      </select>
    </label>
  )
}

interface ColeccionModalProps {
  open: boolean
  initial?: ColeccionInput
  title: string
  submitLabel: string
  onClose: () => void
  onSubmit: (input: ColeccionInput) => Promise<string | null>
}

const EMPTY: ColeccionInput = { titulo: '', descripcion: '', materia: 'general' }

export default function ColeccionModal({ open, initial, title, submitLabel, onClose, onSubmit }: ColeccionModalProps) {
  const [form, setForm] = useState<ColeccionInput>(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setForm(initial ?? EMPTY); setError(null) }
  }, [open, initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) { setError('El título es obligatorio.'); return }
    setSaving(true)
    const err = await onSubmit({
      titulo: form.titulo.trim(),
      descripcion: form.descripcion?.trim() || null,
      materia: form.materia,
    })
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5 text-text-muted" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <Input
          label="Título"
          value={form.titulo}
          maxLength={200}
          autoFocus
          onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          placeholder="Ej. PGL · Análisis de AplicacionVistas"
        />
        <TextArea
          label="Descripción (opcional)"
          value={form.descripcion ?? ''}
          maxLength={1000}
          rows={3}
          onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
          placeholder="¿Qué contiene esta documentación?"
        />
        <MateriaSelect value={form.materia} onChange={materia => setForm(f => ({ ...f, materia }))} />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  )
}
