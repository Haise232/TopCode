import { useEffect, useState, useMemo } from 'react'
import { BookOpen, Plus, Trash2, RefreshCw, TrendingUp, User, ChevronDown, ChevronUp, GraduationCap, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useNotas, MATERIAS, type Nota, type UsuarioPublico } from '@topcode/shared'
import AlertModal from '../components/AlertModal'
import { Spinner } from '../components/ui'
import { supabase } from '../lib/supabase'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

function mediaColor(media: number) {
  if (media >= 7) return '#3d9f89'
  if (media >= 5) return '#f59e0b'
  return '#f43f5e'
}

function MediaBadge({ value }: { value: number }) {
  const color = mediaColor(value)
  return (
    <span
      className="inline-flex items-center justify-center text-xs font-bold rounded-lg px-2 py-0.5 min-w-[2.5rem]"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {value.toFixed(2)}
    </span>
  )
}

function calcMedia(teorica: number, practica: number) {
  return Math.round(((teorica + practica) / 2) * 100) / 100
}

type NotasByMateria = Record<string, Nota[]>

function groupByMateria(notas: Nota[]): NotasByMateria {
  return notas.reduce<NotasByMateria>((acc, n) => {
    if (!acc[n.materia]) acc[n.materia] = []
    acc[n.materia].push(n)
    return acc
  }, {})
}

function promedioMateria(notas: Nota[]) {
  if (notas.length === 0) return null
  return notas.reduce((s, n) => s + n.media, 0) / notas.length
}

// ── Modal de añadir nota ──────────────────────────────────────────────────────

type AddForm = {
  materia: string
  tema: string
  teorica: string
  practica: string
}

function AddNotaModal({
  visible,
  onClose,
  onSubmit,
  saving,
  targetNombre,
}: {
  visible: boolean
  onClose: () => void
  onSubmit: (f: { materia: string; tema: string; teorica: number; practica: number; media: number }) => void
  saving: boolean
  targetNombre?: string
}) {
  const [form, setForm] = useState<AddForm>({ materia: '', tema: '', teorica: '', practica: '' })

  useEffect(() => {
    if (visible) setForm({ materia: '', tema: '', teorica: '', practica: '' })
  }, [visible])

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-5 animate-scale-in"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--overlay-08)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ background: 'rgba(61,159,137,0.12)', border: '1px solid rgba(61,159,137,0.2)' }}>
              <Plus size={14} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <p className="font-semibold text-sm text-text-primary">Añadir nota</p>
              {targetNombre && <p className="text-xs text-text-muted">{targetNombre}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Materia */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Materia</label>
            <select
              value={form.materia}
              onChange={e => setForm(f => ({ ...f, materia: e.target.value }))}
              required
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)', color: form.materia ? 'var(--color-text)' : 'var(--color-text-muted)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(61,159,137,0.5)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <option value="" disabled>Seleccionar materia…</option>
              {MATERIAS.map(m => (
                <option key={m.codigo} value={m.nombreCorto}>{m.nombreCorto}</option>
              ))}
            </select>
          </div>

          {/* Tema */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Tema / Unidad</label>
            <input
              type="text"
              value={form.tema}
              onChange={e => setForm(f => ({ ...f, tema: e.target.value }))}
              placeholder="Ej: Tema 1 — Introducción"
              required
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none text-text-primary"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(61,159,137,0.5)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>

          {/* Notas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Teórica (0–10)</label>
              <input
                type="number"
                value={form.teorica}
                onChange={e => setForm(f => ({ ...f, teorica: e.target.value }))}
                min="0" max="10" step="0.01"
                placeholder="0.00"
                required
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none text-text-primary"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(61,159,137,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Práctica (0–10)</label>
              <input
                type="number"
                value={form.practica}
                onChange={e => setForm(f => ({ ...f, practica: e.target.value }))}
                min="0" max="10" step="0.01"
                placeholder="0.00"
                required
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none text-text-primary"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(61,159,137,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>
          </div>

          {/* Preview de media */}
          {preview !== null && (
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}
            >
              <span className="text-xs font-semibold text-text-muted">Media calculada</span>
              <MediaBadge value={preview} />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-text-muted transition-all"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={!valid || saving}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #3d9f89, #2c8178)' }}>
              {saving ? <><Spinner size="sm" className="text-white" /> Guardando…</> : <><Plus size={13} /> Añadir</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Fila de nota ────────────────────────────────────────────────────────────

function NotaRow({ nota, canDelete, onDelete }: { nota: Nota; canDelete: boolean; onDelete: () => void }) {
  return (
    <tr className="group border-t" style={{ borderColor: 'var(--overlay-05)' }}>
      <td className="py-2.5 pl-4 pr-2 text-sm text-text-secondary">{nota.tema}</td>
      <td className="py-2.5 px-2 text-center">
        <MediaBadge value={nota.teorica} />
      </td>
      <td className="py-2.5 px-2 text-center">
        <MediaBadge value={nota.practica} />
      </td>
      <td className="py-2.5 px-2 text-center">
        <MediaBadge value={nota.media} />
      </td>
      {canDelete && (
        <td className="py-2.5 pr-4 pl-2 text-right">
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 ml-auto"
            style={{ color: 'var(--color-text-muted)', border: '1px solid transparent' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-error)'; el.style.background = 'rgba(244,63,94,0.08)'; el.style.borderColor = 'rgba(244,63,94,0.2)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text-muted)'; el.style.background = 'transparent'; el.style.borderColor = 'transparent' }}
            aria-label="Eliminar nota"
          >
            <Trash2 size={12} />
          </button>
        </td>
      )}
    </tr>
  )
}

// ── Bloque por materia ────────────────────────────────────────────────────────

function MateriaSection({
  materia, notas, canDelete, onDelete,
}: {
  materia: string
  notas: Nota[]
  canDelete: boolean
  onDelete: (nota: Nota) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const prom = promedioMateria(notas)

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--color-surface)' }}>
      {/* Cabecera de materia */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-white/[0.02]"
      >
        <div className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
          style={{ background: 'rgba(61,159,137,0.10)', border: '1px solid rgba(61,159,137,0.2)' }}>
          <BookOpen size={12} style={{ color: 'var(--color-primary)' }} />
        </div>
        <span className="flex-1 text-left font-semibold text-sm text-text-primary">{materia}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">{notas.length} tema{notas.length !== 1 ? 's' : ''}</span>
          {prom !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">Prom.</span>
              <MediaBadge value={prom} />
            </div>
          )}
          {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </div>
      </button>

      {/* Tabla de notas */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--overlay-05)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                <th className="text-left text-xs font-semibold py-2 pl-4 pr-2 text-text-muted">Tema</th>
                <th className="text-center text-xs font-semibold py-2 px-2 text-text-muted w-20">Teórica</th>
                <th className="text-center text-xs font-semibold py-2 px-2 text-text-muted w-20">Práctica</th>
                <th className="text-center text-xs font-semibold py-2 px-2 text-text-muted w-20">Media</th>
                {canDelete && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {notas.map(nota => (
                <NotaRow key={nota.id} nota={nota} canDelete={canDelete} onDelete={() => onDelete(nota)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function NotasSkeleton() {
  return (
    <div className="animate-fade-in max-w-[900px] mx-auto p-4 md:p-6 flex flex-col gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl overflow-hidden shimmer" style={{ height: 120, border: '1px solid var(--border)' }} />
      ))}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function Notas() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'

  // Para admin: selector de alumno
  const [alumnos, setAlumnos] = useState<UsuarioPublico[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(
    isAdmin ? undefined : usuario?.id
  )
  const targetId = isAdmin ? selectedId : usuario?.id

  const {
    notas, loading,
    init, refresh,
    addNotaOptimistic, deleteNotaOptimistic,
  } = useNotas({ usuarioId: targetId })

  const [refreshing, setRefreshing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  // Cargar alumnos si es admin
  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('usuarios')
      .select('id, nombre, avatar_url, rol')
      .order('nombre')
      .then(({ data }) => {
        if (data) setAlumnos(data as UsuarioPublico[])
      })
  }, [isAdmin])

  useEffect(() => { init() }, [init])

  async function handleRefresh() {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  async function handleAddNota(f: { materia: string; tema: string; teorica: number; practica: number; media: number }) {
    if (!targetId) return
    setSaving(true)
    const { error } = await addNotaOptimistic({ ...f, usuario_id: targetId })
    setSaving(false)
    setAddOpen(false)
    if (error) {
      setAlert({ type: 'error', title: 'Error al guardar', message: error })
    }
  }

  function handleDelete(nota: Nota) {
    setAlert({
      title: 'Eliminar nota',
      message: `¿Eliminar la nota de "${nota.tema}" (${nota.materia})?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await deleteNotaOptimistic(nota.id)
        if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar la nota.' })
      },
    })
  }

  const byMateria = useMemo(() => groupByMateria(notas), [notas])
  const materiasOrdenadas = useMemo(
    () => Object.keys(byMateria).sort((a, b) => a.localeCompare(b)),
    [byMateria]
  )

  const promedioGlobal = useMemo(() => {
    if (notas.length === 0) return null
    return notas.reduce((s, n) => s + n.media, 0) / notas.length
  }, [notas])

  const targetNombre = isAdmin
    ? alumnos.find(a => a.id === targetId)?.nombre
    : usuario?.nombre

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div className="px-4 md:px-6 py-5" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
        <div className="max-w-[900px] mx-auto flex flex-wrap gap-3 justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(61,159,137,0.12)', border: '1px solid rgba(61,159,137,0.2)' }}>
              <GraduationCap size={16} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-text-primary">Mis Notas</h1>
              {promedioGlobal !== null && (
                <p className="text-xs text-text-muted flex items-center gap-1.5 mt-0.5">
                  <TrendingUp size={10} /> Promedio global
                  <span className="font-bold" style={{ color: mediaColor(promedioGlobal) }}>
                    {promedioGlobal.toFixed(2)}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de alumno (solo admin) */}
            {isAdmin && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--border)' }}>
                <User size={13} className="text-text-muted shrink-0" />
                <select
                  value={selectedId ?? ''}
                  onChange={e => setSelectedId(e.target.value || undefined)}
                  className="text-sm font-medium outline-none text-text-primary"
                  style={{ background: 'transparent', maxWidth: '180px' }}
                >
                  <option value="">Seleccionar alumno…</option>
                  {alumnos.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:bg-white/5 transition-all"
              style={{ border: '1px solid var(--overlay-08)' }}
              aria-label="Actualizar"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>

            {/* Añadir nota: admin siempre puede, pero solo si hay alumno seleccionado */}
            {isAdmin && (
              <button
                onClick={() => setAddOpen(true)}
                disabled={!targetId}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #3d9f89, #2c8178)' }}
              >
                <Plus size={14} /> Añadir nota
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="max-w-[900px] mx-auto p-4 md:p-6">

        {/* Admin sin alumno seleccionado */}
        {isAdmin && !targetId ? (
          <div className="py-16 flex flex-col items-center gap-4 text-center rounded-2xl animate-fade-in"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--border)' }}>
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(61,159,137,0.08)', border: '1px solid rgba(61,159,137,0.15)' }}>
              <User size={24} className="text-primary-light" />
            </div>
            <div>
              <p className="font-semibold text-base text-text-primary">Selecciona un alumno</p>
              <p className="text-sm mt-1 text-text-muted">Elige un alumno en el selector de arriba para ver o añadir sus notas.</p>
            </div>
          </div>

        ) : loading ? (
          <NotasSkeleton />

        ) : notas.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4 text-center rounded-2xl animate-fade-in"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--border)' }}>
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(61,159,137,0.08)', border: '1px solid rgba(61,159,137,0.15)' }}>
              <BookOpen size={24} className="text-primary-light" />
            </div>
            <div>
              <p className="font-semibold text-base text-text-primary">
                {isAdmin ? `${targetNombre ?? 'Este alumno'} no tiene notas` : 'Aún no tienes notas registradas'}
              </p>
              <p className="text-sm mt-1 text-text-muted">
                {isAdmin ? 'Pulsa "Añadir nota" para registrar calificaciones.' : 'Las notas las añade el administrador.'}
              </p>
            </div>
          </div>

        ) : (
          <div className="flex flex-col gap-3 animate-fade-in">
            {/* Resumen de materias */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {materiasOrdenadas.map(materia => {
                const prom = promedioMateria(byMateria[materia])
                return (
                  <div key={materia}
                    className="px-3 py-2.5 rounded-xl flex flex-col gap-1"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold text-text-secondary truncate">{materia}</p>
                    {prom !== null && <MediaBadge value={prom} />}
                  </div>
                )
              })}
            </div>

            {/* Tablas por materia */}
            {materiasOrdenadas.map(materia => (
              <MateriaSection
                key={materia}
                materia={materia}
                notas={byMateria[materia]}
                canDelete={isAdmin}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de añadir */}
      <AddNotaModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddNota}
        saving={saving}
        targetNombre={targetNombre}
      />

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
