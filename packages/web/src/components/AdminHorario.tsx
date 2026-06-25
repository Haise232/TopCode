import { useState, useEffect, useCallback } from 'react'
import { CalendarClock, Plus, Pencil, Trash2, X } from 'lucide-react'
import { useHorario, type HorarioClase, CLASE_GROUPS, CLASES, MATERIAS } from '@topcode/shared'
import { Button, Modal, Spinner } from './ui'
import AlertModal from './AlertModal'

const DIAS_SEMANA: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
}

// Hash determinista del nombre de materia → color suave (igual que Home.tsx)
function materiaColor(nombre: string): string {
  let hash = 0
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 60%)`
}

type FormState = {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  codigo: string
}

const EMPTY_FORM: FormState = {
  dia_semana: 1,
  hora_inicio: '',
  hora_fin: '',
  codigo: MATERIAS[0].codigo,
}

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

export default function AdminHorario() {
  const [claseSeleccionada, setClaseSeleccionada] = useState<string>(CLASES[0].id)
  const { porDia, loading, init, createClase, updateClase, deleteClase } = useHorario(claseSeleccionada)

  const [modalVisible, setModalVisible] = useState(false)
  const [editando, setEditando] = useState<HorarioClase | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  useEffect(() => { init() }, [init])

  const abrirNuevo = useCallback(() => {
    setEditando(null)
    setForm(EMPTY_FORM)
    setModalVisible(true)
  }, [])

  function abrirEditar(c: HorarioClase) {
    setEditando(c)
    setForm({
      dia_semana: c.dia_semana,
      hora_inicio: c.hora_inicio,
      hora_fin: c.hora_fin,
      codigo: c.codigo,
    })
    setModalVisible(true)
  }

  function cerrarModal() {
    setModalVisible(false)
    setEditando(null)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.hora_inicio || !form.hora_fin) {
      setAlert({ type: 'error', title: 'Error', message: 'La hora de inicio y fin son obligatorias.' })
      return
    }
    if (form.hora_fin <= form.hora_inicio) {
      setAlert({ type: 'error', title: 'Error', message: 'La hora de fin debe ser posterior a la de inicio.' })
      return
    }

    const materiaInfo = MATERIAS.find(m => m.codigo === form.codigo)
    const payload = {
      dia_semana: form.dia_semana,
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      materia: materiaInfo?.nombreCorto ?? form.codigo,
      codigo: form.codigo,
    }

    setSaving(true)
    const { error } = editando
      ? await updateClase(editando.id, payload)
      : await createClase(payload)
    setSaving(false)

    if (error) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo guardar: ' + error })
      return
    }
    cerrarModal()
  }

  function handleEliminar(c: HorarioClase) {
    setAlert({
      title: 'Eliminar clase',
      message: `¿Eliminar "${c.materia}" del ${DIAS_SEMANA[c.dia_semana].toLowerCase()} (${c.hora_inicio}-${c.hora_fin})?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await deleteClase(c.id)
        if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar la clase.' })
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)' }}
          >
            <CalendarClock size={14} className="text-blue-400" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-text-primary">Horario</h2>
            <p className="text-xs text-text-muted">Horario semanal de cada clase</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={claseSeleccionada}
            onChange={e => setClaseSeleccionada(e.target.value)}
            className="text-xs bg-input border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-slate-100 outline-none transition-all duration-150 focus:border-primary/50"
          >
            {CLASE_GROUPS.map(({ label, opciones }) => (
              <optgroup key={label} label={label}>
                {opciones.map(c => (
                  <option key={c.id} value={c.id}>{c.id}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <Button type="button" size="sm" icon={<Plus size={13} />} onClick={abrirNuevo}>
            Añadir clase
          </Button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: 'var(--gradient-card)', border: '1px solid var(--overlay-07)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="sm" />
          </div>
        ) : (
          [1, 2, 3, 4, 5].map(dia => {
            const clases = porDia[dia] ?? []
            return (
              <div key={dia} style={{ borderBottom: dia < 5 ? '1px solid var(--overlay-06)' : 'none' }}>
                <div className="px-5 py-2.5" style={{ background: 'var(--overlay-02)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {DIAS_SEMANA[dia]}
                  </p>
                </div>
                {clases.length === 0 ? (
                  <div className="px-5 py-3 text-xs text-text-muted">Sin clases</div>
                ) : (
                  clases.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 px-5 py-2.5"
                      style={{ borderTop: '1px solid var(--overlay-04)' }}
                    >
                      <span className="font-mono text-xs text-text-muted w-[94px] shrink-0">
                        {c.hora_inicio}–{c.hora_fin}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: materiaColor(c.materia) }}
                      />
                      <span className="text-sm text-text-primary flex-1 min-w-0 truncate">
                        {c.materia}
                      </span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-lg border shrink-0"
                        style={{ background: 'var(--overlay-04)', color: 'var(--color-text-muted)', borderColor: 'var(--overlay-08)' }}
                      >
                        {c.codigo}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => abrirEditar(c)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 text-text-muted hover:text-primary-light hover:bg-primary/10"
                          aria-label="Editar clase"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleEliminar(c)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 text-text-muted hover:text-rose hover:bg-rose-500/10"
                          aria-label="Eliminar clase"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Modal crear/editar clase ── */}
      <Modal open={modalVisible} onClose={cerrarModal} maxWidthClassName="max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-extrabold text-lg leading-tight text-text-primary">
                {editando ? 'Editar clase' : 'Nueva clase'}
              </h2>
              <p className="text-xs mt-0.5 text-text-muted">{claseSeleccionada}</p>
            </div>
            <button onClick={cerrarModal} className="text-text-muted hover:text-text-primary transition-colors">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleGuardar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Día</label>
              <select
                value={form.dia_semana}
                onChange={e => setForm(f => ({ ...f, dia_semana: Number(e.target.value) }))}
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]"
              >
                {[1, 2, 3, 4, 5].map(d => (
                  <option key={d} value={d}>{DIAS_SEMANA[d]}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Hora inicio</label>
                <input
                  type="time"
                  value={form.hora_inicio}
                  onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                  className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm transition-all duration-200 w-full outline-none [color-scheme:dark] focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Hora fin</label>
                <input
                  type="time"
                  value={form.hora_fin}
                  onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                  className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm transition-all duration-200 w-full outline-none [color-scheme:dark] focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Asignatura</label>
              <select
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]"
              >
                {MATERIAS.map(m => (
                  <option key={m.codigo} value={m.codigo}>{m.nombreCorto} ({m.codigo})</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 mt-1">
              <Button type="button" variant="ghost" onClick={cerrarModal} className="flex-1 py-3 text-sm">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} loading={saving} className="flex-[2] py-3 text-sm">
                {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Añadir clase'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <AlertModal
        visible={alert !== null}
        type={alert?.type}
        title={alert?.title ?? ''}
        message={alert?.message}
        onClose={() => setAlert(null)}
        onConfirm={alert?.onConfirm}
        confirmLabel={alert?.confirmLabel}
        confirmDestructive={alert?.confirmDestructive}
      />
    </div>
  )
}
