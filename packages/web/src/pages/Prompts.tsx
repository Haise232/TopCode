import { useMemo, useState } from 'react'
import {
  Sparkles, Plus, Trash2, X, Loader2, Copy, Check, Pencil, Search, ExternalLink,
  Code2, GraduationCap, PenLine, Bug, Image as ImageIcon, LayoutGrid,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePrompts } from '@topcode/shared'
import { useTheme } from '../contexts/ThemeContext'
import { Copo } from '../components/Navidad'
import type { Prompt, PromptCategoria, PromptModelo, PromptInput } from '@topcode/shared'

const CATEGORIAS: Record<PromptCategoria, { label: string; Icon: React.ElementType; color: string }> = {
  general:    { label: 'General',    Icon: LayoutGrid,    color: '#94a3b8' },
  codigo:     { label: 'Código',     Icon: Code2,         color: '#60a5fa' },
  depuracion: { label: 'Depuración', Icon: Bug,           color: '#f87171' },
  estudio:    { label: 'Estudio',    Icon: GraduationCap, color: '#fbbf24' },
  escritura:  { label: 'Escritura',  Icon: PenLine,       color: '#2dd4bf' },
  imagen:     { label: 'Imagen',     Icon: ImageIcon,     color: '#a78bfa' },
}

const MODELOS: Record<PromptModelo, string> = {
  cualquiera: 'Cualquier IA',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  copilot: 'Copilot',
}

// Enlaces que abren el chat de la IA con el prompt ya escrito.
const ABRIR_EN: { label: string; url: (q: string) => string }[] = [
  { label: 'ChatGPT', url: q => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { label: 'Claude',  url: q => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
]

const EMPTY_FORM: PromptInput = { titulo: '', contenido: '', descripcion: '', categoria: 'general', modelo: 'cualquiera' }

const inputCls = 'bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'

export default function Prompts() {
  const { navidad } = useTheme()
  const { usuario } = useAuth()
  const { prompts, loading, error, addPrompt, updatePrompt, deletePrompt } = usePrompts()
  const [filtro, setFiltro] = useState<'todos' | PromptCategoria>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [editing, setEditing] = useState<Prompt | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<PromptInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const isAdmin = usuario?.rol === 'admin'

  const filtered = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return prompts.filter(p =>
      (filtro === 'todos' || p.categoria === filtro) &&
      (!q || p.titulo.toLowerCase().includes(q) || p.contenido.toLowerCase().includes(q) || (p.descripcion ?? '').toLowerCase().includes(q)),
    )
  }, [prompts, filtro, busqueda])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowModal(true)
  }

  function openEdit(p: Prompt) {
    setEditing(p)
    setForm({ titulo: p.titulo, contenido: p.contenido, descripcion: p.descripcion ?? '', categoria: p.categoria, modelo: p.modelo })
    setFormError(null)
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); setFormError(null) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim() || !form.contenido.trim()) {
      setFormError('El título y el prompt son obligatorios.')
      return
    }
    if (!usuario) return
    setSaving(true)
    setFormError(null)
    const data: PromptInput = {
      titulo: form.titulo.trim(),
      contenido: form.contenido.trim(),
      descripcion: form.descripcion?.trim() || null,
      categoria: form.categoria,
      modelo: form.modelo,
    }
    const { error: err } = editing
      ? await updatePrompt(editing.id, data)
      : await addPrompt({ ...data, usuario_id: usuario.id, autor: usuario.nombre })
    setSaving(false)
    if (err) { setFormError(err); return }
    closeModal()
  }

  async function handleCopy(p: Prompt) {
    try {
      await navigator.clipboard.writeText(p.contenido)
      setCopiedId(p.id)
      setTimeout(() => setCopiedId(c => (c === p.id ? null : c)), 1500)
    } catch { /* el navegador bloqueó el portapapeles */ }
  }

  async function handleDelete(p: Prompt) {
    if (!confirm(`¿Eliminar el prompt "${p.titulo}"?`)) return
    await deletePrompt(p.id)
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 md:px-6 py-5 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-xl tracking-tight text-text-primary flex items-center gap-2">Prompts IA{navidad && <Copo size={16} className="text-gold" />}</h1>
          <p className="text-xs text-text-muted mt-0.5">Prompts útiles para ChatGPT, Claude y otras IAs, compartidos por la clase</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 shrink-0"
          style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dark))', color: '#fff' }}
        >
          <Plus size={14} />
          Añadir
        </button>
      </div>

      {/* Búsqueda y filtros */}
      <div className="px-4 md:px-6 py-3 flex flex-col gap-3 border-b border-white/[0.06]">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar prompts..."
            className={`${inputCls} w-full pl-9 py-2.5`}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {(['todos', ...Object.keys(CATEGORIAS)] as ('todos' | PromptCategoria)[]).map(c => {
            const active = filtro === c
            return (
              <button
                key={c}
                onClick={() => setFiltro(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-150"
                style={{
                  background: active ? 'rgb(var(--c-primary) / 0.14)' : 'var(--overlay-03)',
                  border: active ? '1px solid rgb(var(--c-primary) / 0.3)' : '1px solid transparent',
                  color: active ? 'var(--color-primary)' : '#6b7280',
                }}
              >
                {c === 'todos' ? 'Todos' : CATEGORIAS[c].label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary-light" />
          </div>
        ) : error ? (
          <p className="text-center py-20 text-sm text-rose-400">No se pudieron cargar los prompts: {error}</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgb(var(--c-primary) / 0.08)' }}>
              <Sparkles size={22} style={{ color: 'var(--color-primary)' }} />
            </div>
            <p className="font-semibold text-text-secondary">
              {prompts.length === 0 ? 'Sin prompts todavía' : 'Ningún prompt coincide'}
            </p>
            <p className="text-sm text-text-muted">
              {prompts.length === 0 ? 'Comparte el primer prompt que te haya funcionado' : 'Prueba con otra búsqueda o categoría'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(p => {
              const { label, Icon, color } = CATEGORIAS[p.categoria] ?? CATEGORIAS.general
              const isOwn = usuario?.id === p.usuario_id
              const isLong = p.contenido.length > 280
              const isOpen = expanded.has(p.id)
              return (
                <article
                  key={p.id}
                  className="flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-surface to-bg transition-all duration-150 hover:border-white/[0.15] min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
                      >
                        <Icon size={14} style={{ color }} />
                      </div>
                      <h2 className="font-semibold text-sm text-text-primary line-clamp-2 leading-snug">{p.titulo}</h2>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOwn && (
                        <button
                          onClick={() => openEdit(p)}
                          aria-label="Editar prompt"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5"
                        >
                          <Pencil size={12} className="text-text-muted" />
                        </button>
                      )}
                      {(isOwn || isAdmin) && (
                        <button
                          onClick={() => handleDelete(p)}
                          aria-label="Eliminar prompt"
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/10"
                        >
                          <Trash2 size={12} style={{ color: '#f43f5e' }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {p.descripcion && (
                    <p className="text-xs text-text-muted leading-relaxed">{p.descripcion}</p>
                  )}

                  <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                    <pre className={`whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-text-secondary ${isLong && !isOpen ? 'line-clamp-6' : ''}`}>
                      {p.contenido}
                    </pre>
                    {isLong && (
                      <button onClick={() => toggleExpanded(p.id)} className="mt-1.5 text-[11px] font-semibold text-primary-light hover:underline">
                        {isOpen ? 'Ver menos' : 'Ver completo'}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleCopy(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                      style={{ background: 'rgb(var(--c-primary) / 0.14)', color: 'var(--color-primary)' }}
                    >
                      {copiedId === p.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === p.id ? 'Copiado' : 'Copiar'}
                    </button>
                    {ABRIR_EN.map(a => (
                      <a
                        key={a.label}
                        href={a.url(p.contenido)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                      >
                        <ExternalLink size={11} />
                        {a.label}
                      </a>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
                      >
                        {label}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-text-muted" style={{ background: 'var(--overlay-03)' }}>
                        {MODELOS[p.modelo] ?? p.modelo}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted truncate">{p.autor}</span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal añadir / editar */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 flex flex-col gap-4 border border-white/[0.1]"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-text-primary">{editing ? 'Editar prompt' : 'Añadir prompt'}</h2>
              <button onClick={closeModal} aria-label="Cerrar" className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5">
                <X size={16} style={{ color: '#6b7280' }} />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Título *"
                maxLength={120}
                className={inputCls}
              />
              <textarea
                value={form.contenido}
                onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                placeholder={'Prompt *\nEj: Actúa como profesor de programación y explícame paso a paso...'}
                rows={8}
                maxLength={8000}
                className={`${inputCls} font-mono text-[13px] resize-y`}
              />
              <input
                value={form.descripcion ?? ''}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Para qué sirve (opcional)"
                maxLength={300}
                className={inputCls}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.categoria}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value as PromptCategoria }))}
                  className={`${inputCls} px-3`}
                >
                  {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select
                  value={form.modelo}
                  onChange={e => setForm(f => ({ ...f, modelo: e.target.value as PromptModelo }))}
                  className={`${inputCls} px-3`}
                >
                  {Object.entries(MODELOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {formError && <p className="text-xs text-rose-400">{formError}</p>}
              <button
                type="submit"
                disabled={saving}
                className="py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dark))', color: '#fff' }}
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar prompt'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
