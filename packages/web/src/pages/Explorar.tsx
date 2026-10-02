import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BookMarked, BookOpen, FileText, HelpCircle, Loader2, MessageSquare,
  Search, Sparkles,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

type DocItem = {
  id: string
  coleccion_id: string
  titulo: string
  updated_at: string
  updated_by_nombre: string
  docs_colecciones: { titulo: string } | null
}

type RecursoItem = {
  id: string
  titulo: string
  descripcion: string | null
  materia: string
  tipo: string
  created_at: string
}

type ForoItem = {
  id: string
  titulo: string
  cuerpo: string
  autor: string
  resuelto: boolean
  created_at: string
  foro_respuestas?: { id: string }[]
}

type ExploreData = {
  docs: DocItem[]
  recursos: RecursoItem[]
  dudas: ForoItem[]
}

const EMPTY_DATA: ExploreData = { docs: [], recursos: [], dudas: [] }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function SectionHeader({ icon: Icon, title, action, onAction }: {
  icon: typeof BookMarked
  title: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/15">
          <Icon size={15} className="text-primary" />
        </div>
        <h2 className="font-bold text-base text-text-primary">{title}</h2>
      </div>
      <button onClick={onAction} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-light transition-colors">
        {action}
        <ArrowRight size={13} />
      </button>
    </div>
  )
}

export default function Explorar() {
  const navigate = useNavigate()
  const [data, setData] = useState<ExploreData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(false)
      const [docs, recursos, dudas] = await Promise.all([
        supabase.from('docs_paginas').select('id, coleccion_id, titulo, updated_at, updated_by_nombre, docs_colecciones(titulo)').order('updated_at', { ascending: false }).limit(3),
        supabase.from('recursos').select('id, titulo, descripcion, materia, tipo, created_at').order('created_at', { ascending: false }).limit(4),
        supabase.from('foro_posts').select('id, titulo, cuerpo, autor, resuelto, created_at, foro_respuestas(id)').eq('resuelto', false).order('created_at', { ascending: false }).limit(4),
      ])

      if (cancelled) return
      if (docs.error || recursos.error || dudas.error) {
        setError(true)
      } else {
        setData({
          docs: (docs.data ?? []) as unknown as DocItem[],
          recursos: (recursos.data ?? []) as RecursoItem[],
          dudas: (dudas.data ?? []) as ForoItem[],
        })
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={26} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-7 md:py-9 flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles size={13} />
            Comunidad académica
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Explorar</h1>
              <p className="mt-1.5 text-sm text-text-muted">Descubre apuntes, recursos y conversaciones de todos tus compañeros.</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                placeholder="Buscar en la comunidad"
                onKeyDown={event => {
                  if (event.key === 'Enter') navigate(`/apuntes?q=${encodeURIComponent(event.currentTarget.value)}`)
                }}
                className="w-full rounded-xl border border-white/[0.1] bg-surface px-9 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">
            No se pudo cargar todo el contenido comunitario. Puedes seguir usando las secciones individuales.
          </div>
        )}

        <section className="flex flex-col gap-4">
          <SectionHeader icon={HelpCircle} title="Dudas sin resolver" action="Ver foro" onAction={() => navigate('/foro')} />
          {data.dudas.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-surface/70 px-5 py-8 text-center text-sm text-text-muted">No hay preguntas pendientes ahora mismo.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.dudas.map(post => (
                <button key={post.id} onClick={() => navigate(`/foro/${post.id}`)} className="group text-left rounded-2xl border border-white/[0.08] bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1.5 text-primary-light"><MessageSquare size={12} />{post.foro_respuestas?.length ?? 0} respuestas</span>
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                  <h3 className="mt-3 font-bold text-text-primary group-hover:text-primary-light">{post.titulo}</h3>
                  <p className="mt-1.5 text-sm text-text-muted line-clamp-2">{post.cuerpo}</p>
                  <p className="mt-3 text-xs text-text-secondary">Por {post.autor}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader icon={BookOpen} title="Recursos recientes" action="Ver recursos" onAction={() => navigate('/recursos')} />
          {data.recursos.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-surface/70 px-5 py-8 text-center text-sm text-text-muted">Todavía no hay recursos compartidos.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.recursos.map(resource => (
                <button key={resource.id} onClick={() => navigate('/recursos')} className="group text-left rounded-2xl border border-white/[0.08] bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{resource.materia}</span>
                  <h3 className="mt-2 font-bold text-sm text-text-primary line-clamp-2 group-hover:text-primary-light">{resource.titulo}</h3>
                  <p className="mt-2 text-xs text-text-muted line-clamp-2">{resource.descripcion || 'Recurso compartido por la comunidad.'}</p>
                  <span className="mt-4 block text-[11px] text-text-muted">{resource.tipo} · {formatDate(resource.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader icon={BookMarked} title="Documentación reciente" action="Ver documentación" onAction={() => navigate('/docs')} />
          {data.docs.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-surface/70 px-5 py-8 text-center text-sm text-text-muted">Todavía no hay documentación publicada.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {data.docs.map(item => (
                <button key={item.id} onClick={() => navigate(`/docs/${item.coleccion_id}/${item.id}`)} className="group text-left rounded-2xl border border-white/[0.08] bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-text-muted">
                    <span className="truncate">{item.docs_colecciones?.titulo ?? 'Documentación'}</span><FileText size={12} className="shrink-0" />
                  </div>
                  <h3 className="mt-3 font-bold text-text-primary group-hover:text-primary-light">{item.titulo}</h3>
                  <span className="mt-3 block text-xs text-text-muted">
                    {item.updated_by_nombre ? `${item.updated_by_nombre} · ` : ''}{formatDate(item.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3 border-t border-white/[0.08] pt-6">
          <Button onClick={() => navigate('/foro')}>Preguntar en el foro</Button>
          <Button variant="ghost" onClick={() => navigate('/apuntes')}>Explorar apuntes</Button>
        </div>
      </div>
    </div>
  )
}
