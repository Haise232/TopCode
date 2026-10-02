import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, Send, Check, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useForoPost } from '@topcode/shared'

const FORO_CATEGORIAS: Record<string, string> = { duda: 'Duda', fallo: 'Fallo' }

function getHue(s: string) {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
}

function UserAvatar({ nombre, size = 32 }: { nombre: string; size?: number }) {
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

function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('es', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export default function ForoPost() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { post, respuestas, loading, error, addRespuesta, markSolucion, markResuelto } = useForoPost(id)

  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (respuestas.length > 0) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [respuestas.length])

  const isPostAuthor = usuario?.id === post?.usuario_id
  const canResolve = isPostAuthor || usuario?.rol === 'admin'

  const materiaLabel = (codigo: string) => FORO_CATEGORIAS[codigo] ?? 'Duda'

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() || !usuario) return
    setSending(true)
    await addRespuesta({ usuario_id: usuario.id, autor: usuario.nombre, cuerpo: texto.trim() })
    setTexto('')
    setSending(false)
  }

  async function handleMarkSolucion(respuestaId: string) {
    setMarkingId(respuestaId)
    await markSolucion(respuestaId)
    if (!post?.resuelto) await markResuelto()
    setMarkingId(null)
  }

  if (loading) return (
    <div className="animate-fade-in h-full flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary-light" />
    </div>
  )

  if (error || !post) return (
    <div className="animate-fade-in h-full flex flex-col items-center justify-center gap-4">
      <p className="text-text-muted text-sm">No se encontró la pregunta.</p>
      <button onClick={() => navigate('/foro')} className="text-xs text-primary-light hover:underline">Volver al foro</button>
    </div>
  )

  return (
    <div className="animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-white/[0.08] flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('/foro')}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-white/[0.08] hover:bg-white/5 transition-all duration-150"
        >
          <ArrowLeft size={15} style={{ color: '#9ca3af' }} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: 'rgba(61,159,137,0.1)', color: '#3d9f89' }}
          >
            {materiaLabel(post.materia)}
          </span>
          <h1 className="font-bold text-sm text-text-primary truncate">{post.titulo}</h1>
        </div>
        {post.resuelto ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-auto" style={{ background: 'rgba(16,185,129,0.12)', color: '#2f8f75' }}>
            <CheckCircle2 size={10} />
            Resuelto
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-auto" style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
            <Clock size={10} />
            Pendiente
          </span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 flex flex-col gap-4">

          {/* Original post */}
          <div className="p-5 rounded-2xl border border-white/[0.1] bg-gradient-to-br from-surface to-bg">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <UserAvatar nombre={post.autor} size={36} />
                <div>
                  <p className="font-semibold text-sm text-text-primary">{post.autor}</p>
                  <p className="text-[10px] text-text-muted">{formatDateTime(post.created_at)}</p>
                </div>
              </div>
              {canResolve && !post.resuelto && respuestas.length > 0 && (
                <button
                  onClick={markResuelto}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 hover:opacity-80 shrink-0"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#2f8f75', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <CheckCircle2 size={11} />
                  Marcar resuelta
                </button>
              )}
            </div>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{post.cuerpo}</p>
          </div>

          {/* Replies */}
          {respuestas.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                {respuestas.length} {respuestas.length === 1 ? 'respuesta' : 'respuestas'}
              </p>
              {respuestas.map(r => (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl border transition-all duration-150"
                  style={{
                    background: r.es_solucion ? 'rgba(16,185,129,0.05)' : 'var(--overlay-02)',
                    borderColor: r.es_solucion ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar nombre={r.autor} size={30} />
                      <div>
                        <p className="font-semibold text-sm text-text-primary">{r.autor}</p>
                        <p className="text-[10px] text-text-muted">{formatDateTime(r.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.es_solucion && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#2f8f75' }}>
                          <Check size={9} />
                          Solución
                        </span>
                      )}
                      {canResolve && !r.es_solucion && !post.resuelto && (
                        <button
                          onClick={() => handleMarkSolucion(r.id)}
                          disabled={markingId === r.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80 disabled:opacity-50"
                          style={{ background: 'rgba(16,185,129,0.08)', color: '#2f8f75', border: '1px solid rgba(16,185,129,0.15)' }}
                        >
                          <Check size={9} />
                          Solución
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{r.cuerpo}</p>
                </div>
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Reply input */}
      <div className="shrink-0 border-t border-white/[0.08]" style={{ background: 'var(--color-surface-2)' }}>
        <form onSubmit={handleReply} className="max-w-3xl mx-auto p-4 flex items-end gap-3">
          <UserAvatar nombre={usuario?.nombre ?? '?'} size={32} />
          <div className="flex-1 flex items-end gap-2">
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Escribe tu respuesta..."
              rows={1}
              className="flex-1 bg-input border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-text-muted outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(61,159,137,0.1)] resize-none min-h-[42px] max-h-32 overflow-y-auto"
              style={{ lineHeight: '1.5' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (texto.trim()) handleReply(e as unknown as React.FormEvent) }
              }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`
              }}
            />
            <button
              type="submit"
              disabled={!texto.trim() || sending}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 active:scale-90 disabled:opacity-40 shrink-0"
              style={{
                background: texto.trim() ? 'linear-gradient(135deg,#3d9f89,#2c8178)' : 'var(--overlay-04)',
              }}
            >
              {sending
                ? <Loader2 size={14} className="animate-spin text-white" />
                : <Send size={14} style={{ color: texto.trim() ? '#0d1117' : '#64748b', transform: 'translateX(1px)' }} />
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
