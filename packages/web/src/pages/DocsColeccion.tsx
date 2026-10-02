import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, BookMarked, Download, Eye, FileText, History, Loader2, Menu, MoreHorizontal,
  Pencil, Plus, Save, Search, Settings2, Trash2, Upload, X,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { markDocsVisited } from '../hooks/useUnreadCounts'
import {
  useDocColeccion, fetchPagina, createPagina, savePagina, deletePagina, fetchRevisiones,
  updateColeccion, deleteColeccion, materiaLabel,
  type DocPagina, type DocRevision, type ColeccionInput,
} from '../hooks/useDocs'
import MarkdownView from '../components/docs/MarkdownView'
import ColeccionModal from '../components/docs/ColeccionModal'
import ImportModal from '../components/docs/ImportModal'
import AlertModal from '../components/AlertModal'
import { Button, Input, Modal } from '../components/ui'
import { cn } from '../components/ui/cn'
import { slugify } from '../lib/markdown'

type AlertState = {
  type?: 'error' | 'warning' | 'info'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombre.replace(/[\\/:*?"<>|]/g, '_')}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DocsColeccion() {
  const { coleccionId, paginaId } = useParams<{ coleccionId: string; paginaId?: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { coleccion, paginas, loading, error, refresh } = useDocColeccion(coleccionId)

  const [pagina, setPagina] = useState<DocPagina | null>(null)
  const [paginaLoading, setPaginaLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ titulo: '', contenido: '' })
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [filtroPaginas, setFiltroPaginas] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)
  const [nuevaTitulo, setNuevaTitulo] = useState<string | null>(null)
  const [nuevaError, setNuevaError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [showEditColeccion, setShowEditColeccion] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [revisiones, setRevisiones] = useState<DocRevision[] | null>(null)
  const [revisionSel, setRevisionSel] = useState<DocRevision | null>(null)

  const mainRef = useRef<HTMLDivElement>(null)
  const pendingHeading = useRef<string | null>(null)
  const editAfterLoad = useRef(false)

  const esAdmin = usuario?.rol === 'admin' || usuario?.es_superadmin === true
  const puedeGestionar = (createdBy: string | null | undefined) => esAdmin || (!!usuario && createdBy === usuario.id)
  const dirty = editing && !!pagina && (draft.titulo !== pagina.titulo || draft.contenido !== pagina.contenido)

  useEffect(() => {
    if (usuario) markDocsVisited(usuario.id)
  }, [usuario])

  // Sin página en la URL → abre la primera de la colección
  useEffect(() => {
    if (!paginaId && !loading && paginas.length > 0 && coleccion) {
      navigate(`/docs/${coleccion.id}/${paginas[0].id}`, { replace: true })
    }
  }, [paginaId, loading, paginas, coleccion, navigate])

  // Carga la página activa
  useEffect(() => {
    if (!paginaId) { setPagina(null); return }
    let cancelled = false
    setPaginaLoading(true)
    fetchPagina(paginaId).then(({ pagina: p }) => {
      if (cancelled) return
      setPagina(p)
      setPaginaLoading(false)
      if (p && editAfterLoad.current) {
        editAfterLoad.current = false
        setDraft({ titulo: p.titulo, contenido: p.contenido })
        setEditing(true)
        setPreview(false)
      } else {
        setEditing(false)
      }
    })
    return () => { cancelled = true }
  }, [paginaId])

  // Tras cargar: salta al encabezado pedido por un [[Página#Encabezado]] o arriba del todo
  useEffect(() => {
    if (!pagina || paginaLoading) return
    const heading = pendingHeading.current
    pendingHeading.current = null
    requestAnimationFrame(() => {
      const el = heading ? document.getElementById(slugify(heading)) : null
      if (el) el.scrollIntoView({ block: 'start' })
      else mainRef.current?.scrollTo({ top: 0 })
    })
  }, [pagina, paginaLoading])

  // Aviso al cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const confirmarSalida = useCallback(() => {
    return !dirty || window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')
  }, [dirty])

  const abrirPagina = useCallback((id: string, heading: string | null = null) => {
    if (!coleccionId) return
    if (id === paginaId) {
      if (heading) document.getElementById(slugify(heading))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (!confirmarSalida()) return
    pendingHeading.current = heading
    setSidebarOpen(false)
    navigate(`/docs/${coleccionId}/${id}`)
  }, [coleccionId, paginaId, confirmarSalida, navigate])

  const pedirNuevaPagina = useCallback((titulo = '') => {
    setNuevaError(null)
    setNuevaTitulo(titulo)
  }, [])

  const paginasFiltradas = useMemo(() => {
    const q = filtroPaginas.trim().toLowerCase()
    return q ? paginas.filter(p => p.titulo.toLowerCase().includes(q)) : paginas
  }, [paginas, filtroPaginas])

  const coleccionInitial = useMemo<ColeccionInput | undefined>(
    () => coleccion ? { titulo: coleccion.titulo, descripcion: coleccion.descripcion, materia: coleccion.materia } : undefined,
    [coleccion]
  )

  // ── Acciones ──────────────────────────────────────────────────────────────

  async function handleCrearPagina(e: React.FormEvent) {
    e.preventDefault()
    const titulo = (nuevaTitulo ?? '').trim()
    if (!titulo || !coleccionId) { setNuevaError('El título es obligatorio.'); return }
    if (!confirmarSalida()) return
    setCreando(true)
    const orden = paginas.reduce((max, p) => Math.max(max, p.orden), -1) + 1
    const { id, error: err } = await createPagina(coleccionId, titulo, `# ${titulo}\n\n`, orden)
    setCreando(false)
    if (err || !id) { setNuevaError(err ?? 'No se pudo crear la página.'); return }
    setNuevaTitulo(null)
    refresh()
    editAfterLoad.current = true
    navigate(`/docs/${coleccionId}/${id}`)
  }

  function empezarEdicion(contenido?: string) {
    if (!pagina) return
    setDraft({ titulo: pagina.titulo, contenido: contenido ?? pagina.contenido })
    setPreview(false)
    setEditing(true)
  }

  async function guardar(forzar = false) {
    if (!pagina || saving) return
    const titulo = draft.titulo.trim()
    if (!titulo) { setAlert({ type: 'error', title: 'La página necesita un título' }); return }
    setSaving(true)

    let base = pagina.updated_at
    if (forzar) {
      const { pagina: actual } = await fetchPagina(pagina.id)
      if (actual) base = actual.updated_at
    }

    const res = await savePagina(pagina.id, { titulo, contenido: draft.contenido }, base)
    setSaving(false)

    if (res.error) { setAlert({ type: 'error', title: 'No se pudo guardar', message: res.error }); return }
    if (res.conflict) {
      setAlert({
        type: 'warning',
        title: 'Alguien ha editado esta página',
        message: 'Otra persona guardó cambios mientras editabas. Si sobrescribes, su versión quedará en el historial.',
        confirmLabel: 'Sobrescribir',
        confirmDestructive: true,
        onConfirm: () => { void guardar(true) },
      })
      return
    }
    if (res.pagina) {
      setPagina(res.pagina)
      setEditing(false)
      if (res.pagina.titulo !== pagina.titulo) refresh()
    }
  }

  function cancelarEdicion() {
    if (!confirmarSalida()) return
    setEditing(false)
  }

  function confirmarBorrarPagina() {
    if (!pagina) return
    setMenuOpen(false)
    setAlert({
      type: 'warning',
      title: `¿Borrar «${pagina.titulo}»?`,
      message: 'Se eliminará la página y su historial. No se puede deshacer.',
      confirmLabel: 'Borrar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error: err } = await deletePagina(pagina.id)
        if (err) { setAlert({ type: 'error', title: 'No se pudo borrar', message: err }); return }
        setEditing(false)
        refresh()
        navigate(`/docs/${coleccionId}`, { replace: true })
      },
    })
  }

  function confirmarBorrarColeccion() {
    if (!coleccion) return
    setMenuOpen(false)
    setAlert({
      type: 'warning',
      title: `¿Borrar la colección «${coleccion.titulo}»?`,
      message: `Se eliminarán sus ${paginas.length} páginas. No se puede deshacer.`,
      confirmLabel: 'Borrar colección',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error: err } = await deleteColeccion(coleccion.id)
        if (err) { setAlert({ type: 'error', title: 'No se pudo borrar', message: err }); return }
        navigate('/docs', { replace: true })
      },
    })
  }

  async function handleEditarColeccion(input: ColeccionInput) {
    if (!coleccion) return null
    const { error: err } = await updateColeccion(coleccion.id, input)
    if (err) return err
    setShowEditColeccion(false)
    refresh()
    return null
  }

  async function abrirHistorial() {
    if (!pagina) return
    setMenuOpen(false)
    setRevisionSel(null)
    setRevisiones([])
    const { revisiones: r, error: err } = await fetchRevisiones(pagina.id)
    if (err) { setRevisiones(null); setAlert({ type: 'error', title: 'No se pudo cargar el historial', message: err }); return }
    setRevisiones(r)
    setRevisionSel(r[0] ?? null)
  }

  function handleEditorKeys(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      void guardar()
      return
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      const el = e.currentTarget
      el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end')
      setDraft(d => ({ ...d, contenido: el.value }))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading && !coleccion) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={26} className="animate-spin text-primary" />
      </div>
    )
  }

  if (error || !coleccion) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold text-text-secondary">{error ? 'No se pudo cargar la colección' : 'Esta colección no existe'}</p>
        {error && <p className="text-sm text-text-muted">{error}</p>}
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={() => navigate('/docs')}>Volver a la biblioteca</Button>
      </div>
    )
  }

  const sidebar = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 flex flex-col gap-2 border-b border-white/[0.06]">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={filtroPaginas}
            onChange={e => setFiltroPaginas(e.target.value)}
            placeholder="Filtrar páginas"
            className="w-full rounded-lg border border-white/[0.08] bg-input pl-8 pr-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => pedirNuevaPagina()} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary-light hover:bg-primary/20 transition-colors">
            <Plus size={13} /> Página
          </button>
          <button onClick={() => setShowImport(true)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1.5 text-xs font-semibold text-text-secondary hover:bg-white/[0.08] transition-colors">
            <Upload size={13} /> Importar
          </button>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {paginasFiltradas.map(p => (
          <button
            key={p.id}
            onClick={() => abrirPagina(p.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
              p.id === paginaId ? 'bg-primary/15 text-primary-light font-semibold' : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
            )}
          >
            <FileText size={13} className="shrink-0 opacity-60" />
            <span className="truncate">{p.titulo}</span>
          </button>
        ))}
        {paginas.length > 0 && paginasFiltradas.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-text-muted">Sin coincidencias</p>
        )}
      </nav>
    </div>
  )

  return (
    <div className="animate-fade-in h-full flex flex-col min-h-0">
      {/* Cabecera de la colección */}
      <div className="px-4 md:px-6 py-3 border-b border-white/[0.08] flex items-center gap-3">
        <button
          onClick={() => { if (confirmarSalida()) navigate('/docs') }}
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl hover:bg-white/5 text-text-muted"
          aria-label="Volver a la biblioteca"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="md:hidden w-8 h-8 shrink-0 flex items-center justify-center rounded-xl hover:bg-white/5 text-text-muted"
          aria-label="Páginas"
        >
          <Menu size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BookMarked size={14} className="shrink-0 text-primary" />
            <h1 className="font-bold text-sm md:text-base text-text-primary truncate">{coleccion.titulo}</h1>
          </div>
          <p className="text-[11px] text-text-muted truncate">
            {materiaLabel(coleccion.materia)} · {paginas.length} {paginas.length === 1 ? 'página' : 'páginas'}
            {coleccion.descripcion ? ` · ${coleccion.descripcion}` : ''}
          </p>
        </div>
        {puedeGestionar(coleccion.created_by) && (
          <button
            onClick={() => setShowEditColeccion(true)}
            className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-muted hover:bg-white/5 hover:text-text-secondary"
          >
            <Settings2 size={13} /> Colección
          </button>
        )}
      </div>

      <div className="flex-1 flex min-h-0 relative">
        {/* Índice de páginas */}
        <aside className="hidden md:flex w-64 shrink-0 border-r border-white/[0.08] flex-col min-h-0">
          {sidebar}
        </aside>
        {sidebarOpen && (
          <div className="md:hidden absolute inset-0 z-20 flex">
            <div className="w-72 max-w-[85%] bg-surface border-r border-white/[0.08] flex flex-col min-h-0 animate-fade-in">
              {sidebar}
            </div>
            <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
          </div>
        )}

        {/* Contenido */}
        <div ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
          {paginas.length === 0 && !paginaId ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/10">
                <FileText size={22} className="text-primary" />
              </div>
              <p className="font-semibold text-text-secondary">La colección está vacía</p>
              <p className="text-sm text-text-muted">Crea la primera página o importa archivos .md.</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="ghost" icon={<Upload size={14} />} onClick={() => setShowImport(true)}>Importar</Button>
                <Button size="sm" icon={<Plus size={14} />} onClick={() => pedirNuevaPagina()}>Nueva página</Button>
              </div>
            </div>
          ) : paginaLoading || (!pagina && !!paginaId && loading) ? (
            <div className="flex justify-center py-24">
              <Loader2 size={24} className="animate-spin text-primary-light" />
            </div>
          ) : !pagina ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
              <p className="font-semibold text-text-secondary">Esta página no existe</p>
              <p className="text-sm text-text-muted">Puede que alguien la haya borrado.</p>
            </div>
          ) : editing ? (
            <div className="h-full flex flex-col min-h-0">
              <div className="px-4 md:px-6 py-3 border-b border-white/[0.06] flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[12rem]">
                  <Input
                    value={draft.titulo}
                    maxLength={200}
                    onChange={e => setDraft(d => ({ ...d, titulo: e.target.value }))}
                    className="py-2 font-semibold"
                    aria-label="Título de la página"
                  />
                </div>
                <button
                  onClick={() => setPreview(p => !p)}
                  className="lg:hidden flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-text-secondary bg-white/[0.04] hover:bg-white/[0.08]"
                >
                  {preview ? <Pencil size={13} /> : <Eye size={13} />}
                  {preview ? 'Editar' : 'Vista previa'}
                </button>
                <Button variant="ghost" size="sm" onClick={cancelarEdicion}>Cancelar</Button>
                <Button size="sm" loading={saving} icon={<Save size={14} />} onClick={() => void guardar()} disabled={!dirty}>
                  Guardar
                </Button>
              </div>
              <div className="flex-1 min-h-0 grid lg:grid-cols-2">
                <textarea
                  value={draft.contenido}
                  onChange={e => setDraft(d => ({ ...d, contenido: e.target.value }))}
                  onKeyDown={handleEditorKeys}
                  spellCheck={false}
                  placeholder="Escribe en Markdown… Usa [[Otra página]] para enlazar páginas de esta colección."
                  className={cn(
                    'min-h-[60vh] lg:min-h-0 h-full w-full resize-none bg-input px-4 md:px-6 py-4 font-mono text-[13px] leading-relaxed text-text-primary outline-none lg:border-r border-white/[0.06]',
                    preview && 'hidden lg:block'
                  )}
                />
                <div className={cn('overflow-y-auto px-4 md:px-8 py-6', !preview && 'hidden lg:block')}>
                  <MarkdownView content={draft.contenido} pages={paginas} onOpenPage={abrirPagina} onMissingPage={pedirNuevaPagina} />
                </div>
              </div>
              <p className="px-4 md:px-6 py-1.5 text-[11px] text-text-muted border-t border-white/[0.06]">
                Markdown + GFM · callouts <code>&gt; [!tip]</code> · enlaces <code>[[Página]]</code> · Ctrl+S para guardar
              </p>
            </div>
          ) : (
            <article className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                <p className="text-xs text-text-muted">
                  {pagina.updated_by_nombre ? <>Editado por <span className="text-text-secondary">{pagina.updated_by_nombre}</span> · </> : null}
                  {formatFechaHora(pagina.updated_at)}
                </p>
                <div className="flex items-center gap-1.5 relative">
                  <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => empezarEdicion()}>
                    Editar
                  </Button>
                  <button
                    onClick={() => setMenuOpen(o => !o)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/[0.08] text-text-muted hover:bg-white/5"
                    aria-label="Más opciones"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-white/[0.1] bg-surface-2 p-1 shadow-modal">
                        <MenuItem Icon={History} label="Historial de cambios" onClick={() => void abrirHistorial()} />
                        <MenuItem Icon={Download} label="Descargar .md" onClick={() => { setMenuOpen(false); descargar(pagina.titulo, pagina.contenido) }} />
                        {puedeGestionar(coleccion.created_by) && (
                          <MenuItem Icon={Settings2} label="Editar colección" onClick={() => { setMenuOpen(false); setShowEditColeccion(true) }} />
                        )}
                        {puedeGestionar(pagina.created_by) && (
                          <MenuItem Icon={Trash2} label="Borrar página" danger onClick={confirmarBorrarPagina} />
                        )}
                        {puedeGestionar(coleccion.created_by) && (
                          <MenuItem Icon={Trash2} label="Borrar colección" danger onClick={confirmarBorrarColeccion} />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <MarkdownView content={pagina.contenido} pages={paginas} onOpenPage={abrirPagina} onMissingPage={pedirNuevaPagina} />
            </article>
          )}
        </div>
      </div>

      {/* Nueva página */}
      <Modal open={nuevaTitulo !== null} onClose={() => setNuevaTitulo(null)} maxWidthClassName="max-w-sm">
        <form onSubmit={handleCrearPagina} className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-text-primary">Nueva página</h2>
            <button type="button" onClick={() => setNuevaTitulo(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5 text-text-muted" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          <Input
            label="Título"
            value={nuevaTitulo ?? ''}
            maxLength={200}
            autoFocus
            onChange={e => setNuevaTitulo(e.target.value)}
            placeholder="Ej. 07 - Conclusiones"
            error={nuevaError ?? undefined}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNuevaTitulo(null)}>Cancelar</Button>
            <Button type="submit" loading={creando}>Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Historial */}
      <Modal open={revisiones !== null} onClose={() => setRevisiones(null)} maxWidthClassName="max-w-5xl">
        <div className="flex flex-col h-[80vh]">
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold text-base text-text-primary">Historial de cambios</h2>
              <p className="text-xs text-text-muted truncate">{pagina?.titulo}</p>
            </div>
            <button onClick={() => setRevisiones(null)} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl hover:bg-white/5 text-text-muted" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          {revisiones && revisiones.length === 0 ? (
            <p className="flex-1 flex items-center justify-center text-sm text-text-muted">Esta página todavía no tiene versiones anteriores.</p>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col md:flex-row">
              <ul className="md:w-60 shrink-0 max-h-40 md:max-h-none overflow-y-auto border-b md:border-b-0 md:border-r border-white/[0.08] p-2 flex flex-col gap-0.5">
                {revisiones?.map(r => (
                  <li key={r.id}>
                    <button
                      onClick={() => setRevisionSel(r)}
                      className={cn(
                        'w-full text-left rounded-lg px-3 py-2 transition-colors',
                        revisionSel?.id === r.id ? 'bg-primary/15' : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <span className="block text-xs font-semibold text-text-primary">{formatFechaHora(r.created_at)}</span>
                      <span className="block text-[11px] text-text-muted truncate">{r.editado_por_nombre || 'Desconocido'}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                {revisionSel && (
                  <>
                    <div className="px-5 py-2.5 border-b border-white/[0.06] flex items-center justify-between gap-3">
                      <p className="text-xs text-text-muted truncate">Versión «{revisionSel.titulo}»</p>
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => {
                          setRevisiones(null)
                          empezarEdicion(revisionSel.contenido)
                        }}
                      >
                        Restaurar en el editor
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 md:px-8 py-5">
                      <MarkdownView content={revisionSel.contenido} pages={paginas} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ColeccionModal
        open={showEditColeccion}
        initial={coleccionInitial}
        title="Editar colección"
        submitLabel="Guardar"
        onClose={() => setShowEditColeccion(false)}
        onSubmit={handleEditarColeccion}
      />
      <ImportModal
        open={showImport}
        coleccionFija={coleccion}
        onClose={() => setShowImport(false)}
        onDone={() => {
          setShowImport(false)
          refresh()
          if (paginaId) fetchPagina(paginaId).then(({ pagina: p }) => { if (p) setPagina(p) })
        }}
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

function MenuItem({ Icon, label, onClick, danger }: { Icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors',
        danger ? 'text-rose-400 hover:bg-rose-500/10' : 'text-text-secondary hover:bg-white/[0.05] hover:text-text-primary'
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
