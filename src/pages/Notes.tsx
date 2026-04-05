import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, RefreshCw, ClipboardList, BookOpen, TrendingUp } from 'lucide-react'
import { supabase, actualizarPromedio } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Nota } from '../lib/types'
import { MATERIAS } from '../constants/materias'
import AlertModal from '../components/AlertModal'
import { SkeletonBox, SkeletonCard } from '../components/Skeleton'

function gradeColor(n: number) {
  if (n >= 8) return '#10b981'
  if (n >= 6) return '#f59e0b'
  return '#f43f5e'
}

function gradeBgColor(n: number) {
  if (n >= 8) return 'rgba(16,185,129,0.1)'
  if (n >= 6) return 'rgba(245,158,11,0.1)'
  return 'rgba(244,63,94,0.1)'
}

function gradeBorderColor(n: number) {
  if (n >= 8) return 'rgba(16,185,129,0.22)'
  if (n >= 6) return 'rgba(245,158,11,0.22)'
  return 'rgba(244,63,94,0.22)'
}

type AlertState = {
  type?: 'error' | 'success' | 'info' | 'warning'
  title: string
  message: string
  onConfirm?: () => void
  confirmLabel?: string
  confirmDestructive?: boolean
} | null

function NotesSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="px-4 md:px-6 py-5 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SkeletonBox className="h-7 w-32 shimmer" />
        <SkeletonBox className="h-10 w-36 shimmer rounded-xl" />
      </div>
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-4">
        {[1, 2, 3].map(i => (
          <SkeletonCard key={i} className="p-0 overflow-hidden">
            <div className="px-5 py-3.5 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <SkeletonBox className="h-5 w-40 shimmer" />
              <SkeletonBox className="h-6 w-16 shimmer rounded-lg" />
            </div>
            {[1, 2].map(j => (
              <div key={j} className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex-1 flex flex-col gap-2">
                  <SkeletonBox className="h-4 w-3/4 shimmer" />
                  <SkeletonBox className="h-3 w-1/3 shimmer" />
                </div>
                <SkeletonBox className="h-10 w-14 shimmer rounded-xl" />
              </div>
            ))}
          </SkeletonCard>
        ))}
      </div>
    </div>
  )
}

const MATERIA_COLORS = [
  { accent: '#6366f1', bg: 'rgba(99,102,241,0.07)',  border: 'rgba(99,102,241,0.18)',  text: '#818cf8'  },
  { accent: '#8b5cf6', bg: 'rgba(139,92,246,0.07)',  border: 'rgba(139,92,246,0.18)', text: '#a78bfa'  },
  { accent: '#10b981', bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.15)', text: '#34d399'  },
  { accent: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.15)', text: '#fbbf24'  },
  { accent: '#3b82f6', bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.15)', text: '#60a5fa'  },
  { accent: '#ec4899', bg: 'rgba(236,72,153,0.07)',  border: 'rgba(236,72,153,0.15)', text: '#f472b6'  },
  { accent: '#14b8a6', bg: 'rgba(20,184,166,0.07)',  border: 'rgba(20,184,166,0.15)', text: '#2dd4bf'  },
  { accent: '#f43f5e', bg: 'rgba(244,63,94,0.07)',   border: 'rgba(244,63,94,0.15)',  text: '#fb7185'  },
]

export default function Notes() {
  const { usuario } = useAuth()
  const [notas, setNotas] = useState<Nota[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<AlertState>(null)

  const [materia, setMateria] = useState('')
  const [tema, setTema] = useState('')
  const [teorica, setTeorica] = useState('')
  const [practica, setPractica] = useState('')

  const cargarNotas = useCallback(async () => {
    if (!usuario) return
    const { data } = await supabase
      .from('notas')
      .select('*')
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false })
    if (data) setNotas(data)
  }, [usuario])

  useEffect(() => {
    cargarNotas().finally(() => setLoading(false))
  }, [cargarNotas])

  function resetForm() {
    setMateria(''); setTema(''); setTeorica(''); setPractica('')
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!materia || !tema || !teorica || !practica) {
      setAlert({ type: 'error', title: 'Error', message: 'Completa todos los campos' })
      return
    }
    const t = parseFloat(teorica.replace(',', '.'))
    const p = parseFloat(practica.replace(',', '.'))
    if (isNaN(t) || isNaN(p) || t < 0 || t > 10 || p < 0 || p > 10) {
      setAlert({ type: 'error', title: 'Error', message: 'Las notas deben estar entre 0 y 10' })
      return
    }
    const media = Math.round(((t + p) / 2) * 100) / 100
    setSaving(true)
    const { error } = await supabase.from('notas').insert({
      usuario_id: usuario!.id,
      materia: materia.trim(),
      tema: tema.trim(),
      teorica: t,
      practica: p,
      media,
    })
    if (error) {
      setSaving(false)
      setAlert({ type: 'error', title: 'Error', message: 'No se pudo guardar: ' + error.message })
      return
    }
    await actualizarPromedio(usuario!.id)
    await cargarNotas()
    setSaving(false)
    setModalVisible(false)
    resetForm()
  }

  function handleEliminar(nota: Nota) {
    setAlert({
      title: 'Eliminar nota',
      message: `¿Eliminar la nota de "${nota.materia} — ${nota.tema}"?`,
      confirmLabel: 'Eliminar',
      confirmDestructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('notas').delete().eq('id', nota.id)
        if (error) {
          setAlert({ type: 'error', title: 'Error', message: 'No se pudo eliminar la nota.' })
          return
        }
        await actualizarPromedio(usuario!.id)
        await cargarNotas()
      },
    })
  }

  const notasPorMateria = notas.reduce<Record<string, Nota[]>>((acc, n) => {
    if (!acc[n.materia]) acc[n.materia] = []
    acc[n.materia].push(n)
    return acc
  }, {})

  const materiasKeys = Object.keys(notasPorMateria)

  const mediaPreview = teorica && practica && !isNaN(parseFloat(teorica)) && !isNaN(parseFloat(practica))
    ? (parseFloat(teorica.replace(',', '.')) + parseFloat(practica.replace(',', '.'))) / 2
    : null

  // Global average
  const promedioGlobal = notas.length > 0
    ? notas.reduce((sum, n) => sum + n.media, 0) / notas.length
    : null

  if (loading) return <NotesSkeleton />

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
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <ClipboardList size={15} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-xl tracking-tight" style={{ color: '#f1f5f9' }}>Mis Notas</h1>
                {promedioGlobal !== null && (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: gradeBgColor(promedioGlobal),
                      border: `1px solid ${gradeBorderColor(promedioGlobal)}`,
                    }}
                  >
                    <TrendingUp size={10} style={{ color: gradeColor(promedioGlobal) }} />
                    <span className="text-xs font-bold tabular-nums" style={{ color: gradeColor(promedioGlobal) }}>
                      {promedioGlobal.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {notas.length} registro{notas.length !== 1 ? 's' : ''} · {materiasKeys.length} materia{materiasKeys.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => { setRefreshing(true); await cargarNotas(); setRefreshing(false) }}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
              aria-label="Actualizar"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setModalVisible(true)} className="btn-primary px-4 py-2.5 text-sm">
              <Plus size={15} />
              Nueva Nota
            </button>
          </div>
        </div>
      </div>

      {/* ── List ── */}
      <div className="max-w-[1100px] mx-auto p-4 md:p-6 flex flex-col gap-4">
        {notas.length === 0 ? (
          <div
            className="py-16 flex flex-col items-center gap-4 text-center mt-2 rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, #1a1d27, #141720)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="w-16 h-16 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.18)' }}
            >
              <ClipboardList size={28} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p className="font-semibold text-lg" style={{ color: '#f1f5f9' }}>Sin notas registradas</p>
              <p className="text-sm mt-1.5 max-w-xs leading-relaxed" style={{ color: '#64748b' }}>
                Pulsa "Nueva Nota" para añadir tu primera calificación.
              </p>
            </div>
            <button onClick={() => setModalVisible(true)} className="btn-primary px-5 py-2.5 text-sm">
              <Plus size={14} />
              Nueva Nota
            </button>
          </div>
        ) : (
          materiasKeys.map((mat, matIdx) => {
            const ns = notasPorMateria[mat]
            const avgMat = ns.reduce((a, n) => a + n.media, 0) / ns.length
            const matColor = MATERIA_COLORS[matIdx % MATERIA_COLORS.length]

            return (
              <div
                key={mat}
                className="overflow-hidden rounded-2xl animate-slide-up"
                style={{
                  animationDelay: `${matIdx * 50}ms`,
                  background: 'linear-gradient(145deg, #1a1d27, #141720)',
                  border: `1px solid ${matColor.border}`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              >
                {/* Materia header */}
                <div
                  className="flex justify-between items-center px-5 py-3.5"
                  style={{
                    background: matColor.bg,
                    borderBottom: `1px solid ${matColor.border}`,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Color stripe */}
                    <div
                      className="w-1 h-5 rounded-full shrink-0"
                      style={{ background: matColor.accent }}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen size={13} style={{ color: matColor.text }} className="shrink-0" />
                      <span className="font-semibold text-sm truncate" style={{ color: '#f1f5f9' }}>{mat}</span>
                      {MATERIAS.find(m => m.nombre === mat)?.codigo && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                          style={{
                            background: `${matColor.accent}22`,
                            color: matColor.accent,
                            border: `1px solid ${matColor.accent}30`,
                          }}
                        >
                          {MATERIAS.find(m => m.nombre === mat)?.codigo}
                        </span>
                      )}
                      <span className="text-xs shrink-0 hidden sm:inline" style={{ color: '#4b5563' }}>
                        {ns.length} examen{ns.length !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Subject average */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0 ml-2"
                    style={{
                      background: gradeBgColor(avgMat),
                      border: `1px solid ${gradeBorderColor(avgMat)}`,
                    }}
                  >
                    <span className="text-xs font-bold tabular-nums" style={{ color: gradeColor(avgMat) }}>
                      {avgMat.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Notes rows */}
                {ns.map((nota, idx) => (
                  <div
                    key={nota.id}
                    className="flex items-center gap-4 px-5 py-4 transition-colors duration-100"
                    style={{
                      borderBottom: idx < ns.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block" style={{ color: '#f1f5f9' }}>{nota.tema}</span>
                      <div className="flex gap-2 mt-2">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg"
                          style={{ background: gradeBgColor(nota.teorica), color: gradeColor(nota.teorica), border: `1px solid ${gradeBorderColor(nota.teorica)}` }}
                        >
                          <span style={{ color: '#64748b', fontWeight: '400' }}>T</span>
                          {nota.teorica}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg"
                          style={{ background: gradeBgColor(nota.practica), color: gradeColor(nota.practica), border: `1px solid ${gradeBorderColor(nota.practica)}` }}
                        >
                          <span style={{ color: '#64748b', fontWeight: '400' }}>P</span>
                          {nota.practica}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Grade circle */}
                      <div
                        className="w-12 h-12 flex items-center justify-center font-extrabold text-lg rounded-xl tabular-nums"
                        style={{
                          background: gradeBgColor(nota.media),
                          color: gradeColor(nota.media),
                          border: `1px solid ${gradeBorderColor(nota.media)}`,
                        }}
                      >
                        {nota.media.toFixed(1)}
                      </div>
                      <button
                        onClick={() => handleEliminar(nota)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150"
                        style={{ color: '#4b5563', border: '1px solid transparent' }}
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
                          el.style.borderColor = 'transparent'
                        }}
                        aria-label="Eliminar nota"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* ── Add note modal — portal ── */}
      {modalVisible && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9999]"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setModalVisible(false); resetForm() }}
          />
          <div className="fixed inset-x-0 bottom-0 z-[9999] sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6">
            <div
              className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto animate-scale-in-modal rounded-t-2xl sm:rounded-2xl shadow-modal"
              style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="w-8 h-1 mx-auto mt-4 mb-1 sm:hidden rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />

              <div className="p-6 pt-4 sm:pt-6">
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
                  >
                    <Plus size={15} style={{ color: '#818cf8' }} />
                  </div>
                  <h2 className="font-extrabold text-xl" style={{ color: '#f1f5f9' }}>Nueva Nota</h2>
                </div>

                <form onSubmit={handleGuardar} className="flex flex-col gap-5">
                  {/* Materia selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Materia</label>
                    <div className="grid grid-cols-2 gap-2">
                      {MATERIAS.map((m, mIdx) => {
                        const sel = materia === m.nombre
                        const color = MATERIA_COLORS[mIdx % MATERIA_COLORS.length]
                        return (
                          <button
                            key={m.codigo}
                            type="button"
                            onClick={() => setMateria(m.nombre)}
                            className="flex items-center gap-2.5 px-3 py-2.5 text-left rounded-xl transition-all duration-150"
                            style={{
                              border: `1px solid ${sel ? color.border : 'rgba(255,255,255,0.07)'}`,
                              background: sel ? color.bg : 'rgba(255,255,255,0.02)',
                              boxShadow: sel ? `0 0 0 1px ${color.accent}18` : 'none',
                            }}
                          >
                            <span
                              className="text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0"
                              style={{
                                background: sel ? color.accent : 'rgba(255,255,255,0.07)',
                                color: sel ? 'white' : '#64748b',
                              }}
                            >
                              {m.codigo}
                            </span>
                            <span
                              className="text-xs flex-1 leading-tight"
                              style={{ color: sel ? color.text : '#64748b', fontWeight: sel ? '600' : '400' }}
                            >
                              {m.nombreCorto}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Tema */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Tema / Descripción</label>
                    <input
                      type="text"
                      value={tema}
                      onChange={e => setTema(e.target.value)}
                      placeholder="Ej: Derivadas, Examen T1..."
                      className="input-base"
                    />
                  </div>

                  {/* Grades */}
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Teórica</label>
                      <input
                        type="number"
                        min="0" max="10" step="0.1"
                        value={teorica}
                        onChange={e => setTeorica(e.target.value)}
                        placeholder="0–10"
                        className="input-base text-center text-lg font-bold"
                        style={teorica && !isNaN(parseFloat(teorica)) ? { color: gradeColor(parseFloat(teorica)) } : {}}
                      />
                    </div>
                    <div className="pb-3 font-bold text-xl" style={{ color: '#374151' }}>+</div>
                    <div className="flex-1 flex flex-col gap-2">
                      <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Práctica</label>
                      <input
                        type="number"
                        min="0" max="10" step="0.1"
                        value={practica}
                        onChange={e => setPractica(e.target.value)}
                        placeholder="0–10"
                        className="input-base text-center text-lg font-bold"
                        style={practica && !isNaN(parseFloat(practica)) ? { color: gradeColor(parseFloat(practica)) } : {}}
                      />
                    </div>
                  </div>

                  {/* Media preview */}
                  {mediaPreview !== null && !isNaN(mediaPreview) && (
                    <div
                      className="flex items-center justify-between px-5 py-4 rounded-xl animate-scale-in"
                      style={{
                        background: gradeBgColor(mediaPreview),
                        border: `1px solid ${gradeBorderColor(mediaPreview)}`,
                      }}
                    >
                      <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>Media final</span>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-extrabold tabular-nums" style={{ color: gradeColor(mediaPreview) }}>
                          {mediaPreview.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => { setModalVisible(false); resetForm() }}
                      className="flex-1 btn-ghost py-3 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-[2] btn-primary py-3 text-sm"
                    >
                      {saving ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
                          Guardando...
                        </div>
                      ) : 'Guardar Nota'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      <AlertModal
        visible={alert !== null}
        type={alert?.type}
        title={alert?.title ?? ''}
        message={alert?.message ?? ''}
        onClose={() => setAlert(null)}
        onConfirm={alert?.onConfirm}
        confirmLabel={alert?.confirmLabel}
        confirmDestructive={alert?.confirmDestructive}
      />
    </div>
  )
}
