import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { markDocsVisited } from '../hooks/useUnreadCounts'
import {
  useDocColeccion, fetchPagina, createPagina, savePagina, deletePagina, fetchRevisiones,
  updateColeccion, deleteColeccion, fetchPaginasCompletas,
  type DocPagina, type DocRevision, type ColeccionInput,
} from '../hooks/useDocs'
import LectorView from '../components/docs/LectorView'
import { HistorialDialogo, NuevaPaginaDialogo } from '../components/docs/Dialogos'
import { Vacio } from '../components/docs/Piezas'
import ColeccionModal from '../components/docs/ColeccionModal'
import ImportModal from '../components/docs/ImportModal'
import AlertModal from '../components/AlertModal'
import { Button } from '../components/ui'
import { slugify } from '../lib/markdown'
import { crearZip } from '../lib/zip'

type AlertState = {
  type?: 'error' | 'warning' | 'info'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

function nombreArchivo(nombre: string) {
  return nombre.replace(/[\\/:*?"<>|]/g, '_').trim() || 'sin-titulo'
}

function descargarBlob(nombre: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

function descargar(nombre: string, contenido: string) {
  descargarBlob(`${nombreArchivo(nombre)}.md`, new Blob([contenido], { type: 'text/markdown;charset=utf-8' }))
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
  const [descargandoZip, setDescargandoZip] = useState(false)
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

  async function descargarColeccion() {
    if (!coleccion || descargandoZip) return
    setDescargandoZip(true)
    const { paginas: completas, error: err } = await fetchPaginasCompletas(coleccion.id)
    setDescargandoZip(false)
    if (err) { setAlert({ type: 'error', title: 'No se pudo descargar la colección', message: err }); return }
    if (completas.length === 0) { setAlert({ type: 'info', title: 'La colección está vacía', message: 'No hay páginas que descargar.' }); return }

    const carpeta = nombreArchivo(coleccion.titulo)
    const usados = new Set<string>()
    const archivos = completas.map(p => {
      const base = nombreArchivo(p.titulo)
      let nombre = base
      for (let i = 2; usados.has(nombre.toLowerCase()); i++) nombre = `${base} (${i})`
      usados.add(nombre.toLowerCase())
      return { nombre: `${carpeta}/${nombre}.md`, contenido: p.contenido }
    })
    descargarBlob(`${carpeta}.zip`, crearZip(archivos))
  }

  function confirmarBorrarColeccion() {
    if (!coleccion) return
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
      <div className="h-full flex items-center justify-center" role="status" aria-label="Cargando colección">
        <Loader2 size={26} className="motion-safe:animate-spin text-primary-light" />
      </div>
    )
  }

  if (error || !coleccion) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 md:px-6 py-10">
          <Vacio
            Icon={ArrowLeft}
            titulo={error ? 'No se pudo cargar la colección' : 'Esta colección no existe'}
            mensaje={error ?? 'Puede que se haya borrado o que el enlace no sea correcto.'}
            accion={<Button variant="ghost" icon={<ArrowLeft size={14} aria-hidden="true" />} onClick={() => navigate('/docs')} className="flex items-center justify-center gap-2">Volver a la biblioteca</Button>}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <LectorView
        coleccion={coleccion}
        paginas={paginas}
        paginaId={paginaId}
        pagina={pagina}
        loading={loading}
        paginaLoading={paginaLoading}
        mainRef={mainRef}
        puedeGestionarColeccion={puedeGestionar(coleccion.created_by)}
        puedeGestionarPagina={!!pagina && puedeGestionar(pagina.created_by)}
        descargandoZip={descargandoZip}
        indiceAbierto={sidebarOpen}
        onIndiceAbierto={setSidebarOpen}
        filtroPaginas={filtroPaginas}
        onFiltroPaginas={setFiltroPaginas}
        editing={editing}
        draft={draft}
        onDraft={setDraft}
        preview={preview}
        onPreview={setPreview}
        saving={saving}
        dirty={dirty}
        onGuardar={() => void guardar()}
        onCancelarEdicion={cancelarEdicion}
        onEditorKeys={handleEditorKeys}
        onEmpezarEdicion={() => empezarEdicion()}
        onVolver={() => { if (confirmarSalida()) navigate('/docs') }}
        onAbrirPagina={abrirPagina}
        onNuevaPagina={pedirNuevaPagina}
        onImportar={() => setShowImport(true)}
        onEditarColeccion={() => setShowEditColeccion(true)}
        onBorrarColeccion={confirmarBorrarColeccion}
        onDescargarColeccion={() => void descargarColeccion()}
        onHistorial={() => void abrirHistorial()}
        onDescargarPagina={() => { if (pagina) descargar(pagina.titulo, pagina.contenido) }}
        onBorrarPagina={confirmarBorrarPagina}
      />

      <NuevaPaginaDialogo
        titulo={nuevaTitulo}
        error={nuevaError}
        creando={creando}
        onTitulo={setNuevaTitulo}
        onSubmit={handleCrearPagina}
        onClose={() => setNuevaTitulo(null)}
      />

      <HistorialDialogo
        revisiones={revisiones}
        seleccionada={revisionSel}
        onSeleccionar={setRevisionSel}
        tituloPagina={pagina?.titulo}
        paginas={paginas}
        onRestaurar={r => { setRevisiones(null); empezarEdicion(r.contenido) }}
        onClose={() => setRevisiones(null)}
      />

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
    </>
  )
}
