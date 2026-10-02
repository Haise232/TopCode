import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HelpCircle, Plus, X, Loader2, MessageSquare, CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useForoPosts } from '@topcode/shared'

const FORO_CATEGORIAS = [
  { codigo: 'duda', nombre: 'Dudas', color: '#60a5fa' },
  { codigo: 'fallo', nombre: 'Fallos', color: '#fb923c' },
]
const EMPTY_FORM = { titulo: '', cuerpo: '', materia: 'duda' }

function getHue(s: string) {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
}

function UserAvatar({ nombre, size = 28 }: { nombre: string; size?: number }) {
  const hue = getHue(nombre)
  return (
    <div
      className="flex items-center justify-center shrink-0 font-bold"
      style={{
        width: size, height: size,
        borderRadius: size > 36 ? '12px' : '8px',
        background: `hsla(${hue},50%,18%,0.95)`,
        border: `1.5px solid hsla(${hue},55%,38%,0.3)`,
        color: `hsla(${hue},70%,72%,1)`,
        fontSize: size * 0.38,
      }}
    >
      {nombre[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function timeAgo(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

export default function Foro() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const { posts, loading, error, createPost, refresh } = useForoPosts()

  const [filtroMateria, setFiltroMateria] = useState('todos')
  const [soloSinResolver, setSoloSinResolver] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const filtered = posts
    .filter(p => filtroMateria === 'todos' || p.materia === filtroMateria)
    .filter(p => !soloSinResolver || !p.resuelto)

  const categoria = (codigo: string) => FORO_CATEGORIAS.find(c => c.codigo === codigo) ?? FORO_CATEGORIAS[0]

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) { setFormError('El título es obligatorio.'); return }
    if (!form.cuerpo.trim()) { setFormError('Describe tu duda.'); return }
    if (!usuario) return
    setSaving(true)
    setFormError(null)
    const { error, id } = await createPost({
      usuario_id: usuario.id,
      autor: usuario.nombre,
      titulo: form.titulo.trim(),
      cuerpo: form.cuerpo.trim(),
      materia: form.materia,
    })
    setSaving(false)
    if (error) { setFormError(error); return }
    setForm(EMPTY_FORM)
    setShowModal(false)
    if (id) navigate(`/foro/${id}`)
  }

  function closeModal() { setShowModal(false); setForm(EMPTY_FORM); setFormError(null) }

  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 md:px-6 py-5 border-b border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-xl tracking-tight text-text-primary">Foro de dudas</h1>
          <p className="text-xs text-text-muted mt-0.5">Pregunta, responde y ayúdate entre compañeros</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 shrink-0"
          style={{ background: 'linear-gradient(135deg,#3d9f89,#2c8178)', color: '#0d1117' }}
        >
          <Plus size={14} />
          Preguntar
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 md:px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-white/[0.06]">
        {[{ codigo: 'todos', nombre: 'Todos' }, ...FORO_CATEGORIAS].map(m => {
          const active = filtroMateria === m.codigo
          return (
            <button
              key={m.codigo}
              onClick={() => setFiltroMateria(m.codigo)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-150"
              style={{
                background: active ? 'rgba(61,159,137,0.14)' : 'var(--overlay-03)',
                border: active ? '1px solid rgba(61,159,137,0.3)' : '1px solid transparent',
                color: active ? '#3d9f89' : '#6b7280',
              }}
            >
              {m.nombre}
            </button>
          )
        })}
        <div className="w-px h-4 shrink-0" style={{ background: 'var(--overlay-08)' }} />
        <button
          onClick={() => setSoloSinResolver(v => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all duration-150 flex items-center gap-1.5"
          style={{
            background: soloSinResolver ? 'rgba(251,146,60,0.14)' : 'var(--overlay-03)',
            border: soloSinResolver ? '1px solid rgba(251,146,60,0.3)' : '1px solid transparent',
            color: soloSinResolver ? '#fb923c' : '#6b7280',
          }}
        >
          <Clock size={10} />
          Sin resolver
        </button>
      </div>

      {/* Posts list */}
      <div className="p-4 md:p-6 flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary-light" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <p className="font-semibold text-text-secondary">No se pudo cargar el foro</p>
            <p className="text-sm text-text-muted">Comprueba la conexión e inténtalo de nuevo.</p>
            <button onClick={refresh} className="text-xs text-primary-light hover:underline">Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(61,159,137,0.08)' }}>
              <HelpCircle size={22} style={{ color: '#3d9f89' }} />
            </div>
            <p className="font-semibold text-text-secondary">Sin preguntas todavía</p>
            <p className="text-sm text-text-muted">Lanza la primera duda de la comunidad</p>
          </div>
        ) : (
          filtered.map(post => {
            const replies = post.foro_respuestas?.length ?? 0
            const tipo = categoria(post.materia)
            const color = tipo.color
            return (
              <button
                key={post.id}
                onClick={() => navigate(`/foro/${post.id}`)}
                className="group w-full text-left p-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-surface to-bg transition-all duration-150 hover:border-white/[0.18] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex gap-3"
              >
                {/* Left accent */}
                <div className="w-0.5 rounded-full shrink-0 self-stretch" style={{ background: post.resuelto ? '#2f8f75' : color }} />

                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  {/* Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
                      >
                        {tipo.nombre}
                      </span>
                      {post.resuelto ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#2f8f75' }}>
                          <CheckCircle2 size={9} />
                          Resuelto
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
                          <Clock size={9} />
                          Pendiente
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0">{timeAgo(post.created_at)}</span>
                  </div>

                  <p className="font-semibold text-sm text-text-primary group-hover:text-primary-light transition-colors leading-snug">{post.titulo}</p>

                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{post.cuerpo}</p>

                  {/* Bottom */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserAvatar nombre={post.autor} />
                      <span className="text-xs text-text-secondary">{post.autor}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-text-muted">
                      <MessageSquare size={11} />
                      {replies}
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* New post modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-4 border border-white/[0.1]"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-text-primary">Nueva pregunta</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5">
                <X size={16} style={{ color: '#6b7280' }} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="¿Qué quieres preguntar? *"
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-text-muted outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)]"
              />
              <select
                value={form.materia}
                onChange={e => setForm(f => ({ ...f, materia: e.target.value }))}
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-100 outline-none focus:border-primary/50"
              >
                {FORO_CATEGORIAS.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
              </select>
              <textarea
                value={form.cuerpo}
                onChange={e => setForm(f => ({ ...f, cuerpo: e.target.value }))}
                placeholder="Explica tu duda con detalle... *"
                rows={4}
                className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-text-muted outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.12)] resize-none"
              />
              {formError && <p className="text-xs text-rose-400">{formError}</p>}
              <button
                type="submit"
                disabled={saving}
                className="py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#3d9f89,#2c8178)', color: '#0d1117' }}
              >
                {saving ? 'Publicando...' : 'Publicar pregunta'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
