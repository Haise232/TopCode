import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, RefreshCw, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { EventoCalendario } from '../lib/types'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

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
    <div>
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SkeletonBox className="h-6 w-28 shimmer" />
        <SkeletonBox className="h-10 w-32 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-3">
        {[1,2,3].map(i => (
          <SkeletonCard key={i} className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <SkeletonBox className="h-5 w-40 shimmer" />
              <SkeletonBox className="h-6 w-20 shimmer rounded-lg" />
            </div>
            <SkeletonBox className="h-3 w-2/3 shimmer" />
            <SkeletonBox className="h-3 w-1/3 shimmer" />
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

  if (loading) return <CalendarSkeleton />

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="relative px-4 md:px-6 py-5 overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <CalendarDays size={15} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>Eventos</h1>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {upcoming.length} próximos · {past.length} pasados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => { setRefreshing(true); await cargar(); setRefreshing(false) }}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
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

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-5">
        {eventos.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-center mt-4 rounded-2xl" style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <CalendarDays size={28} style={{ color: '#f59e0b' }} />
            </div>
            <p className="font-semibold text-lg" style={{ color: '#f1f5f9' }}>Sin eventos</p>
            <p className="text-sm max-w-xs leading-relaxed" style={{ color: '#64748b' }}>
              {isAdmin ? 'Crea el primer evento con el botón de arriba.' : 'No hay eventos programados todavía.'}
            </p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Próximos</h2>
                {upcoming.map(ev => (
                  <EventCard key={ev.id} evento={ev} isAdmin={isAdmin} onDelete={() => handleEliminar(ev)} />
                ))}
              </div>
            )}
            {past.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4b5563' }}>Pasados</h2>
                {past.map(ev => (
                  <EventCard key={ev.id} evento={ev} isAdmin={isAdmin} onDelete={() => handleEliminar(ev)} past />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal crear evento */}
      {modalVisible && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
                <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
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
                    {saving ? 'Creando...' : 'Crear Evento'}
                  </button>
                </div>
              </form>
            </div>
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

function EventCard({ evento, isAdmin, onDelete, past }: {
  evento: EventoCalendario
  isAdmin: boolean
  onDelete: () => void
  past?: boolean
}) {
  const relativo = fechaRelativa(evento.fecha)
  const isToday = relativo === 'Hoy'
  const isTomorrow = relativo === 'Mañana'

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
    color: '#4b5563',
    border: '1px solid rgba(255,255,255,0.06)',
  } : {
    background: 'rgba(255,255,255,0.06)',
    color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.08)',
  }

  const dayNum = evento.fecha.split('-')[2]
  const monthName = MESES[parseInt(evento.fecha.split('-')[1]) - 1].slice(0, 3)

  return (
    <div
      className="flex gap-3 rounded-2xl transition-all duration-150"
      style={{
        background: past ? 'rgba(26,29,39,0.5)' : '#1a1d27',
        border: `1px solid ${isToday ? 'rgba(99,102,241,0.3)' : past ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'}`,
        padding: '14px 16px',
        opacity: past ? 0.55 : 1,
      }}
    >
      {/* Date block */}
      <div
        className="w-12 h-12 flex flex-col items-center justify-center shrink-0 rounded-xl"
        style={{
          background: isToday ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : past ? 'rgba(255,255,255,0.05)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${isToday ? 'rgba(99,102,241,0.4)' : past ? 'rgba(255,255,255,0.06)' : 'rgba(245,158,11,0.2)'}`,
        }}
      >
        <span className="text-sm font-extrabold leading-none" style={{ color: isToday ? 'white' : past ? '#4b5563' : '#f59e0b' }}>
          {parseInt(dayNum)}
        </span>
        <span className="text-xs mt-0.5 uppercase" style={{ color: isToday ? 'rgba(255,255,255,0.75)' : '#64748b' }}>
          {monthName}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-snug" style={{ color: past ? '#64748b' : '#f1f5f9' }}>
            {evento.titulo}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={badgeStyle}>
              {relativo}
            </span>
            {isAdmin && !past && (
              <button
                onClick={onDelete}
                className="w-6 h-6 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: '#64748b' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f43f5e' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748b' }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
        {evento.descripcion && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: '#64748b' }}>{evento.descripcion}</p>
        )}
        <p className="text-xs mt-1.5" style={{ color: '#4b5563' }}>{formatFecha(evento.fecha)}</p>
      </div>
    </div>
  )
}
