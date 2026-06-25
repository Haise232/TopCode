import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ClipboardCheck, Plus, Trash2, RefreshCw, Check,
  Clock, AlertTriangle, ChevronDown, ChevronUp, BookOpen,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { type Actividad, MATERIAS } from '@topcode/shared'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'
import { Button, Spinner } from '../components/ui'

type Filtro = 'todas' | 'pendientes' | 'completadas'

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
  pronto:     { color: '#8ff5d6', bg: 'rgba(85,239,196,0.1)',  border: 'rgba(85,239,196,0.25)', label: 'Próxima'    },
  normal:     { color: '#64748b', bg: 'var(--overlay-05)',border: 'var(--overlay-08)', label: 'Pendiente' },
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
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
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

  // Form state
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [materia, setMateria] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    if (!usuario) return
    // Solo los admins eliminan actividades vencidas (acción destructiva con impacto global)
    if (isAdmin) {
      await supabase.from('actividades').delete().lt('fecha_entrega', new Date().toISOString())
    }

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

  const actsFiltradas = actividades.filter(act => {
    const completada = estados[act.id] ?? false
    if (filtro === 'pendientes') return !completada
    if (filtro === 'completadas') return completada
    return true
  })

  const totalCompletadas = actividades.filter(a => estados[a.id]).length
  const totalPendientes  = actividades.length - totalCompletadas
  const pct = actividades.length ? Math.round((totalCompletadas / actividades.length) * 100) : 0

  const FILTROS: { key: Filtro; label: string; count: number }[] = [
    { key: 'todas',      label: 'Todas',      count: actividades.length },
    { key: 'pendientes', label: 'Pendientes', count: totalPendientes },
    { key: 'completadas',label: 'Hechas',     count: totalCompletadas },
  ]

  if (loading) return <ActividadesSkeleton />

  return (
    <div className="animate-fade-in h-full overflow-y-auto">

      {/* ── Header ── */}
      <div className="relative px-4 md:px-6 py-5 overflow-hidden" style={{ borderBottom: '1px solid var(--overlay-06)' }}>
        <div className="max-w-[1100px] mx-auto flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(85,239,196,0.12)', border: '1px solid rgba(85,239,196,0.2)' }}>
              <ClipboardCheck size={15} className="text-primary-light" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-text-primary">Actividades</h1>
              <p className="text-xs text-text-muted">
                {totalPendientes} pendiente{totalPendientes !== 1 ? 's' : ''} · {totalCompletadas} completada{totalCompletadas !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => { setRefreshing(true); await cargar(); setRefreshing(false) }}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5 text-text-muted"
              style={{ border: '1px solid var(--overlay-08)' }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {isAdmin && (
              <button onClick={() => setModalVisible(true)} className="bg-gradient-to-br from-primary to-cyan-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-primary px-4 py-2.5 text-sm">
                <Plus size={15} /> Nueva actividad
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-4">

        {/* ── Progreso general ── */}
        {actividades.length > 0 && (
          <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: 'var(--gradient-card)', border: '1px solid var(--overlay-07)' }}>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-text-secondary">Tu progreso</span>
                <span className={`text-xs font-bold tabular-nums ${pct === 100 ? 'text-success' : 'text-primary-light'}`}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--overlay-06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : 'linear-gradient(90deg, #55efc4, #00cec9)',
                  }}
                />
              </div>
              <p className="text-xs mt-1.5 text-text-muted">
                {totalCompletadas} de {actividades.length} actividades completadas
              </p>
            </div>
            {pct === 100 && (
              <div className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <Check size={20} className="text-success" />
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
                background: 'rgba(85,239,196,0.15)',
                border: '1px solid rgba(85,239,196,0.3)',
              } : {
                background: 'var(--overlay-04)',
                border: '1px solid var(--overlay-07)',
              }}
            >
              <span className={filtro === f.key ? 'text-primary-light' : 'text-text-muted'}>{f.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-2xs font-bold ${filtro === f.key ? 'text-primary-light' : 'text-text-muted'}`}
                style={{ background: filtro === f.key ? 'rgba(85,239,196,0.2)' : 'var(--overlay-06)' }}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Lista ── */}
        {actsFiltradas.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center rounded-2xl" style={{ background: 'var(--gradient-card)', border: '1px solid var(--overlay-06)' }}>
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(85,239,196,0.1)', border: '1px solid rgba(85,239,196,0.2)' }}>
              <ClipboardCheck size={24} className="text-primary-light" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">
                {filtro === 'todas' ? 'Sin actividades todavía' : `Sin actividades ${filtro}`}
              </p>
              <p className="text-sm mt-1 text-text-muted">
                {filtro === 'todas' && isAdmin ? 'Crea la primera con el botón de arriba.' : '¡Todo en orden!'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {actsFiltradas.map((act, idx) => (
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
          </div>
        )}
      </div>

      {/* ── Modal nueva actividad ── */}
      {modalVisible && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0" style={{ background: 'var(--color-modal-backdrop)', backdropFilter: 'blur(8px)' }} onClick={() => setModalVisible(false)} />
          <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-modal animate-scale-in-modal" style={{ background: 'var(--color-surface)', border: '1px solid var(--overlay-08)' }}>
            <div className="w-8 h-1 mx-auto mt-4 mb-1 sm:hidden rounded-full" style={{ background: 'var(--overlay-15)' }} />
            <div className="p-6 pt-4 sm:pt-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: 'rgba(85,239,196,0.12)', border: '1px solid rgba(85,239,196,0.2)' }}>
                  <ClipboardCheck size={15} className="text-primary-light" />
                </div>
                <h2 className="font-extrabold text-xl text-text-primary">Nueva actividad</h2>
              </div>
              <form onSubmit={handleCrear} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Título *</label>
                  <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Práctica 3 — Herencia en Java" className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]" autoFocus />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Materia</label>
                  <input
                    value={materia}
                    onChange={e => setMateria(e.target.value)}
                    placeholder="Selecciona o escribe..."
                    className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]"
                    list="materias-list"
                  />
                  <datalist id="materias-list">
                    {MATERIAS.map(m => <option key={m.codigo} value={m.nombreCorto} />)}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Descripción (opcional)</label>
                  <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Instrucciones, recursos, etc." rows={3} className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none resize-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">Fecha y hora límite *</label>
                  <input type="datetime-local" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} className="bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none [color-scheme:dark] focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]" />
                  {fechaEntrega && (
                    <p className="text-xs capitalize text-text-muted">
                      {new Date(fechaEntrega).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 mt-1">
                  <Button type="button" variant="ghost" onClick={() => setModalVisible(false)} className="flex-1 py-3 text-sm">Cancelar</Button>
                  <Button type="submit" disabled={saving || !titulo.trim() || !fechaEntrega} loading={saving} className="flex-[2] py-3 text-sm disabled:opacity-40">
                    {saving ? 'Creando...' : 'Crear actividad'}
                  </Button>
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
        background: 'var(--gradient-card)',
        border: `1px solid ${completada ? 'rgba(16,185,129,0.15)' : urg === 'vencida' ? 'rgba(244,63,94,0.12)' : 'var(--overlay-07)'}`,
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
              className={`font-semibold text-sm leading-snug ${completada ? 'text-text-muted' : 'text-text-primary'}`}
              style={{ textDecoration: completada ? 'line-through' : 'none' }}
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
            <span className="text-xs capitalize text-text-muted">
              {formatFechaEntrega(act.fecha_entrega)}
            </span>
          </div>

          {/* Descripción desplegable */}
          {act.descripcion && (
            <div>
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 mt-1.5 text-xs transition-colors duration-150 text-text-muted"
              >
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {expanded ? 'Ocultar' : 'Ver descripción'}
              </button>
              {expanded && (
                <p className="mt-2 text-xs leading-relaxed rounded-lg p-2.5 whitespace-pre-wrap text-text-secondary" style={{ background: 'var(--overlay-03)', border: '1px solid var(--overlay-05)' }}>
                  {act.descripcion}
                </p>
              )}
            </div>
          )}

          {/* Admin: progreso de alumnos */}
          {isAdmin && totalAlumnos > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden max-w-[100px]" style={{ background: 'var(--overlay-06)' }}>
                <div className="h-full rounded-full bg-success" style={{ width: `${(adminCount / totalAlumnos) * 100}%` }} />
              </div>
              <span className="text-[10px] font-medium text-text-muted">
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
            className="w-5 h-5 flex items-center justify-center rounded-md transition-all duration-200 active:scale-90 shrink-0"
            style={{
              background: completada ? '#10b981' : 'transparent',
              border: `2px solid ${completada ? '#10b981' : 'var(--overlay-20)'}`,
            }}
            aria-label={completada ? 'Marcar como pendiente' : 'Marcar como completada'}
          >
            {toggling ? (
              <Spinner size="sm" className="!w-2.5 !h-2.5 text-white" />
            ) : completada ? (
              <Check size={11} strokeWidth={3} className="text-white" />
            ) : null}
          </button>
        </div>
      </div>
    </div>
  )
}
