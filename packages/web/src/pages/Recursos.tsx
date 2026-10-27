import { useState } from 'react'
import { ExternalLink, FileText, PlayCircle, Github, Wrench, Plus, Trash2, X, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useRecursos, MATERIAS } from '@topcode/shared'
import type { Recurso } from '@topcode/shared'

const TIPO_CONFIG: Record<Recurso['tipo'], { label: string; Icon: React.ElementType; color: string }> = {
  link:        { label: 'Enlace',      Icon: ExternalLink, color: '#60a5fa' },
  doc:         { label: 'Documento',   Icon: FileText,     color: '#fbbf24' },
  video:       { label: 'Vídeo',       Icon: PlayCircle,   color: '#f87171' },
  repo:        { label: 'Repositorio', Icon: Github,       color: '#a78bfa' },
  herramienta: { label: 'Herramienta', Icon: Wrench,       color: '#2dd4bf' },
}

const EMPTY_FORM = { titulo: '', url: '', descripcion: '', materia: 'general', tipo: 'link' as Recurso['tipo'] }

export default function Recursos() {
  const { usuario } = useAuth()
  const { recursos, loading, addRecurso, deleteRecurso } = useRecursos()
  const [filtro, setFiltro] = useState('todos')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const filtered = filtro === 'todos' ? recursos : recursos.filter(r => r.materia === filtro)

  const grouped = filtered.reduce<Record<string, Recurso[]>>((acc, r) => {
    ;(acc[r.materia] ??= []).push(r)
    return acc
  }, {})

  const materiaLabel = (codigo: string) => {
    if (codigo === 'general') return 'General'
    return MATERIAS.find(m => m.codigo === codigo)?.nombreCorto ?? codigo
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim() || !form.url.trim()) {
      setFormError('El título y la URL son obligatorios.')
      return
    }
    if (!usuario) return
    setSaving(true)
    setFormError(null)
    const { error } = await addRecurso({
      usuario_id: usuario.id,
      autor: usuario.nombre,
      titulo: form.titulo.trim(),
      url: form.url.trim(),
      descripcion: form.descripcion.trim() || null,
      materia: form.materia,
      tipo: form.tipo,
    })
    setSaving(false)
    if (error) { setFormError(error); return }
    setForm(EMPTY_FORM)
    setShowModal(false)
  }

  function closeModal() { setShowModal(false); setForm(EMPTY_FORM); setFormError(null) }

  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 md:px-6 py-5 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-xl tracking-tight text-text-primary">Recursos</h1>
          <p className="text-xs text-text-muted mt-0.5">Materiales y enlaces útiles de la comunidad</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 shrink-0"
          style={{ background: 'linear-gradient(135deg,#3d9f89,#2c8178)', color: '#0d1117' }}
        >
          <Plus size={14} />
          Añadir
        </button>
      </div>

      {/* Materia filter */}
      <div className="px-4 md:px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-white/[0.06]">
        {[{ codigo: 'todos', nombreCorto: 'Todos' }, ...MATERIAS].map(m => {
          const active = filtro === m.codigo
          return (
            <button
              key={m.codigo}
              onClick={() => setFiltro(m.codigo)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-150"
              style={{
                background: active ? 'rgba(61,159,137,0.14)' : 'var(--overlay-03)',
                border: active ? '1px solid rgba(61,159,137,0.3)' : '1px solid transparent',
                color: active ? '#3d9f89' : '#6b7280',
              }}
            >
              {m.nombreCorto}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary-light" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(61,159,137,0.08)' }}>
              <ExternalLink size={22} style={{ color: '#3d9f89' }} />
            </div>
            <p className="font-semibold text-text-secondary">Sin recursos todavía</p>
            <p className="text-sm text-text-muted">Sé el primero en añadir algo útil</p>
          </div>
        ) : (
          Object.entries(grouped).map(([materia, items]) => (
            <section key={materia}>
              {filtro === 'todos' && (
                <h2 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#3d9f89' }}>
                  {materiaLabel(materia)}
                </h2>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(r => {
                  const { label, Icon, color } = TIPO_CONFIG[r.tipo]
                  const isOwn = usuario?.id === r.usuario_id
                  return (
                    <div
                      key={r.id}
                      className="group flex flex-col gap-2.5 p-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-surface to-bg transition-all duration-150 hover:border-white/[0.15]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
                          >
                            <Icon size={14} style={{ color }} />
                          </div>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-sm text-text-primary hover:text-primary-light transition-colors line-clamp-2 leading-snug"
                          >
                            {r.titulo}
                          </a>
                        </div>
                        {isOwn && (
                          <button
                            onClick={() => deleteRecurso(r.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-500/10 shrink-0"
                          >
                            <Trash2 size={11} style={{ color: '#f43f5e' }} />
                          </button>
                        )}
                      </div>
                      {r.descripcion && (
                        <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{r.descripcion}</p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-auto">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
                        >
                          {label}
                        </span>
                        <span className="text-[10px] text-text-muted">{r.autor}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Add modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 border border-white/[0.1]"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-text-primary">Añadir recurso</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5">
                <X size={16} style={{ color: '#6b7280' }} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Título *"
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-text-muted outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
              />
              <input
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="URL * (https://...)"
                type="url"
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-text-muted outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
              />
              <textarea
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Descripción (opcional)"
                rows={2}
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-text-muted outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)] resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.materia}
                  onChange={e => setForm(f => ({ ...f, materia: e.target.value }))}
                  className="bg-input border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-slate-100 outline-none focus:border-primary/50"
                >
                  <option value="general">General</option>
                  {MATERIAS.map(m => <option key={m.codigo} value={m.codigo}>{m.nombreCorto}</option>)}
                </select>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Recurso['tipo'] }))}
                  className="bg-input border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-slate-100 outline-none focus:border-primary/50"
                >
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              {formError && <p className="text-xs text-rose-400">{formError}</p>}
              <button
                type="submit"
                disabled={saving}
                className="py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#3d9f89,#2c8178)', color: '#0d1117' }}
              >
                {saving ? 'Guardando...' : 'Guardar recurso'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
