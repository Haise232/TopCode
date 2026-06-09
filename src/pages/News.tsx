import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Newspaper, Plus, Trash2, ExternalLink, X, ImageOff, Shield, Pencil, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import AlertModal from '../components/AlertModal'
import { Button, Input, TextArea, IconButton } from '../components/ui'

interface NewsItem {
  id: string
  titulo: string
  descripcion: string
  url_fuente: string
  url_imagen: string | null
  created_by: string
  created_at: string
}

type AlertState = {
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

type Category = 'Todas' | 'Artículo' | 'Repositorio' | 'Herramienta' | 'Video'

const CATEGORIES: Category[] = ['Todas', 'Artículo', 'Repositorio', 'Herramienta', 'Video']

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function isReciente(iso: string): boolean {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= 7
}

function detectCategoria(item: NewsItem): Category {
  const text = (item.titulo + ' ' + item.descripcion).toLowerCase()
  if (
    text.includes('video') ||
    text.includes('youtube') ||
    text.includes('tutorial') ||
    text.includes('curso') ||
    text.includes('stream')
  )
    return 'Video'
  if (
    text.includes('repo') ||
    text.includes('github') ||
    text.includes('gitlab') ||
    text.includes('repositorio') ||
    text.includes('source') ||
    text.includes('commit') ||
    text.includes('pull request') ||
    text.includes('release')
  )
    return 'Repositorio'
  if (
    text.includes('tool') ||
    text.includes('herramienta') ||
    text.includes('app') ||
    text.includes('framework') ||
    text.includes('librería') ||
    text.includes('libreria') ||
    text.includes('library') ||
    text.includes('plugin') ||
    text.includes('extension') ||
    text.includes('package') ||
    text.includes('npm') ||
    text.includes('utilidad')
  )
    return 'Herramienta'
  return 'Artículo'
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({
  label,
  count,
  color,
  colorBg,
  colorBorder,
}: {
  label: string
  count: number
  color: string
  colorBg: string
  colorBorder: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        {label}
      </h2>
      <span
        className="text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: colorBg, color, border: `1px solid ${colorBorder}` }}
      >
        {count}
      </span>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function NewsSkeleton() {
  return (
    <div className="h-full overflow-y-auto animate-pulse">
      {/* Header skeleton */}
      <div className="px-4 md:px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1100px] mx-auto flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl" style={{ background: 'var(--overlay-06)' }} />
              <div className="flex flex-col gap-1.5">
                <div className="h-5 w-28 rounded-md" style={{ background: 'var(--overlay-06)' }} />
                <div className="h-3 w-20 rounded-md" style={{ background: 'var(--overlay-04)' }} />
              </div>
            </div>
            <div className="h-9 w-36 rounded-xl" style={{ background: 'var(--overlay-06)' }} />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 h-10 rounded-xl" style={{ background: 'var(--overlay-04)' }} />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-7 w-20 rounded-full" style={{ background: 'var(--overlay-04)' }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="h-44" style={{ background: 'var(--color-surface-2)' }} />
            <div className="p-4 flex flex-col gap-3">
              <div className="h-4 w-3/4 rounded-md" style={{ background: 'var(--overlay-06)' }} />
              <div className="flex flex-col gap-1.5">
                <div className="h-3 w-full rounded-md" style={{ background: 'var(--overlay-04)' }} />
                <div className="h-3 w-5/6 rounded-md" style={{ background: 'var(--overlay-04)' }} />
                <div className="h-3 w-2/3 rounded-md" style={{ background: 'var(--overlay-04)' }} />
              </div>
              <div className="flex justify-between items-center mt-1">
                <div className="h-3 w-20 rounded-md" style={{ background: 'var(--overlay-04)' }} />
                <div className="h-3 w-16 rounded-md" style={{ background: 'var(--overlay-04)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function NewsCard({
  noticia,
  isAdmin,
  onDelete,
  onEdit,
}: {
  noticia: NewsItem
  isAdmin: boolean
  onDelete: () => void
  onEdit: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const showImg = noticia.url_imagen && !imgError
  const categoria = detectCategoria(noticia)

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200 group"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(85,239,196,0.25)'
        el.style.background = 'var(--color-surface-2)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--border)'
        el.style.background = 'var(--color-surface)'
      }}
    >
      {/* Image / Placeholder */}
      <div className="relative w-full h-44 shrink-0 overflow-hidden">
        {showImg ? (
          <img
            src={noticia.url_imagen!}
            alt={noticia.titulo}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <Newspaper size={36} className="text-text-muted" />
          </div>
        )}

        {/* Botones admin — top-right overlay */}
        {isAdmin && (
          <>
            <button
              onClick={e => { e.stopPropagation(); onEdit() }}
              className="absolute top-2.5 right-11 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 text-primary-light"
              style={{
                background: 'rgba(15,18,25,0.8)',
                border: '1px solid rgba(85,239,196,0.3)',
                backdropFilter: 'blur(6px)',
              }}
              aria-label="Editar noticia"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 text-rose"
              style={{
                background: 'rgba(15,18,25,0.8)',
                border: '1px solid rgba(244,63,94,0.3)',
                backdropFilter: 'blur(6px)',
              }}
              aria-label="Eliminar noticia"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2.5 p-4 flex-1">
        {/* Category badge */}
        <span
          className="self-start text-[0.65rem] px-2 py-0.5 rounded-full font-medium"
          style={{
            background: 'rgba(85,239,196,0.1)',
            color: '#55efc4',
            border: '1px solid rgba(85,239,196,0.2)',
          }}
        >
          {categoria}
        </span>

        <h3 className="font-bold text-sm leading-snug text-text-primary">
          {noticia.titulo}
        </h3>

        <p className="text-sm leading-relaxed line-clamp-5 flex-1 text-text-secondary">
          {noticia.descripcion}
        </p>

        <div className="flex items-center justify-between mt-auto pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs text-text-muted">
            {formatFecha(noticia.created_at)}
          </span>
          <a
            href={noticia.url_fuente}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold transition-colors duration-150 text-primary-light hover:text-indigo-300"
            onClick={e => e.stopPropagation()}
          >
            Ver fuente
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Image Preview ─────────────────────────────────────────────────────────────

function ImagePreview({ url }: { url: string }) {
  const [errored, setErrored] = useState(false)

  // Reset error state when URL changes
  useEffect(() => { setErrored(false) }, [url])

  return (
    <div
      className="mt-1.5 rounded-xl overflow-hidden"
      style={{
        height: '120px',
        border: '1px solid var(--border)',
        background: 'var(--color-surface-2)',
      }}
    >
      {errored ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
          <ImageOff size={22} className="text-text-muted" />
          <span className="text-xs text-text-muted">No se pudo cargar la imagen</span>
        </div>
      ) : (
        <img
          src={url}
          alt="Preview"
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function News() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'

  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<NewsItem | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('Todas')

  // Form state
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [urlFuente, setUrlFuente] = useState('')
  const [urlImagen, setUrlImagen] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Guardia de montado
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const cargarNews = useCallback(async () => {
    setError(null)
    const { data, error: err } = await supabase
      .from('noticias')
      .select('*')
      .order('created_at', { ascending: false })

    if (!mountedRef.current) return

    if (err) {
      setError('No se pudieron cargar las noticias. Intenta de nuevo.')
      return
    }
    setItems((data as NewsItem[]) ?? [])
  }, [])

  useEffect(() => {
    cargarNews().finally(() => setLoading(false))
  }, [cargarNews])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return items.filter(item => {
      const matchesSearch =
        !q ||
        item.titulo.toLowerCase().includes(q) ||
        item.descripcion.toLowerCase().includes(q)
      const matchesCategory =
        activeCategory === 'Todas' || detectCategoria(item) === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [items, searchQuery, activeCategory])

  const recientes = useMemo(
    () => filteredItems.filter(i => isReciente(i.created_at)),
    [filteredItems]
  )
  const anteriores = useMemo(
    () => filteredItems.filter(i => !isReciente(i.created_at)),
    [filteredItems]
  )

  function abrirModalCrear() {
    setEditingItem(null)
    setTitulo('')
    setDescripcion('')
    setUrlFuente('')
    setUrlImagen('')
    setFormError(null)
    setModalVisible(true)
  }

  function abrirModalEditar(item: NewsItem) {
    setEditingItem(item)
    setTitulo(item.titulo)
    setDescripcion(item.descripcion)
    setUrlFuente(item.url_fuente)
    setUrlImagen(item.url_imagen ?? '')
    setFormError(null)
    setModalVisible(true)
  }

  function cerrarModal() {
    setModalVisible(false)
    setFormError(null)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !descripcion.trim() || !urlFuente.trim()) {
      setFormError('Completa todos los campos obligatorios.')
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      if (editingItem) {
        const { error: err } = await supabase
          .from('noticias')
          .update({
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            url_fuente: urlFuente.trim(),
            url_imagen: urlImagen.trim() || null,
          })
          .eq('id', editingItem.id)
        if (err) {
          setFormError('Error al guardar: ' + err.message)
          return
        }
      } else {
        const { error: err } = await supabase.from('noticias').insert({
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          url_fuente: urlFuente.trim(),
          url_imagen: urlImagen.trim() || null,
          created_by: usuario!.id,
        })
        if (err) {
          setFormError('Error al guardar: ' + err.message)
          return
        }
      }
      cerrarModal()
      await cargarNews()
    } catch {
      setFormError('Error de red. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  function handleEliminar(item: NewsItem) {
    setAlert({
      title: 'Eliminar noticia',
      message: `¿Eliminar "${item.titulo}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        await supabase.from('noticias').delete().eq('id', item.id)
        await cargarNews()
      },
    })
  }

  if (loading) return <NewsSkeleton />

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div className="px-4 md:px-6 py-5" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
        <div className="max-w-[1100px] mx-auto flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 flex items-center justify-center rounded-xl"
                style={{
                  background: 'rgba(85,239,196,0.12)',
                  border: '1px solid rgba(85,239,196,0.2)',
                }}
              >
                <Newspaper size={15} className="text-primary-light" />
              </div>
              <div>
                <h1 className="font-extrabold text-xl tracking-tight text-text-primary">
                  Noticias
                </h1>
                <p className="text-xs text-text-muted">
                  {filteredItems.length === items.length
                    ? `${items.length} ${items.length === 1 ? 'noticia' : 'noticias'}`
                    : `${filteredItems.length} de ${items.length} noticias`}
                </p>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={abrirModalCrear}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-95 bg-gradient-primary"
                style={{ boxShadow: '0 4px 14px rgba(85,239,196,0.3)' }}
              >
                <Plus size={15} />
                Añadir noticia
              </button>
            )}
          </div>

          {/* Search & Category filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search input */}
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar noticias..."
                className="w-full h-10 pl-9 pr-3 rounded-xl text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors duration-150"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--border)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(85,239,196,0.35)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              {CATEGORIES.map(cat => {
                const active = activeCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
                    style={{
                      background: active ? 'rgba(85,239,196,0.12)' : 'var(--color-surface-2)',
                      color: active ? '#55efc4' : 'var(--color-text-muted)',
                      border: active ? '1px solid rgba(85,239,196,0.3)' : '1px solid var(--border)',
                    }}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-8">

        {/* Error de carga */}
        {error && (
          <div
            className="mb-5 rounded-xl px-4 py-3 text-sm font-medium text-red-300"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {error}
          </div>
        )}

        {/* Estado vacío global */}
        {!error && items.length === 0 && (
          <div
            className="py-16 flex flex-col items-center gap-4 text-center rounded-2xl"
            style={{
              background: 'var(--gradient-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="w-16 h-16 flex items-center justify-center rounded-2xl"
              style={{
                background: 'rgba(85,239,196,0.1)',
                border: '1px solid rgba(85,239,196,0.2)',
              }}
            >
              <Newspaper size={28} className="text-primary-light" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">
                No hay noticias todavía
              </p>
              {isAdmin ? (
                <p className="text-sm mt-1 text-text-muted">
                  Añade la primera con el botón de arriba.
                </p>
              ) : (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Shield size={12} className="text-text-muted" />
                  <span className="text-xs text-text-muted">Solo admins pueden añadir noticias</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sin resultados para filtros activos */}
        {!error && items.length > 0 && filteredItems.length === 0 && (
          <div
            className="py-16 flex flex-col items-center gap-4 text-center rounded-2xl"
            style={{
              background: 'var(--gradient-card)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="w-16 h-16 flex items-center justify-center rounded-2xl"
              style={{
                background: 'rgba(85,239,196,0.1)',
                border: '1px solid rgba(85,239,196,0.2)',
              }}
            >
              <Search size={28} className="text-primary-light" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">No se encontraron noticias</p>
              <p className="text-sm mt-1 text-text-muted">
                Prueba ajustando la búsqueda o los filtros de categoría.
              </p>
            </div>
          </div>
        )}

        {/* Secciones */}
        {!error && filteredItems.length > 0 && (
          <>
            {/* Recientes */}
            <section>
              <SectionLabel
                label="Recientes"
                count={recientes.length}
                color="#55efc4"
                colorBg="rgba(85,239,196,0.1)"
                colorBorder="rgba(85,239,196,0.2)"
              />
              {recientes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recientes.map(n => (
                    <NewsCard
                      key={n.id}
                      noticia={n}
                      isAdmin={isAdmin}
                      onDelete={() => handleEliminar(n)}
                      onEdit={() => abrirModalEditar(n)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="py-6 text-center rounded-xl"
                  style={{ border: '1px dashed var(--border)' }}
                >
                  <p className="text-sm text-text-muted">No hay noticias recientes</p>
                </div>
              )}
            </section>

            {/* Anteriores */}
            <section>
              <SectionLabel
                label="Anteriores"
                count={anteriores.length}
                color="var(--color-text-muted)"
                colorBg="var(--overlay-04)"
                colorBorder="var(--overlay-06)"
              />
              {anteriores.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {anteriores.map(n => (
                    <NewsCard
                      key={n.id}
                      noticia={n}
                      isAdmin={isAdmin}
                      onDelete={() => handleEliminar(n)}
                      onEdit={() => abrirModalEditar(n)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="py-6 text-center rounded-xl"
                  style={{ border: '1px dashed var(--border)' }}
                >
                  <p className="text-sm text-text-muted">No hay noticias anteriores</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Modal añadir noticia ── */}
      {modalVisible && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(8px)' }}
            onClick={cerrarModal}
          />

          {/* Panel */}
          <div
            className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-modal animate-scale-in-modal overflow-hidden"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--overlay-08)',
            }}
          >
            {/* Accent band */}
            <div
              className="h-[3px]"
              style={{ background: 'linear-gradient(90deg, #55efc4, #00cec9, #00cec9)' }}
            />

            {/* Handle mobile */}
            <div
              className="w-8 h-1 mx-auto mt-4 mb-1 sm:hidden rounded-full"
              style={{ background: 'var(--overlay-15)' }}
            />

            <div className="p-6 pt-4 sm:pt-6">
              {/* Modal header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{
                      background: 'rgba(85,239,196,0.12)',
                      border: '1px solid rgba(85,239,196,0.2)',
                    }}
                  >
                    <Newspaper size={15} className="text-primary-light" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-xl text-text-primary">
                      {editingItem ? 'Editar noticia' : 'Nueva noticia'}
                    </h2>
                    {/* Content-type badges */}
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {['Artículo', 'Repositorio', 'Herramienta', 'Video'].map(tag => (
                        <span
                          key={tag}
                          className="text-[0.65rem] px-2 py-0.5 rounded-full text-primary-light"
                          style={{ background: 'rgba(85,239,196,0.08)' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <IconButton
                  onClick={cerrarModal}
                  label="Cerrar"
                  variant="surface"
                  size="sm"
                  icon={<X size={14} />}
                  className="!w-7 !h-7"
                />
              </div>

              <form onSubmit={handleGuardar} className="flex flex-col gap-4">
                <Input
                  label="Título *"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ej: Nueva actualización de React 19"
                  autoFocus
                />

                <TextArea
                  label="Descripción *"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Resumen de la noticia..."
                  rows={4}
                />

                <Input
                  label="URL de la fuente *"
                  type="url"
                  value={urlFuente}
                  onChange={e => setUrlFuente(e.target.value)}
                  placeholder="https://..."
                />

                <div className="flex flex-col gap-1.5">
                  <Input
                    label="URL de la imagen (opcional)"
                    type="url"
                    value={urlImagen}
                    onChange={e => setUrlImagen(e.target.value)}
                    placeholder="https://..."
                  />
                  {/* Image preview */}
                  {urlImagen.trim() && (
                    <ImagePreview url={urlImagen.trim()} />
                  )}
                </div>

                {/* Error de formulario */}
                {formError && (
                  <p
                    className="text-xs font-medium rounded-lg px-3 py-2 text-red-300"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                    }}
                  >
                    {formError}
                  </p>
                )}

                {/* Campos obligatorios */}
                <p className="text-xs text-text-muted">* Campos obligatorios</p>

                {/* Acciones */}
                <div className="flex gap-3 mt-1">
                  <Button type="button" variant="ghost" onClick={cerrarModal} className="flex-1 py-3 text-sm">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving} loading={saving} className="flex-[2] py-3 text-sm">
                    {saving ? 'Guardando...' : (editingItem ? 'Guardar cambios' : 'Guardar')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── AlertModal ── */}
      <AlertModal
        visible={alert !== null}
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
