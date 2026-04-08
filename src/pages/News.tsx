import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Newspaper, Plus, Trash2, ExternalLink, X, ImageOff, Shield, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import AlertModal from '../components/AlertModal'

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function NewsSkeleton() {
  return (
    <div className="h-full overflow-y-auto animate-pulse">
      {/* Header skeleton */}
      <div
        className="px-4 md:px-6 py-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-[1100px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />
            <div className="flex flex-col gap-1.5">
              <div
                className="h-5 w-28 rounded-md"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              />
              <div
                className="h-3 w-20 rounded-md"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
            </div>
          </div>
          <div
            className="h-9 w-36 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="h-44"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            />
            <div className="p-4 flex flex-col gap-3">
              <div
                className="h-4 w-3/4 rounded-md"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              />
              <div className="flex flex-col gap-1.5">
                <div
                  className="h-3 w-full rounded-md"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                />
                <div
                  className="h-3 w-5/6 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                />
                <div
                  className="h-3 w-2/3 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                <div
                  className="h-3 w-20 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                />
                <div
                  className="h-3 w-16 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                />
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

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200 group"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(99,102,241,0.25)'
        el.style.background = 'rgba(255,255,255,0.04)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(255,255,255,0.08)'
        el.style.background = 'rgba(255,255,255,0.03)'
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
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <Newspaper size={36} style={{ color: '#374151' }} />
          </div>
        )}

        {/* Botones admin — top-right overlay */}
        {isAdmin && (
          <>
            <button
              onClick={e => { e.stopPropagation(); onEdit() }}
              className="absolute top-2.5 right-11 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
              style={{
                background: 'rgba(15,18,25,0.8)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#818cf8',
                backdropFilter: 'blur(6px)',
              }}
              aria-label="Editar noticia"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
              style={{
                background: 'rgba(15,18,25,0.8)',
                border: '1px solid rgba(244,63,94,0.3)',
                color: '#f43f5e',
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
        <h3 className="font-bold text-sm leading-snug" style={{ color: '#f1f5f9' }}>
          {noticia.titulo}
        </h3>

        <p
          className="text-sm leading-relaxed line-clamp-5 flex-1"
          style={{ color: '#94a3b8' }}
        >
          {noticia.descripcion}
        </p>

        <div className="flex items-center justify-between mt-auto pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-xs" style={{ color: '#64748b' }}>
            {formatFecha(noticia.created_at)}
          </span>
          <a
            href={noticia.url_fuente}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold transition-colors duration-150"
            style={{ color: '#818cf8' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#a5b4fc' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#818cf8' }}
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
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      {errored ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
          <ImageOff size={22} style={{ color: '#374151' }} />
          <span className="text-xs" style={{ color: '#4b5563' }}>No se pudo cargar la imagen</span>
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

  // Form state
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [urlFuente, setUrlFuente] = useState('')
  const [urlImagen, setUrlImagen] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Guardia de montado: evita actualizaciones de estado si el usuario navega
  // fuera antes de que la query de Supabase termine
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
      <div
        className="px-4 md:px-6 py-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-[1100px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{
                background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            >
              <Newspaper size={15} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h1
                className="font-extrabold text-xl tracking-tight"
                style={{ color: '#f1f5f9' }}
              >
                Noticias
              </h1>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {items.length} {items.length === 1 ? 'noticia' : 'noticias'}
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={abrirModalCrear}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              }}
            >
              <Plus size={15} />
              Añadir noticia
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-[1100px] mx-auto p-4 md:p-6">

        {/* Error de carga */}
        {error && (
          <div
            className="mb-5 rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5',
            }}
          >
            {error}
          </div>
        )}

        {/* Estado vacío */}
        {!error && items.length === 0 && (
          <div
            className="py-16 flex flex-col items-center gap-4 text-center rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="w-16 h-16 flex items-center justify-center rounded-2xl"
              style={{
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}
            >
              <Newspaper size={28} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#f1f5f9' }}>
                No hay noticias todavía
              </p>
              {isAdmin ? (
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                  Añade la primera con el botón de arriba.
                </p>
              ) : (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Shield size={12} style={{ color: '#4b5563' }} />
                  <span className="text-xs" style={{ color: '#4b5563' }}>Solo admins pueden añadir noticias</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grid de noticias */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(n => (
              <NewsCard
                key={n.id}
                noticia={n}
                isAdmin={isAdmin}
                onDelete={() => handleEliminar(n)}
                onEdit={() => abrirModalEditar(n)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal añadir noticia ── */}
      {modalVisible && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={cerrarModal}
          />

          {/* Panel */}
          <div
            className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-modal animate-scale-in-modal overflow-hidden"
            style={{
              background: '#1a1d27',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Accent band */}
            <div
              style={{
                height: '3px',
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
              }}
            />

            {/* Handle mobile */}
            <div
              className="w-8 h-1 mx-auto mt-4 mb-1 sm:hidden rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            />

            <div className="p-6 pt-4 sm:pt-6">
              {/* Modal header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.2)',
                    }}
                  >
                    <Newspaper size={15} style={{ color: '#818cf8' }} />
                  </div>
                  <div>
                    <h2
                      className="font-extrabold text-xl"
                      style={{ color: '#f1f5f9' }}
                    >
                      {editingItem ? 'Editar noticia' : 'Nueva noticia'}
                    </h2>
                    {/* Content-type badges */}
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {['Artículo', 'Repositorio', 'Herramienta', 'Video'].map(tag => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(99,102,241,0.08)',
                            color: '#818cf8',
                            fontSize: '0.65rem',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={cerrarModal}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: '#64748b',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.color = '#e2e8f0'
                    el.style.background = 'rgba(255,255,255,0.1)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.color = '#64748b'
                    el.style.background = 'rgba(255,255,255,0.06)'
                  }}
                  aria-label="Cerrar"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleGuardar} className="flex flex-col gap-4">
                {/* Título */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                    Título *
                  </label>
                  <input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ej: Nueva actualización de React 19"
                    autoFocus
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.75rem',
                      color: '#f1f5f9',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      width: '100%',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {/* Descripción */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                    Descripción *
                  </label>
                  <textarea
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Resumen de la noticia..."
                    rows={4}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.75rem',
                      color: '#f1f5f9',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      width: '100%',
                      resize: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {/* URL fuente */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                    URL de la fuente *
                  </label>
                  <input
                    type="url"
                    value={urlFuente}
                    onChange={e => setUrlFuente(e.target.value)}
                    placeholder="https://..."
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.75rem',
                      color: '#f1f5f9',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      width: '100%',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {/* URL imagen */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                    URL de la imagen{' '}
                    <span style={{ color: '#4b5563', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <input
                    type="url"
                    value={urlImagen}
                    onChange={e => setUrlImagen(e.target.value)}
                    placeholder="https://..."
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '0.75rem',
                      color: '#f1f5f9',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      width: '100%',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  {/* Image preview */}
                  {urlImagen.trim() && (
                    <ImagePreview url={urlImagen.trim()} />
                  )}
                </div>

                {/* Error de formulario */}
                {formError && (
                  <p
                    className="text-xs font-medium rounded-lg px-3 py-2"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#fca5a5',
                    }}
                  >
                    {formError}
                  </p>
                )}

                {/* Campos obligatorios */}
                <p className="text-xs" style={{ color: '#4b5563' }}>* Campos obligatorios</p>

                {/* Acciones */}
                <div className="flex gap-3 mt-1">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-150"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#94a3b8',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(255,255,255,0.08)'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'rgba(255,255,255,0.05)'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-[2] py-3 text-sm font-semibold text-white rounded-xl active:scale-[0.98] transition-all duration-150 disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                    }}
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full animate-spin"
                          style={{
                            border: '1.5px solid rgba(255,255,255,0.2)',
                            borderTopColor: 'white',
                          }}
                        />
                        Guardando...
                      </span>
                    ) : (
                      editingItem ? 'Guardar cambios' : 'Guardar'
                    )}
                  </button>
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
