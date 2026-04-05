import { useEffect, useState, useCallback } from 'react'
import { Upload, FileText, Image, File, Trash2, ExternalLink, RefreshCw, FolderOpen } from 'lucide-react'
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
    bg: 'rgba(244,63,94,0.1)',
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
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.12)',
    label: 'FILE',
  },
}

function ApuntesSkeleton() {
  return (
    <div>
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SkeletonBox className="h-7 w-32 shimmer" />
        <SkeletonBox className="h-10 w-36 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <SkeletonCard key={i} className="flex flex-col gap-3 p-5">
            <SkeletonBox className="h-12 w-12 shimmer rounded-2xl" />
            <SkeletonBox className="h-4 w-4/5 shimmer" />
            <SkeletonBox className="h-3 w-2/5 shimmer" />
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !usuario) return
    e.target.value = ''

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
    <div className="animate-fade-in">
      {/* Header */}
      <div className="relative px-4 md:px-6 py-5 overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <FolderOpen size={15} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>Apuntes</h1>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {apuntes.length} archivo{apuntes.length !== 1 ? 's' : ''} compartidos
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
            <label className={`btn-primary px-4 py-2.5 text-sm cursor-pointer ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}>
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
        {apuntes.length === 0 ? (
          <div className="p-14 flex flex-col items-center gap-4 text-center mt-4 rounded-2xl" style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-16 h-16 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(139,92,246,0.12)' }}>
              <FolderOpen size={28} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <p className="font-semibold text-lg" style={{ color: '#f1f5f9' }}>Sin apuntes todavía</p>
              <p className="text-sm mt-1.5 max-w-xs leading-relaxed" style={{ color: '#64748b' }}>
                Sube PDFs, imágenes u otros archivos para compartirlos con tus compañeros.
              </p>
            </div>
          </div>
        ) : (
          <>
            {mios.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                    Mis archivos
                  </h2>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
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
            {otros.length > 0 && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>
                    De mis compañeros
                  </h2>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}
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

  return (
    <div
      className="p-4 flex flex-col gap-3 rounded-2xl transition-all duration-150 animate-slide-up hover:scale-[1.01]"
      style={{
        animationDelay: `${delay}ms`,
        background: '#1a1d27',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${config.color}30` }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 flex items-center justify-center rounded-2xl"
          style={{ background: config.bg, border: `1px solid ${config.border}` }}
        >
          <Icon size={22} style={{ color: config.color }} />
        </div>
        <span
          className="text-xs font-bold px-2 py-1 rounded-lg"
          style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
        >
          {ext}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug line-clamp-2" style={{ color: '#f1f5f9' }}>
          {ap.nombre}
        </p>
        <p className="text-xs mt-1.5" style={{ color: '#64748b' }}>
          {new Date(ap.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      <div className="flex gap-2 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <a
          href={ap.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all duration-150"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = '#f1f5f9'
            el.style.background = 'rgba(255,255,255,0.08)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.color = '#94a3b8'
            el.style.background = 'rgba(255,255,255,0.05)'
          }}
        >
          <ExternalLink size={11} />
          Abrir
        </a>
        {canDelete && (
          <button
            onClick={onDelete}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = '#f43f5e'
              el.style.background = 'rgba(244,63,94,0.08)'
              el.style.borderColor = 'rgba(244,63,94,0.2)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.color = '#64748b'
              el.style.background = 'transparent'
              el.style.borderColor = 'rgba(255,255,255,0.08)'
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
