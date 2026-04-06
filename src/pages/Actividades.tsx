import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ClipboardCheck, Plus, Trash2, RefreshCw, CheckCircle2,
  Circle, Clock, AlertTriangle, ChevronDown, ChevronUp, BookOpen,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Actividad } from '../lib/types'
import { MATERIAS } from '../constants/materias'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

type Filtro = 'todas' | 'pendientes' | 'completadas' | 'vencidas'

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message?: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

// ── Urgencia ─────────────────────────────────────────────────────────────────

type Urgencia = 'completada' | 'vencida' | 'hoy' | 'pronto' | 'normal'

function calcUrgencia(fechaEntrega: string, completada: boolean): Urgencia {
  if (completada) return 'completada'
  const diff = new Date(fechaEntrega).getTime() - Date.now()
  const dias = diff / 86400000
  if (dias < 0) return 'vencida'
  if (dias < 1) return 'hoy'
  if (dias < 3) return 'pronto'
  return 'normal'
}

const URGENCIA_STYLE: Record<Urgencia, { color: string; bg: string; border: string; label: string }> = {
  completada: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)', label: 'Completada' },
  vencida:    { color: '#f43f5e', bg: 'rgba(244,63,94,0.1)',   border: 'rgba(244,63,94,0.25)',  label: 'Vencida'    },
  hoy:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)', label: 'Hoy'        },
  pronto:     { color: '#818cf8', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)', label: 'Próxima'    },
  normal:     { color: '#64748b', bg: 'rgba(255,255,255,0.05)',border: 'rgba(255,255,255,0.08)', label: 'Pendiente' },
}

function countdown(fechaEntrega: string): string {
  const diff = new Date(fechaEntrega).getTime() - Date.now()
  if (diff < 0) {
    const d = Math.floor(Math.abs(diff) / 86400000)
    return d === 0 ? 'Venció hoy' : `Venció hace ${d}d`
  }
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Menos de 1h'
  if (h < 24) return `${h}h restantes`
  const d = Math.floor(diff / 86400000)
  if (d === 1) return 'Mañana'
  return `En ${d} días`
}

function formatFechaEntrega(fechaEntrega: string): string {
  return new Date(fechaEntrega).toLocaleDateString('es', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function materiaColor(nombre: string) {
  const hue = nombre.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return `hsla(${hue},60%,65%,1)`
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function ActividadesSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SkeletonBox className="h-7 w-40 shimmer" />
        <SkeletonBox className="h-10 w-36 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-4">
        <SkeletonCard className="h-16" />
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <SkeletonBox key={i} className="h-8 w-24 shimmer rounded-xl" />)}
        </div>
        {[1,2,3,4].map(i => (
          <SkeletonCard key={i} className="flex items-center gap-4 py-5">
            <SkeletonBox className="h-12 w-12 shrink-0 shimmer rounded-xl" />
            <div className="flex-1 flex flex-col gap-2">
              <SkeletonBox className="h-4 w-2/5 shimmer" />
              <SkeletonBox className="h-3 w-3/5 shimmer" />
            </div>
            <SkeletonBox className="h-8 w-24 shimmer rounded-xl" />
            <SkeletonBox className="h-6 w-6 shimmer rounded-full" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Actividades() {
  const { usuario } = useAuth()
  const isAdmin = usuario?.rol === 'admin'

  const [actividades, setActividades] = useState<Actividad[]>([])
  const [estados, setEstados] = useState<Record<string, boolean>>({})
  const [statsAdmin, setStatsAdmin] = useState<Record<string, number>>({})
  const [totalAlumnos, setTotalAlumnos] = useState(0)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [alert, setAlert] = useState<AlertState>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [pastCollapsed, setPastCollapsed] = useState(true)

  // Form state
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [materia, setMateria] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    if (!usuario) return
    const [actsRes, estadosRes] = await Promise.all([
      supabase.from('actividades').select('*').order('fecha_entrega', { ascending: true }),
      supabase.from('actividades_estado').select('actividad_id, completada').eq('usuario_id', usuario.id),
    ])
    if (actsRes.data) setActividades(actsRes.data as Actividad[])
    if (estadosRes.data) {
      const map: Record<string, boolean> = {}
      estadosRes.data.forEach(e => { map[e.actividad_id] = e.completada })
      setEstados(map)
    }
    if (isAdmin) {
      const [statsRes, usersRes] = await Promise.all([
        supabase.from('actividades_estado').select('actividad_id').eq('completada', true),
        supabase.from('usuarios').select('id', { count: 'exact', head: true }),
      ])
      if (statsRes.data) {
        const counts: Record<string, number> = {}
        statsRes.data.forEach(e => {
          counts[e.actividad_id] = (counts[e.actividad_id] ?? 0) + 1
        })
        setStatsAdmin(counts)
      }
      setTotalAlumnos(usersRes.count ?? 0)
    }
  }, [usuario, isAdmin])

  useEffect(() => {
    cargar().finally(() => setLoading(false))
  }, [cargar])

  async function toggleCompletada(act: Actividad) {
    if (!usuario) return
    const actual = estados[act.id] ?? false
    const nuevo = !actual
    setToggling(act.id)
    setEstados(prev => ({ ...prev, [act.id]: nuevo }))
    await supabase.from('actividades_estado').upsert({
      actividad_id: act.id,
      usuario_id: usuario.id,
      completada: nuevo,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'actividad_id,usuario_id' })
    setToggling(null)
  }

  function handleEliminar(act: Actividad) {
    setAlert({
      title: 'Eliminar actividad',
      message: `¿Eliminar "${act.titulo}"? Se borrará el seguimiento de todos los alumnos.`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        await supabase.from('actividades').delete().eq('id', act.id)
        await cargar()
      },
    })
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !fechaEntrega) return
    setSaving(true)
    const { error } = await supabase.from('actividades').insert({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      materia: materia.trim() || null,
      fecha_entrega: new Date(fechaEntrega).toISOString(),
      created_by: usuario!.id,
    })
    setSaving(false)
    if (error) {
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo crear la actividad: ' + error.message })
      return
    }
    setTitulo(''); setDescripcion(''); setMateria(''); setFechaEntrega('')
    setModalVisible(false)
    await cargar()
  }

  // ── Filtrado ────────────────────────────────────────────────────────────────

  const ahora = Date.now()

  const actsFiltradas = actividades.filter(act => {
    const completada = estados[act.id] ?? false
    const vencida = new Date(act.fecha_entrega).getTime() < ahora && !completada
    if (filtro === 'pendientes') return !completada && !vencida
    if (filtro === 'completadas') return completada
    if (filtro === 'vencidas') return vencida
    return true
  })

  const proximas = actsFiltradas.filter(act => new Date(act.fecha_entrega).getTime() >= ahora || (estados[act.id] ?? false))
  const pasadas  = actsFiltradas.filter(act => new Date(act.fecha_entrega).getTime() < ahora && !(estados[act.id] ?? false))

  const totalCompletadas = actividades.filter(a => estados[a.id]).length
  const totalVencidas    = actividades.filter(a => !estados[a.id] && new Date(a.fecha_entrega).getTime() < ahora).length
  const totalPendientes  = actividades.length - totalCompletadas - totalVencidas
  const pct = actividades.length ? Math.round((totalCompletadas / actividades.length) * 100) : 0

  const FILTROS: { key: Filtro; label: string; count: number }[] = [
    { key: 'todas',      label: 'Todas',      count: actividades.length },
    { key: 'pendientes', label: 'Pendientes', count: totalPendientes },
    { key: 'completadas',label: 'Hechas',     count: totalCompletadas },
    { key: 'vencidas',   label: 'Vencidas',   count: totalVencidas },
  ]

  if (loading) return <ActividadesSkeleton />

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div className="relative px-4 md:px-6 py-5 overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <ClipboardCheck size={15} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>Actividades</h1>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {totalPendientes} pendiente{totalPendientes !== 1 ? 's' : ''} · {totalCompletadas} completada{totalCompletadas !== 1 ? 's' : ''}
                {totalVencidas > 0 && <span style={{ color: '#f43f5e' }}> · {totalVencidas} vencida{totalVencidas !== 1 ? 's' : ''}</span>}
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
                <Plus size={15} /> Nueva actividad
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-4">

        {/* ── Progreso general ── */}
        {actividades.length > 0 && (
          <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: 'linear-gradient(145deg, #1a1d27, #141720)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Tu progreso</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: pct === 100 ? '#10b981' : '#818cf8' }}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  }}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#4b5563' }}>
                {totalCompletadas} de {actividades.length} actividades completadas
              </p>
            </div>
            {pct === 100 && (
              <div className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <CheckCircle2 size={20} style={{ color: '#10b981' }} />
              </div>
            )}
          </div>
        )}

        {/* ── Filtros ── */}
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150"
              style={filtro === f.key ? {
                background: 'rgba(99,102,241,0.15)',
                border: '1px solid rgba(99,102,241,0.3)',
                color: '#818cf8',
              } : {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#64748b',
              }}
            >
              {f.label}
              <span className="px-1.5 py-0.5 rounded-md text-2xs font-bold" style={{
                background: filtro === f.key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                color: filtro === f.key ? '#818cf8' : '#4b5563',
              }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Lista ── */}
        {actsFiltradas.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center rounded-2xl" style={{ background: 'linear-gradient(145deg, #1a1d27, #141720)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <ClipboardCheck size={24} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#f1f5f9' }}>
                {filtro === 'todas' ? 'Sin actividades todavía' : `Sin actividades ${filtro}`}
              </p>
              <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                {filtro === 'todas' && isAdmin ? 'Crea la primera con el botón de arriba.' : '¡Todo en orden!'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">

            {/* Próximas / activas */}
            {proximas.map((act, idx) => (
              <ActividadRow
                key={act.id}
                act={act}
                completada={estados[act.id] ?? false}
                toggling={toggling === act.id}
                isAdmin={isAdmin}
                adminCount={statsAdmin[act.id] ?? 0}
                totalAlumnos={totalAlumnos}
                delay={idx * 30}
                onToggle={() => toggleCompletada(act)}
                onDelete={() => handleEliminar(act)}
              />
            ))}

            {/* Vencidas colapsables */}
            {pasadas.length > 0 && filtro === 'todas' && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setPastCollapsed(v => !v)}
                  className="flex items-center gap-2 px-1 py-1 text-xs font-semibold transition-colors duration-150 w-fit"
                  style={{ color: '#4b5563' }}
                >
                  {pastCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  {pasadas.length} vencida{pasadas.length !== 1 ? 's'  : ''}
                </button>
                {!pastCollapsed && pasadas.map((act, idx) => (
                  <ActividadRow
                    key={act.id}
                    act={act}
                    completada={false}
                    toggling={toggling === act.id}
                    isAdmin={isAdmin}
                    adminCount={statsAdmin[act.id] ?? 0}
                    totalAlumnos={totalAlumnos}
                    delay={idx * 25}
                    onToggle={() => toggleCompletada(act)}
                    onDelete={() => handleEliminar(act)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal nueva actividad ── */}
      {modalVisible && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setModalVisible(false)} />
          <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-modal animate-scale-in-modal" style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-8 h-1 mx-auto mt-4 mb-1 sm:hidden rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <div className="p-6 pt-4 sm:pt-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <ClipboardCheck size={15} style={{ color: '#818cf8' }} />
                </div>
                <h2 className="font-extrabold text-xl" style={{ color: '#f1f5f9' }}>Nueva actividad</h2>
              </div>
              <form onSubmit={handleCrear} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Título *</label>
                  <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Práctica 3 — Herencia en Java" className="input-base" autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Materia</label>
                  <input
                    value={materia}
                    onChange={e => setMateria(e.target.value)}
                    placeholder="Selecciona o escribe..."
                    className="input-base"
                    list="materias-list"
                  />
                  <datalist id="materias-list">
                    {MATERIAS.map(m => <option key={m.codigo} value={m.nombreCorto} />)}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Descripción (opcional)</label>
                  <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Instrucciones, recursos, etc." rows={3} className="input-base resize-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Fecha y hora límite *</label>
                  <input type="datetime-local" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className="input-base [color-scheme:dark]" />
                  {fechaEntrega && (
                    <p className="text-xs capitalize" style={{ color: '#64748b' }}>
                      {new Date(fechaEntrega).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={() => setModalVisible(false)} className="flex-1 btn-ghost py-3 text-sm">Cancelar</button>
                  <button type="submit" disabled={saving || !titulo.trim() || !fechaEntrega} className="flex-[2] btn-primary py-3 text-sm disabled:opacity-40">
                    {saving ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
                        Creando...
                      </div>
                    ) : 'Crear actividad'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body,
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

// ── Fila de actividad ─────────────────────────────────────────────────────────

function ActividadRow({
  act, completada, toggling, isAdmin, adminCount, totalAlumnos, delay,
  onToggle, onDelete,
}: {
  act: Actividad
  completada: boolean
  toggling: boolean
  isAdmin: boolean
  adminCount: number
  totalAlumnos: number
  delay: number
  onToggle: () => void
  onDelete: () => void
}) {
  const urg = calcUrgencia(act.fecha_entrega, completada)
  const style = URGENCIA_STYLE[urg]
  const cd = countdown(act.fecha_entrega)
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-2xl overflow-hidden animate-slide-up transition-all duration-200"
      style={{
        animationDelay: `${delay}ms`,
        background: 'linear-gradient(145deg, #1a1d27, #141720)',
        border: `1px solid ${completada ? 'rgba(16,185,129,0.15)' : urg === 'vencida' ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.07)'}`,
        opacity: completada ? 0.75 : 1,
      }}
    >
      <div className="flex items-start gap-3 p-4">

        {/* Barra de urgencia lateral */}
        <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5" style={{ background: style.color, opacity: completada ? 0.5 : 0.8, minHeight: 40 }} />

        {/* Bloque fecha */}
        <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
          <span className="text-base font-extrabold leading-none tabular-nums" style={{ color: style.color }}>
            {new Date(act.fecha_entrega).getDate()}
          </span>
          <span className="text-[9px] uppercase font-semibold mt-0.5" style={{ color: style.color, opacity: 0.75 }}>
            {new Date(act.fecha_entrega).toLocaleDateString('es', { month: 'short' })}
          </span>
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p
              className="font-semibold text-sm leading-snug"
              style={{
                color: completada ? '#64748b' : '#f1f5f9',
                textDecoration: completada ? 'line-through' : 'none',
              }}
            >
              {act.titulo}
            </p>
            {act.materia && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  background: `${materiaColor(act.materia)}18`,
                  color: materiaColor(act.materia),
                  border: `1px solid ${materiaColor(act.materia)}30`,
                }}
              >
                <BookOpen size={9} className="inline mr-1" />
                {act.materia}
              </span>
            )}
          </div>

          {/* Countdown + fecha */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: style.color }}>
              {urg === 'vencida' ? <AlertTriangle size={11} /> : <Clock size={11} />}
              {cd}
            </span>
            <span className="text-xs capitalize" style={{ color: '#374151' }}>
              {formatFechaEntrega(act.fecha_entrega)}
            </span>
          </div>

          {/* Descripción desplegable */}
          {act.descripcion && (
            <div>
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 mt-1.5 text-xs transition-colors duration-150"
                style={{ color: '#4b5563' }}
              >
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {expanded ? 'Ocultar' : 'Ver descripción'}
              </button>
              {expanded && (
                <p className="mt-2 text-xs leading-relaxed rounded-lg p-2.5 whitespace-pre-wrap" style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {act.descripcion}
                </p>
              )}
            </div>
          )}

          {/* Admin: progreso de alumnos */}
          {isAdmin && totalAlumnos > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden max-w-[100px]" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${(adminCount / totalAlumnos) * 100}%`, background: '#10b981' }} />
              </div>
              <span className="text-[10px] font-medium" style={{ color: '#4b5563' }}>
                {adminCount}/{totalAlumnos} completaron
              </span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isAdmin && (
            <button
              onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
              style={{ color: '#374151', border: '1px solid transparent' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#f43f5e'; el.style.background = 'rgba(244,63,94,0.1)'; el.style.borderColor = 'rgba(244,63,94,0.2)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#374151'; el.style.background = 'transparent'; el.style.borderColor = 'transparent' }}
              aria-label="Eliminar"
            >
              <Trash2 size={12} />
            </button>
          )}

          {/* Checkbox */}
          <button
            onClick={onToggle}
            disabled={toggling}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90"
            style={{
              color: completada ? '#10b981' : '#374151',
              border: `2px solid ${completada ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
              background: completada ? 'rgba(16,185,129,0.1)' : 'transparent',
            }}
            aria-label={completada ? 'Marcar como pendiente' : 'Marcar como completada'}
          >
            {toggling ? (
              <div className="w-3 h-3 rounded-full animate-spin" style={{ border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: completada ? '#10b981' : '#64748b' }} />
            ) : completada ? (
              <CheckCircle2 size={14} />
            ) : (
              <Circle size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
