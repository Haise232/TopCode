import { useEffect, useState, useCallback, useMemo } from 'react'
import { Upload, FileText, Image, File, Trash2, ExternalLink, RefreshCw, FolderOpen, CloudUpload, Download, Search, LayoutGrid, LayoutList, SearchX, User, Users, Inbox, X, Eye, BookOpen } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useApuntes } from '../hooks/useApuntes'
import type { ApunteConAutor } from '../hooks/useApuntes'
import { MATERIAS } from '../constants/materias'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'
import { Spinner } from '../components/ui'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

type FiltroTipo = 'todos' | 'pdf' | 'imagen' | 'otro'

function tipoFromMime(mime: string): 'pdf' | 'imagen' | 'otro' {
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'imagen'
  return 'otro'
}

const TIPO_CONFIG = {
  pdf:    { Icon: FileText, color: '#f43f5e', bg: 'rgba(244,63,94,0.08)',    border: 'rgba(244,63,94,0.18)',    label: 'PDF'  },
  imagen: { Icon: Image,    color: '#10b981', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.15)',   label: 'IMG'  },
  otro:   { Icon: File,     color: '#8ff5d6', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.15)', label: 'FILE' },
}

function UserAvatar({ nombre, url, size = 24 }: { nombre: string; url?: string | null; size?: number }) {
  if (url) return (
    <img src={url} alt={nombre} className="rounded-lg object-cover shrink-0"
      style={{ width: size, height: size, border: '1.5px solid var(--overlay-08)' }} />
  )
  const hue = nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div className="rounded-lg flex items-center justify-center font-bold shrink-0"
      style={{
        width: size, height: size,
        background: `hsla(${hue},55%,60%,0.25)`,
        border: `1.5px solid hsla(${hue},55%,50%,0.35)`,
        color: `hsla(${hue},75%,35%,1)`,
        fontSize: size * 0.42,
      }}
    >
      {nombre[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function ApuntesSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
        <SkeletonBox className="h-7 w-32 shimmer" />
        <SkeletonBox className="h-10 w-36 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <SkeletonBox className="h-8 w-8 shimmer rounded-xl" />
            <SkeletonBox className="h-4 w-36 shimmer" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <SkeletonCard key={i} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between">
                  <SkeletonBox className="h-11 w-11 shimmer rounded-2xl" />
                  <SkeletonBox className="h-6 w-12 shimmer rounded-lg" />
                </div>
                <SkeletonBox className="h-4 w-4/5 shimmer" />
                <SkeletonBox className="h-3 w-2/5 shimmer" />
                <SkeletonBox className="h-9 shimmer rounded-xl" />
              </SkeletonCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Apuntes() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'

  const {
    apuntes,
    loading,
    subiendo,
    init,
    refresh,
    subirApunte,
    eliminarApunte,
  } = useApuntes()

  const [refreshing, setRefreshing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  // Filtros y vista
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [filtroMateria, setFiltroMateria] = useState<string>('todas')
  const [vistaLista, setVistaLista] = useState(false)

  // Modal de subida con selección de materia
  const [uploadPendingFile, setUploadPendingFile] = useState<File | null>(null)
  const [uploadTipo, setUploadTipo] = useState<'pdf' | 'imagen' | 'otro'>('otro')
  const [uploadMateria, setUploadMateria] = useState<string>('')

  // Preview inline
  const [previewApunte, setPreviewApunte] = useState<ApunteConAutor | null>(null)

  useEffect(() => { init() }, [init])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  // En vez de subir directamente, abre el modal de confirmación
  function prepararSubida(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      setAlert({ type: 'error', title: 'Archivo muy grande', message: 'El archivo no puede superar los 20 MB.' })
      return
    }
    setUploadTipo(tipoFromMime(file.type))
    setUploadMateria('')
    setUploadPendingFile(file)
  }

  async function handleConfirmUpload() {
    if (!uploadPendingFile || !usuario) return
    const { error } = await subirApunte(uploadPendingFile, usuario.id, uploadTipo, uploadMateria || null)
    setUploadPendingFile(null)
    if (error) {
      setAlert({ type: 'error', title: 'Error al subir', message: error })
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    prepararSubida(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) prepararSubida(file)
  }

  function handleEliminar(ap: ApunteConAutor) {
    const esPropio = ap.usuario_id === usuario?.id
    if (!esPropio && !isAdmin) return
    const autor = ap.usuarios?.nombre ?? 'este usuario'
    setAlert({
      title: 'Eliminar apunte',
      message: isAdmin && !esPropio
        ? `¿Eliminar "${ap.nombre}" subido por ${autor}?`
        : `¿Eliminar "${ap.nombre}"?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await eliminarApunte(ap)
        if (error) setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar el archivo.' })
      },
    })
  }

  // Estadísticas
  const totalPdf = useMemo(() => apuntes.filter(ap => ap.tipo === 'pdf').length, [apuntes])
  const totalImg = useMemo(() => apuntes.filter(ap => ap.tipo === 'imagen').length, [apuntes])
  const totalUsuarios = useMemo(() => new Set(apuntes.map(ap => ap.usuario_id)).size, [apuntes])

  // Materias que aparecen en los apuntes (para el selector de filtro)
  const materiasEnUso = useMemo(() => {
    const set = new Set<string>()
    apuntes.forEach(ap => { if (ap.materia) set.add(ap.materia) })
    return Array.from(set).sort()
  }, [apuntes])

  const apuntesFiltrados = useMemo(() => apuntes.filter(ap => {
    const coincideBusqueda = busqueda.trim() === '' || ap.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const coincideTipo = filtroTipo === 'todos' || ap.tipo === filtroTipo
    const coincideMateria = filtroMateria === 'todas' || ap.materia === filtroMateria
    return coincideBusqueda && coincideTipo && coincideMateria
  }), [apuntes, busqueda, filtroTipo, filtroMateria])

  const misApuntes = useMemo(() => apuntesFiltrados.filter(ap => ap.usuario_id === usuario?.id), [apuntesFiltrados, usuario?.id])
  const apuntesCompaneros = useMemo(() => apuntesFiltrados.filter(ap => ap.usuario_id !== usuario?.id), [apuntesFiltrados, usuario?.id])

  const gruposCompaneros = useMemo(() => {
    const grupos = apuntesCompaneros.reduce<Record<string, { nombre: string; avatar: string | null; archivos: ApunteConAutor[] }>>((acc, ap) => {
      const uid = ap.usuario_id
      if (!acc[uid]) {
        acc[uid] = {
          nombre: ap.usuarios?.nombre ?? 'Usuario desconocido',
          avatar: ap.usuarios?.avatar_url ?? null,
          archivos: [],
        }
      }
      acc[uid].archivos.push(ap)
      return acc
    }, {})
    return Object.entries(grupos).sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre))
  }, [apuntesCompaneros])

  const hayFiltrosActivos = busqueda.trim() !== '' || filtroTipo !== 'todos' || filtroMateria !== 'todas'

  if (loading) return <ApuntesSkeleton />

  const FILTROS: { key: FiltroTipo; label: string }[] = [
    { key: 'todos',  label: 'Todos'  },
    { key: 'pdf',    label: 'PDF'    },
    { key: 'imagen', label: 'Imagen' },
    { key: 'otro',   label: 'Otro'   },
  ]

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div
        className="relative px-4 md:px-6 py-5 overflow-hidden"
        style={{ borderBottom: '1px solid var(--overlay-06)' }}
      >
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(85,239,196,0.12)', border: '1px solid rgba(85,239,196,0.2)' }}
            >
              <FolderOpen size={15} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-text-primary">Apuntes</h1>
              <p className="text-xs text-text-muted">
                {apuntes.length} archivo{apuntes.length !== 1 ? 's' : ''} · {totalUsuarios} usuario{totalUsuarios !== 1 ? 's' : ''}
                {apuntes.length > 0 && (
                  <>
                    {totalPdf > 0 && <> · <span className="text-rose">{totalPdf} PDF</span></>}
                    {totalImg > 0 && <> · <span className="text-success">{totalImg} img</span></>}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVistaLista(v => !v)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 ${vistaLista ? 'text-primary-light' : 'text-text-muted'}`}
              style={{
                border: '1px solid var(--overlay-08)',
                background: vistaLista ? 'rgba(85,239,196,0.08)' : 'transparent',
              }}
              aria-label={vistaLista ? 'Vista en cuadrícula' : 'Vista en lista'}
            >
              {vistaLista ? <LayoutGrid size={14} /> : <LayoutList size={14} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 text-text-muted"
              style={{ border: '1px solid var(--overlay-08)' }}
              aria-label="Actualizar"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <label
              className={`bg-gradient-to-br from-primary to-cyan-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-primary px-4 py-2.5 text-sm cursor-pointer ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {subiendo ? (
                <div className="flex items-center gap-2">
                  <Spinner size="sm" className="text-white" />
                  Subiendo...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Upload size={14} />
                  Subir archivo
                </div>
              )}
              <input type="file" accept=".pdf,image/*,.doc,.docx,.txt,.pptx,.xlsx" onChange={handleUpload} className="hidden" disabled={subiendo} />
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-8">

        {/* ── Barra de búsqueda + filtros ── */}
        {apuntes.length > 0 && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Input de búsqueda */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar archivos…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all duration-150 text-text-primary"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--border)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(85,239,196,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(85,239,196,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>

              {/* Chips de filtro por tipo */}
              <div className="flex items-center gap-1.5 shrink-0">
                {FILTROS.map(f => {
                  const isActive = filtroTipo === f.key
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFiltroTipo(f.key)}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-150 ${isActive ? 'text-primary-light' : 'text-text-muted'}`}
                      style={{
                        background: isActive ? 'rgba(85,239,196,0.15)' : 'var(--color-surface)',
                        border: isActive ? '1px solid rgba(85,239,196,0.35)' : '1px solid var(--border)',
                      }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>

              {/* Selector de materia (solo si hay materias en uso) */}
              {materiasEnUso.length > 0 && (
                <select
                  value={filtroMateria}
                  onChange={e => setFiltroMateria(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl outline-none transition-all duration-150 cursor-pointer shrink-0"
                  style={{
                    background: filtroMateria !== 'todas' ? 'rgba(85,239,196,0.15)' : 'var(--color-surface)',
                    border: filtroMateria !== 'todas' ? '1px solid rgba(85,239,196,0.35)' : '1px solid var(--border)',
                    color: filtroMateria !== 'todas' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                  }}
                >
                  <option value="todas">Todas las materias</option>
                  {materiasEnUso.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Resumen de filtros activos */}
            {hayFiltrosActivos && (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="text-text-muted">Filtros:</span>
                {busqueda.trim() !== '' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-text-primary"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}>
                    <Search size={10} /> {busqueda}
                  </span>
                )}
                {filtroTipo !== 'todos' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-primary-light"
                    style={{ background: 'rgba(85,239,196,0.1)', border: '1px solid rgba(85,239,196,0.25)' }}>
                    {FILTROS.find(f => f.key === filtroTipo)?.label}
                  </span>
                )}
                {filtroMateria !== 'todas' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-primary-light"
                    style={{ background: 'rgba(85,239,196,0.1)', border: '1px solid rgba(85,239,196,0.25)' }}>
                    <BookOpen size={10} /> {filtroMateria}
                  </span>
                )}
                <button
                  onClick={() => { setBusqueda(''); setFiltroTipo('todos'); setFiltroMateria('todas') }}
                  className="text-text-muted hover:text-primary-light transition-colors duration-150 font-medium"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Estado vacío absoluto ── */}
        {apuntes.length === 0 ? (
          <label
            className="cursor-pointer"
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div
              className="py-16 flex flex-col items-center gap-4 text-center rounded-2xl transition-all duration-200"
              style={{
                background: dragOver ? 'rgba(85,239,196,0.08)' : 'var(--color-surface)',
                border: `2px dashed ${dragOver ? 'rgba(85,239,196,0.5)' : 'var(--border)'}`,
              }}
            >
              <div
                className="w-16 h-16 flex items-center justify-center rounded-2xl transition-transform duration-200"
                style={{
                  background: dragOver ? 'rgba(85,239,196,0.15)' : 'var(--color-surface-2)',
                  border: `1px solid ${dragOver ? 'rgba(85,239,196,0.35)' : 'var(--border)'}`,
                  transform: dragOver ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <CloudUpload size={28} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <p className="font-semibold text-lg text-text-primary">
                  {dragOver ? 'Suelta para subir' : 'Sin apuntes todavía'}
                </p>
                <p className="text-sm mt-1.5 max-w-xs leading-relaxed text-text-muted">
                  Arrastra un archivo aquí o pulsa para seleccionarlo.
                </p>
              </div>
              <span className="text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ background: 'rgba(85,239,196,0.12)', border: '1px solid rgba(85,239,196,0.25)', color: 'var(--color-primary)' }}>
                Seleccionar archivo
              </span>
            </div>
            <input type="file" accept=".pdf,image/*,.doc,.docx,.txt,.pptx,.xlsx" onChange={handleUpload} className="hidden" />
          </label>

        ) : apuntesFiltrados.length === 0 ? (
          <div
            className="py-14 flex flex-col items-center gap-4 text-center rounded-2xl animate-fade-in"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--border)' }}
          >
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(85,239,196,0.08)', border: '1px solid rgba(85,239,196,0.15)' }}>
              <SearchX size={24} className="text-primary-light" />
            </div>
            <div>
              <p className="font-semibold text-base text-text-primary">Sin resultados</p>
              <p className="text-sm mt-1 text-text-muted">
                {busqueda.trim() !== ''
                  ? <>No hay archivos para <span className="text-primary-light">«{busqueda}»</span></>
                  : 'No hay archivos con ese filtro.'}
              </p>
            </div>
            <button
              onClick={() => { setBusqueda(''); setFiltroTipo('todos'); setFiltroMateria('todas') }}
              className="text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-150"
              style={{ background: 'rgba(85,239,196,0.1)', border: '1px solid rgba(85,239,196,0.2)', color: 'var(--color-primary)' }}
            >
              Limpiar filtros
            </button>
          </div>

        ) : (
          <>
            {/* ── Mis apuntes ── */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'rgba(85,239,196,0.12)', border: '1px solid rgba(85,239,196,0.2)' }}>
                  <User size={14} style={{ color: 'var(--color-primary)' }} />
                </div>
                <span className="font-semibold text-sm text-text-primary">Mis apuntes</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 text-text-muted"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}>
                  {misApuntes.length}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--overlay-05)' }} />
              </div>

              {misApuntes.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-3 text-center rounded-2xl animate-fade-in"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--border)' }}>
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}>
                    <Inbox size={20} className="text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Aún no subiste apuntes</p>
                    <p className="text-xs mt-1 text-text-muted">Usa el botón "Subir archivo" para compartir tus apuntes.</p>
                  </div>
                </div>
              ) : vistaLista ? (
                <div className="flex flex-col gap-1.5">
                  {misApuntes.map((ap, idx) => (
                    <ApunteCard key={ap.id} ap={ap} canDelete={true} onDelete={() => handleEliminar(ap)} onPreview={() => setPreviewApunte(ap)} delay={idx * 25} compact />
                  ))}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {misApuntes.map((ap, idx) => (
                    <ApunteCard key={ap.id} ap={ap} canDelete={true} onDelete={() => handleEliminar(ap)} onPreview={() => setPreviewApunte(ap)} delay={idx * 35} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Apuntes de compañeros ── */}
            <section className="flex flex-col gap-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: 'rgba(0,206,201,0.10)', border: '1px solid rgba(0,206,201,0.2)' }}>
                  <Users size={14} style={{ color: 'var(--color-teal)' }} />
                </div>
                <span className="font-semibold text-sm text-text-primary">Apuntes de compañeros</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 text-text-muted"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}>
                  {apuntesCompaneros.length}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--overlay-05)' }} />
              </div>

              {apuntesCompaneros.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-3 text-center rounded-2xl animate-fade-in"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--border)' }}>
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}>
                    <Users size={20} className="text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Tus compañeros aún no subieron apuntes</p>
                    <p className="text-xs mt-1 text-text-muted">Cuando suban material aparecerá aquí.</p>
                  </div>
                </div>
              ) : (
                gruposCompaneros.map(([uid, grupo]) => (
                  <div key={uid} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar nombre={grupo.nombre} url={grupo.avatar} size={28} />
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm truncate text-text-primary">{grupo.nombre}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--border)' }}>
                          Compañero
                        </span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-0.5 text-text-muted"
                        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}>
                        {grupo.archivos.length}
                      </span>
                      <div className="flex-1 h-px" style={{ background: 'var(--overlay-05)' }} />
                    </div>

                    {vistaLista ? (
                      <div className="flex flex-col gap-1.5">
                        {grupo.archivos.map((ap, idx) => (
                          <ApunteCard key={ap.id} ap={ap} canDelete={isAdmin} onDelete={() => handleEliminar(ap)} onPreview={() => setPreviewApunte(ap)} delay={idx * 25} compact />
                        ))}
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {grupo.archivos.map((ap, idx) => (
                          <ApunteCard key={ap.id} ap={ap} canDelete={isAdmin} onDelete={() => handleEliminar(ap)} onPreview={() => setPreviewApunte(ap)} delay={idx * 35} />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Modal de confirmación de subida con selector de materia ── */}
      {uploadPendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div
            className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-5 animate-scale-in"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--overlay-08)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          >
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
                  style={{ background: TIPO_CONFIG[uploadTipo].bg, border: `1px solid ${TIPO_CONFIG[uploadTipo].border}` }}>
                  {uploadTipo === 'pdf' ? <FileText size={18} style={{ color: TIPO_CONFIG.pdf.color }} /> :
                   uploadTipo === 'imagen' ? <Image size={18} style={{ color: TIPO_CONFIG.imagen.color }} /> :
                   <File size={18} style={{ color: TIPO_CONFIG.otro.color }} />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-text-primary truncate">{uploadPendingFile.name}</p>
                  <p className="text-xs text-text-muted">{(uploadPendingFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              </div>
              <button onClick={() => setUploadPendingFile(null)} className="text-text-muted hover:text-text-primary transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Selector de materia */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                <BookOpen size={12} />
                Materia <span className="text-text-muted font-normal">(opcional)</span>
              </label>
              <select
                value={uploadMateria}
                onChange={e => setUploadMateria(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all duration-150"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)', color: uploadMateria ? 'var(--color-text)' : 'var(--color-text-muted)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(85,239,196,0.5)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <option value="">Sin categoría</option>
                {MATERIAS.map(m => (
                  <option key={m.codigo} value={m.nombreCorto}>{m.nombreCorto}</option>
                ))}
              </select>
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={() => setUploadPendingFile(null)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 text-text-muted"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={subiendo}
                className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #55efc4, #00cec9)' }}
              >
                {subiendo ? <><Spinner size="sm" className="text-white" /> Subiendo…</> : <><Upload size={13} /> Subir</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de preview inline ── */}
      {previewApunte && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.9)' }}>
          {/* Barra superior */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--overlay-08)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
                style={{ background: TIPO_CONFIG[previewApunte.tipo].bg, border: `1px solid ${TIPO_CONFIG[previewApunte.tipo].border}` }}>
                {previewApunte.tipo === 'pdf' ? <FileText size={14} style={{ color: TIPO_CONFIG.pdf.color }} /> :
                 previewApunte.tipo === 'imagen' ? <Image size={14} style={{ color: TIPO_CONFIG.imagen.color }} /> :
                 <File size={14} style={{ color: TIPO_CONFIG.otro.color }} />}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-text-primary truncate">{previewApunte.nombre}</p>
                {previewApunte.materia && (
                  <p className="text-xs text-text-muted">{previewApunte.materia}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={previewApunte.url}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 text-text-muted"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}
              >
                <Download size={12} /> Descargar
              </a>
              <a
                href={previewApunte.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 text-text-muted"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}
              >
                <ExternalLink size={12} /> Nueva pestaña
              </a>
              <button
                onClick={() => setPreviewApunte(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary transition-colors"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Contenido del preview */}
          <div className="flex-1 overflow-hidden">
            {previewApunte.tipo === 'pdf' ? (
              <iframe
                src={previewApunte.url}
                className="w-full h-full"
                title={previewApunte.nombre}
              />
            ) : previewApunte.tipo === 'imagen' ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <img
                  src={previewApunte.url}
                  alt={previewApunte.nombre}
                  className="max-w-full max-h-full object-contain rounded-xl"
                  style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center p-8">
                  <div className="w-20 h-20 flex items-center justify-center rounded-2xl"
                    style={{ background: TIPO_CONFIG.otro.bg, border: `1px solid ${TIPO_CONFIG.otro.border}` }}>
                    <File size={36} style={{ color: TIPO_CONFIG.otro.color }} />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">{previewApunte.nombre}</p>
                    <p className="text-sm text-text-muted mt-1">Este tipo de archivo no tiene vista previa.</p>
                  </div>
                  <a
                    href={previewApunte.url}
                    download
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white"
                    style={{ background: 'linear-gradient(135deg, #55efc4, #00cec9)' }}
                  >
                    <Download size={14} /> Descargar archivo
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

function ApunteCard({
  ap, canDelete, onDelete, onPreview, delay = 0, compact = false,
}: {
  ap: ApunteConAutor
  canDelete: boolean
  onDelete: () => void
  onPreview: () => void
  delay?: number
  compact?: boolean
}) {
  const config = TIPO_CONFIG[ap.tipo]
  const { Icon } = config
  const rawExt = ap.nombre.includes('.') ? ap.nombre.split('.').pop() ?? '' : ''
  const ext = rawExt.length > 0 && rawExt.length <= 5 ? rawExt.toUpperCase() : config.label
  const fecha = new Date(ap.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
  const canPreview = ap.tipo === 'pdf' || ap.tipo === 'imagen'

  // ── Vista compacta (lista) ──
  if (compact) {
    return (
      <div
        className="group flex items-center gap-3 px-3 rounded-xl transition-all duration-200 animate-slide-up"
        style={{
          animationDelay: `${delay}ms`,
          height: '48px',
          background: 'var(--color-surface)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${config.color}30`; el.style.background = 'var(--color-surface-2)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--color-surface)' }}
      >
        <div className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
          style={{ background: config.bg, border: `1px solid ${config.border}` }}>
          <Icon size={14} style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-none text-text-primary">{ap.nombre}</p>
          <p className="text-xs mt-0.5 leading-none text-text-muted">
            {fecha}
            {ap.materia && <> · <span className="text-primary-light">{ap.materia}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg hidden sm:inline-block"
            style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
            {ext}
          </span>
          {canPreview && (
            <button
              onClick={onPreview}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)', color: 'var(--color-text-muted)' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-primary-light)'; el.style.background = 'rgba(85,239,196,0.08)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text-muted)'; el.style.background = 'var(--color-surface-2)' }}
              aria-label="Vista previa"
            >
              <Eye size={12} />
            </button>
          )}
          <a
            href={ap.url}
            download
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)', color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text)'; el.style.background = 'var(--overlay-08)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text-muted)'; el.style.background = 'var(--color-surface-2)' }}
            aria-label="Descargar"
          >
            <Download size={12} />
          </a>
          {canDelete && (
            <button
              onClick={onDelete}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 shrink-0"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--border)', color: 'var(--color-text-muted)' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-error)'; el.style.background = 'rgba(244,63,94,0.08)'; el.style.borderColor = 'rgba(244,63,94,0.2)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text-muted)'; el.style.background = 'var(--color-surface)'; el.style.borderColor = 'var(--border)' }}
              aria-label="Eliminar archivo"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Vista grid ──
  return (
    <div
      className="group p-4 flex flex-col gap-3 rounded-2xl transition-all duration-200 animate-slide-up"
      style={{
        animationDelay: `${delay}ms`,
        background: 'var(--color-surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 4px var(--overlay-04)',
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${config.color}30`; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 24px var(--overlay-08)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.transform = 'translateY(0)'; el.style.boxShadow = '0 1px 4px var(--overlay-04)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-11 h-11 flex items-center justify-center rounded-2xl shrink-0"
          style={{ background: config.bg, border: `1px solid ${config.border}` }}>
          <Icon size={20} style={{ color: config.color }} />
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-lg shrink-0"
          style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}>
          {ext}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug line-clamp-2 text-text-primary">{ap.nombre}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-xs text-text-muted">{fecha}</p>
          {ap.materia && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1"
              style={{ background: 'rgba(85,239,196,0.08)', color: 'var(--color-primary-light)', border: '1px solid rgba(85,239,196,0.2)' }}>
              <BookOpen size={9} />
              {ap.materia}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-2.5" style={{ borderTop: '1px solid var(--overlay-05)' }}>
        {canPreview ? (
          <button
            onClick={onPreview}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all duration-150"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)', color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-primary-light)'; el.style.background = 'rgba(85,239,196,0.08)'; el.style.borderColor = 'rgba(85,239,196,0.25)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text-muted)'; el.style.background = 'var(--color-surface-2)'; el.style.borderColor = 'var(--border)' }}
          >
            <Eye size={11} /> Ver
          </button>
        ) : (
          <a
            href={ap.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all duration-150"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)', color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text)'; el.style.background = 'var(--overlay-08)'; el.style.borderColor = 'var(--overlay-12)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text-muted)'; el.style.background = 'var(--color-surface-2)'; el.style.borderColor = 'var(--border)' }}
          >
            <ExternalLink size={11} /> Abrir
          </a>
        )}
        <a
          href={ap.url}
          download
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 shrink-0"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border)', color: 'var(--color-text-muted)' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text)'; el.style.background = 'var(--overlay-08)' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text-muted)'; el.style.background = 'var(--color-surface-2)' }}
          aria-label="Descargar"
        >
          <Download size={13} />
        </a>
        {canDelete && (
          <button
            onClick={onDelete}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 shrink-0"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--border)', color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-error)'; el.style.background = 'rgba(244,63,94,0.08)'; el.style.borderColor = 'rgba(244,63,94,0.2)' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--color-text-muted)'; el.style.background = 'var(--color-surface)'; el.style.borderColor = 'var(--border)' }}
            aria-label="Eliminar archivo"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
