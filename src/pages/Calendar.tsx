import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, RefreshCw, CalendarDays, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { EventoCalendario } from '../lib/types'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${parseInt(d)} de ${MESES[parseInt(m) - 1]} de ${y}`
}

function fechaRelativa(fecha: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const ev = new Date(fecha + 'T00:00:00')
  const diff = Math.round((ev.getTime() - hoy.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff > 1) return `En ${diff} días`
  return `Hace ${Math.abs(diff)} días`
}

function isUpcoming(fecha: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return new Date(fecha + 'T00:00:00') >= hoy
}

function CalendarSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SkeletonBox className="h-7 w-28 shimmer" />
        <SkeletonBox className="h-10 w-32 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-3">
        {[1,2,3].map(i => (
          <SkeletonCard key={i} className="flex gap-4 items-center py-5">
            <SkeletonBox className="h-14 w-14 shrink-0 shimmer rounded-xl" />
            <div className="flex-1 flex flex-col gap-2.5">
              <SkeletonBox className="h-4 w-2/5 shimmer" />
              <SkeletonBox className="h-3 w-3/5 shimmer" />
              <SkeletonBox className="h-3 w-1/4 shimmer" />
            </div>
            <SkeletonBox className="h-6 w-20 shimmer rounded-lg" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

export default function CalendarPage() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'

  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('eventos')
      .select('*')
      .order('fecha', { ascending: true })
    if (data) setEventos(data)
  }, [])

  useEffect(() => {
    cargar().finally(() => setLoading(false))
  }, [cargar])

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !fecha) {
      setAlert({ type: 'error', title: 'Error', message: 'El título y la fecha son obligatorios.' })
      return
    }
    setSaving(true)
    const { error } = await supabase.from('eventos').insert({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      fecha,
      created_by: usuario!.id,
    })
    if (error) {
      setSaving(false)
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo crear el evento: ' + error.message })
      return
    }
    await cargar()
    setSaving(false)
    setModalVisible(false)
    setTitulo(''); setDescripcion(''); setFecha(new Date().toISOString().split('T')[0])
  }

  function handleEliminar(ev: EventoCalendario) {
    setAlert({
      title: 'Eliminar evento',
      message: `¿Eliminar "${ev.titulo}"?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        await supabase.from('eventos').delete().eq('id', ev.id)
        await cargar()
      },
    })
  }

  const upcoming = eventos.filter(e => isUpcoming(e.fecha))
  const past = eventos.filter(e => !isUpcoming(e.fecha))
  const todayCount = upcoming.filter(e => fechaRelativa(e.fecha) === 'Hoy').length

  const mesActual = MESES[new Date().getMonth()]
  const anioActual = new Date().getFullYear()

  if (loading) return <CalendarSkeleton />

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
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <CalendarDays size={15} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>Eventos</h1>
                {todayCount > 0 && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse-soft"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
                  >
                    {todayCount} hoy
                  </span>
                )}
              </div>
              <p className="text-xs capitalize" style={{ color: '#64748b' }}>
                {mesActual} {anioActual} · {upcoming.length} próximos
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
            {isAdmin && (
              <button onClick={() => setModalVisible(true)} className="btn-primary px-4 py-2.5 text-sm">
                <Plus size={15} />
                Nuevo Evento
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-5">
        {eventos.length === 0 ? (
          <div
            className="py-16 flex flex-col items-center gap-4 text-center mt-2 rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="w-16 h-16 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)' }}
            >
              <CalendarDays size={28} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p className="font-semibold text-lg" style={{ color: '#f1f5f9' }}>Sin eventos programados</p>
              <p className="text-sm mt-1.5 max-w-xs leading-relaxed" style={{ color: '#64748b' }}>
                {isAdmin
                  ? 'Crea el primer evento con el botón de arriba.'
                  : 'No hay eventos programados todavía. ¡Vuelve pronto!'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>
                    Próximos
                  </h2>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
                  >
                    {upcoming.length}
                  </span>
                </div>
                {upcoming.map((ev, idx) => (
                  <div key={ev.id} className="animate-slide-up" style={{ animationDelay: `${idx * 40}ms` }}>
                    <EventCard evento={ev} isAdmin={isAdmin} onDelete={() => handleEliminar(ev)} />
                  </div>
                ))}
              </div>
            )}

            {past.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#374151' }}>
                    Pasados
                  </h2>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#4b5563', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {past.length}
                  </span>
                </div>
                {past.map((ev, idx) => (
                  <div key={ev.id} className="animate-slide-up" style={{ animationDelay: `${idx * 30}ms` }}>
                    <EventCard evento={ev} isAdmin={isAdmin} onDelete={() => handleEliminar(ev)} past />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal crear evento — via portal ── */}
      {modalVisible && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setModalVisible(false)}
          />
          <div
            className="relative w-full sm:max-w-md animate-slide-in-bottom sm:animate-scale-in-modal rounded-t-2xl sm:rounded-2xl shadow-modal"
            style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="w-8 h-1 mx-auto mt-4 mb-1 sm:hidden rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />

            <div className="p-6 pt-4 sm:pt-6">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <CalendarDays size={15} style={{ color: '#f59e0b' }} />
                </div>
                <h2 className="font-extrabold text-xl" style={{ color: '#f1f5f9' }}>Nuevo Evento</h2>
              </div>
              <form onSubmit={handleGuardar} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Título</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ej: Examen de Programación"
                    className="input-base"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Descripción (opcional)</label>
                  <textarea
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Más detalles..."
                    rows={3}
                    className="input-base resize-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={e => setFecha(e.target.value)}
                    className="input-base [color-scheme:dark]"
                  />
                </div>
                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={() => setModalVisible(false)} className="flex-1 btn-ghost py-3 text-sm">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="flex-[2] btn-primary py-3 text-sm">
                    {saving ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
                        Creando...
                      </div>
                    ) : 'Crear Evento'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
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

function EventCard({ evento, isAdmin, onDelete, past }: {
  evento: EventoCalendario
  isAdmin: boolean
  onDelete: () => void
  past?: boolean
}) {
  const relativo = fechaRelativa(evento.fecha)
  const isToday = relativo === 'Hoy'
  const isTomorrow = relativo === 'Mañana'

  const dayNum = evento.fecha.split('-')[2]
  const monthIdx = parseInt(evento.fecha.split('-')[1]) - 1

  const badgeStyle = isToday ? {
    background: 'rgba(99,102,241,0.15)',
    color: '#818cf8',
    border: '1px solid rgba(99,102,241,0.3)',
  } : isTomorrow ? {
    background: 'rgba(245,158,11,0.12)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.25)',
  } : past ? {
    background: 'rgba(255,255,255,0.04)',
    color: '#374151',
    border: '1px solid rgba(255,255,255,0.05)',
  } : {
    background: 'rgba(255,255,255,0.06)',
    color: '#64748b',
    border: '1px solid rgba(255,255,255,0.08)',
  }

  return (
    <div
      className="flex gap-3.5 rounded-2xl transition-all duration-150"
      style={{
        background: past
          ? 'rgba(20,23,32,0.6)'
          : isToday
          ? 'linear-gradient(145deg, #1a1d27, #141720)'
          : 'linear-gradient(145deg, #1a1d27, #141720)',
        border: isToday
          ? '1px solid rgba(99,102,241,0.25)'
          : past
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(255,255,255,0.07)',
        padding: '14px 16px',
        opacity: past ? 0.5 : 1,
        boxShadow: isToday ? '0 0 0 1px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Date block */}
      <div
        className="w-14 h-14 flex flex-col items-center justify-center shrink-0 rounded-xl"
        style={{
          background: isToday
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            : past
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(245,158,11,0.1)',
          border: isToday
            ? 'none'
            : past
            ? '1px solid rgba(255,255,255,0.05)'
            : '1px solid rgba(245,158,11,0.18)',
          boxShadow: isToday ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
        }}
      >
        <span
          className="text-lg font-extrabold leading-none tabular-nums"
          style={{ color: isToday ? 'white' : past ? '#374151' : '#f59e0b' }}
        >
          {parseInt(dayNum)}
        </span>
        <span
          className="text-xs mt-0.5 uppercase font-medium"
          style={{ color: isToday ? 'rgba(255,255,255,0.7)' : past ? '#374151' : '#92613a' }}
        >
          {MESES_CORTO[monthIdx]}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className="font-semibold text-sm leading-snug"
            style={{ color: past ? '#4b5563' : '#f1f5f9' }}
          >
            {evento.titulo}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap" style={badgeStyle}>
              {relativo}
            </span>
            {isAdmin && !past && (
              <button
                onClick={onDelete}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
                style={{ color: '#4b5563', border: '1px solid transparent' }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = '#f43f5e'
                  el.style.background = 'rgba(244,63,94,0.1)'
                  el.style.borderColor = 'rgba(244,63,94,0.2)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = '#4b5563'
                  el.style.background = 'transparent'
                  el.style.borderColor = 'transparent'
                }}
                aria-label="Eliminar evento"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
        {evento.descripcion && (
          <p className="text-xs leading-relaxed" style={{ color: past ? '#374151' : '#64748b' }}>
            {evento.descripcion}
          </p>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <Clock size={10} style={{ color: past ? '#374151' : '#4b5563' }} />
          <p className="text-xs" style={{ color: past ? '#374151' : '#4b5563' }}>
            {formatFecha(evento.fecha)}
          </p>
        </div>
      </div>
    </div>
  )
}
