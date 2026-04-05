import { useEffect, useState, useCallback } from 'react'
import { Upload, FileText, Image, File, Trash2, ExternalLink, RefreshCw, FolderOpen, CloudUpload } from 'lucide-react'
import { supabase, subirArchivo, eliminarArchivoStorage } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Apunte } from '../lib/types'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

function tipoFromMime(mime: string): 'pdf' | 'imagen' | 'otro' {
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'imagen'
  return 'otro'
}

const TIPO_CONFIG = {
  pdf: {
    Icon: FileText,
    color: '#f43f5e',
    bg: 'rgba(244,63,94,0.08)',
    border: 'rgba(244,63,94,0.18)',
    label: 'PDF',
  },
  imagen: {
    Icon: Image,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.15)',
    label: 'IMG',
  },
  otro: {
    Icon: File,
    color: '#818cf8',
    bg: 'rgba(129,140,248,0.08)',
    border: 'rgba(129,140,248,0.15)',
    label: 'FILE',
  },
}

function ApuntesSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SkeletonBox className="h-7 w-32 shimmer" />
        <SkeletonBox className="h-10 w-36 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <SkeletonCard key={i} className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between">
              <SkeletonBox className="h-12 w-12 shimmer rounded-2xl" />
              <SkeletonBox className="h-6 w-12 shimmer rounded-lg" />
            </div>
            <div className="flex flex-col gap-2">
              <SkeletonBox className="h-4 w-4/5 shimmer" />
              <SkeletonBox className="h-3 w-2/5 shimmer" />
            </div>
            <SkeletonBox className="h-9 shimmer rounded-xl" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

export default function Apuntes() {
  const { usuario } = useAuth()
  const [apuntes, setApuntes] = useState<Apunte[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('apuntes')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setApuntes(data)
  }, [])

  useEffect(() => {
    cargar().finally(() => setLoading(false))
  }, [cargar])

  async function subirFile(file: File) {
    if (!usuario) return
    if (file.size > 20 * 1024 * 1024) {
      setAlert({ type: 'error', title: 'Archivo muy grande', message: 'El archivo no puede superar los 20 MB.' })
      return
    }
    setSubiendo(true)
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${usuario.id}/${Date.now()}.${ext}`
    const url = await subirArchivo(file, path)
    if (!url) {
      setSubiendo(false)
      setAlert({ type: 'error', title: 'Error al subir', message: 'No se pudo subir el archivo. Inténtalo de nuevo.' })
      return
    }
    const tipo = tipoFromMime(file.type)
    await supabase.from('apuntes').insert({ usuario_id: usuario.id, nombre: file.name, url, tipo })
    await cargar()
    setSubiendo(false)
    setAlert({ type: 'success', title: 'Archivo subido', message: 'El archivo se subió correctamente.' })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await subirFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) subirFile(file)
  }

  function handleEliminar(ap: Apunte) {
    if (ap.usuario_id !== usuario?.id) return
    setAlert({
      title: 'Eliminar apunte',
      message: `¿Eliminar "${ap.nombre}"?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const urlObj = new URL(ap.url)
        const storagePath = urlObj.pathname.split('/object/public/apuntes/')[1]
        if (storagePath) await eliminarArchivoStorage('apuntes', decodeURIComponent(storagePath))
        await supabase.from('apuntes').delete().eq('id', ap.id)
        await cargar()
      },
    })
  }

  const mios = apuntes.filter(a => a.usuario_id === usuario?.id)
  const otros = apuntes.filter(a => a.usuario_id !== usuario?.id)

  if (loading) return <ApuntesSkeleton />

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div
        className="relative px-4 md:px-6 py-5 overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center rounded-xl"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}
            >
              <FolderOpen size={15} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>Apuntes</h1>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {apuntes.length} archivo{apuntes.length !== 1 ? 's' : ''} · {mios.length} míos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => { setRefreshing(true); await cargar(); setRefreshing(false) }}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
              aria-label="Actualizar"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <label
              className={`btn-primary px-4 py-2.5 text-sm cursor-pointer ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}
            >
              {subiendo ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
                  Subiendo...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Upload size={14} />
                  Subir archivo
                </div>
              )}
              <input
                type="file"
                accept=".pdf,image/*,.doc,.docx,.txt,.pptx,.xlsx"
                onChange={handleUpload}
                className="hidden"
                disabled={subiendo}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-7">

        {/* ── Drop zone (empty state) ── */}
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
                background: dragOver ? 'rgba(139,92,246,0.06)' : 'linear-gradient(145deg, #1a1d27, #141720)',
                border: `2px dashed ${dragOver ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div
                className="w-16 h-16 flex items-center justify-center rounded-2xl transition-transform duration-200"
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  transform: dragOver ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <CloudUpload size={28} style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <p className="font-semibold text-lg" style={{ color: '#f1f5f9' }}>
                  {dragOver ? 'Suelta para subir' : 'Sin apuntes todavía'}
                </p>
                <p className="text-sm mt-1.5 max-w-xs leading-relaxed" style={{ color: '#64748b' }}>
                  Arrastra un archivo aquí o pulsa para seleccionarlo. Soporta PDF, imágenes y más.
                </p>
              </div>
              <span
                className="text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}
              >
                Seleccionar archivo
              </span>
            </div>
            <input type="file" accept=".pdf,image/*,.doc,.docx,.txt,.pptx,.xlsx" onChange={handleUpload} className="hidden" />
          </label>
        ) : (
          <>
            {/* ── Mis archivos ── */}
            {mios.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
                    Mis archivos
                  </h2>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    {mios.length}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mios.map((ap, idx) => (
                    <ApunteCard key={ap.id} ap={ap} canDelete onDelete={() => handleEliminar(ap)} delay={idx * 40} />
                  ))}
                </div>
              </section>
            )}

            {/* ── De compañeros ── */}
            {otros.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
                    De mis compañeros
                  </h2>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}
                  >
                    {otros.length}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {otros.map((ap, idx) => (
                    <ApunteCard key={ap.id} ap={ap} canDelete={false} onDelete={() => {}} delay={idx * 40} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

      </div>

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
  ap, canDelete, onDelete, delay = 0,
}: {
  ap: Apunte
  canDelete: boolean
  onDelete: () => void
  delay?: number
}) {
  const config = TIPO_CONFIG[ap.tipo]
  const { Icon } = config
  const ext = ap.nombre.split('.').pop()?.toUpperCase() ?? '?'
  const fecha = new Date(ap.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      className="group p-4 flex flex-col gap-3.5 rounded-2xl transition-all duration-200 animate-slide-up"
      style={{
        animationDelay: `${delay}ms`,
        background: 'linear-gradient(145deg, #1a1d27, #141720)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = `${config.color}28`
        el.style.transform = 'translateY(-1px)'
        el.style.boxShadow = `0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'rgba(255,255,255,0.07)'
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03)'
      }}
    >
      {/* Top row: icon + badge */}
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 flex items-center justify-center rounded-2xl"
          style={{ background: config.bg, border: `1px solid ${config.border}` }}
        >
          <Icon size={22} style={{ color: config.color }} />
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg"
          style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
        >
          {ext}
        </span>
      </div>

      {/* File name + date */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug line-clamp-2" style={{ color: '#f1f5f9' }}>
          {ap.nombre}
        </p>
        <p className="text-xs mt-1.5" style={{ color: '#4b5563' }}>
          {fecha}
        </p>
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <a
          href={ap.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all duration-150"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: '#64748b',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = '#f1f5f9'
            el.style.background = 'rgba(255,255,255,0.08)'
            el.style.borderColor = 'rgba(255,255,255,0.12)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = '#64748b'
            el.style.background = 'rgba(255,255,255,0.04)'
            el.style.borderColor = 'rgba(255,255,255,0.07)'
          }}
        >
          <ExternalLink size={11} />
          Abrir
        </a>
        {canDelete && (
          <button
            onClick={onDelete}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150"
            style={{ border: '1px solid rgba(255,255,255,0.07)', color: '#4b5563' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = '#f43f5e'
              el.style.background = 'rgba(244,63,94,0.08)'
              el.style.borderColor = 'rgba(244,63,94,0.2)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = '#4b5563'
              el.style.background = 'transparent'
              el.style.borderColor = 'rgba(255,255,255,0.07)'
            }}
            aria-label="Eliminar archivo"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
