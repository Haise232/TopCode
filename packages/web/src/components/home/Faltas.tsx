import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, Check, ChevronDown, ClipboardPaste, Minus, Plus, ShieldCheck, Skull, X } from 'lucide-react'
import { useFaltas, type Falta, type FaltaInput, type HorarioClase } from '@topcode/shared'
import { cn } from '../ui/cn'
import { FOCO, materiaColor, varsColor } from '../ui/estilos'

/** Módulos de 2º DAM: horas totales (currículo oficial, 1000 h) y sigla con la que salen en el horario. */
const MODULOS = [
  { sigla: 'AED', codigo: '0486', nombre: 'Acceso a datos', horas: 206 },
  { sigla: 'DAD', codigo: '0488', nombre: 'Desarrollo de interfaces', horas: 173 },
  { sigla: 'PGL', codigo: '0489', nombre: 'Programación multimedia y dispositivos móviles', horas: 141 },
  { sigla: 'PGV', codigo: '0490', nombre: 'Programación de servicios y procesos', horas: 96 },
  { sigla: 'SSG', codigo: '0491', nombre: 'Sistemas de gestión empresarial', horas: 96 },
  { sigla: 'DPL', codigo: 'Opt.', nombre: 'Despliegue de aplicaciones web (optativo)', horas: 96 },
  { sigla: 'IPW', codigo: '1710', nombre: 'Itinerario personal para la empleabilidad II', horas: 96 },
  { sigla: 'PRO', codigo: '0492', nombre: 'Proyecto intermodular de DAM', horas: 64 },
  { sigla: 'SOJ', codigo: '1708', nombre: 'Sostenibilidad aplicada al sistema productivo', horas: 32 },
] as const

type Modulo = (typeof MODULOS)[number]
type Estado = 'ok' | 'cuidado' | 'critico' | 'perdida'

/** Códigos de la plataforma del instituto que no coinciden con la sigla del horario. */
const ALIAS: Record<string, string> = { D5H: 'DPL' }

/** ≥10 % cuidado, ≥15 % a punto, ≥20 % evaluación continua perdida. */
function estadoDe(faltadas: number, horas: number): Estado {
  const p = faltadas / horas
  if (p >= 0.2) return 'perdida'
  if (p >= 0.15) return 'critico'
  if (p >= 0.1) return 'cuidado'
  return 'ok'
}

const ESTADOS: Record<Estado, { texto: string; color: string; Icon: typeof Check }> = {
  ok:      { texto: 'Bien',               color: '#10b981', Icon: ShieldCheck },
  cuidado: { texto: 'Cuidado',            color: '#f59e0b', Icon: AlertTriangle },
  critico: { texto: 'A punto',            color: '#f97316', Icon: AlertTriangle },
  perdida: { texto: 'Evaluación perdida', color: '#f43f5e', Icon: Skull },
}

const fmt = (h: number) => h.toLocaleString('es', { maximumFractionDigits: 1 })
const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Sigla del módulo a partir del código entre paréntesis o, si no se reconoce, del nombre. */
function siglaDe(codigo: string, nombre: string): string | null {
  const c = ALIAS[codigo] ?? codigo
  if (MODULOS.some(m => m.sigla === c)) return c
  const n = normalizar(nombre)
  return MODULOS.find(m => n.startsWith(normalizar(m.nombre).slice(0, 14)))?.sigla ?? null
}

/**
 * Lee el listado de faltas copiado de la plataforma del instituto:
 *   19/11/2026
 *   08:00 - 08:55
 *   Programación multimedia y dispositivos móviles (PGL)
 */
function leerFaltas(texto: string): { filas: FaltaInput[]; desconocidas: string[] } {
  const filas: FaltaInput[] = []
  const desconocidas: string[] = []
  const vistas = new Set<string>()
  let fecha: string | null = null
  let hora: string | null = null

  for (const bruta of texto.split(/\r?\n/)) {
    const linea = bruta.trim()
    if (!linea) continue
    const f = linea.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (f) { fecha = `${f[3]}-${f[2].padStart(2, '0')}-${f[1].padStart(2, '0')}`; hora = null; continue }
    const h = linea.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*\d{1,2}:\d{2}$/)
    if (h) { hora = `${h[1].padStart(2, '0')}:${h[2]}`; continue }
    const m = linea.match(/^(.+?)\s*\(([A-Z0-9]{2,6})\)$/)
    if (m && fecha && hora) {
      const sigla = siglaDe(m[2], m[1])
      const clave = `${fecha} ${hora}`
      if (!sigla) desconocidas.push(`${m[1]} (${m[2]})`)
      else if (!vistas.has(clave)) { vistas.add(clave); filas.push({ modulo: sigla, fecha, hora_inicio: hora }) }
      hora = null
    }
  }
  return { filas, desconocidas: [...new Set(desconocidas)] }
}

function ChipEstado({ estado }: { estado: Estado }) {
  const { texto, color, Icon } = ESTADOS[estado]
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap text-[color:var(--c-ink)]"
      style={{ ...varsColor(color), background: 'var(--c-suave)' }}
    >
      <Icon size={11} aria-hidden="true" />{texto}
    </span>
  )
}

/** Resumen grande arriba: cómo vas en general. */
function Resumen({ porModulo }: { porModulo: { m: Modulo; h: number; estado: Estado }[] }) {
  const total = porModulo.reduce((s, x) => s + x.h, 0)
  const perdidas = porModulo.filter(x => x.estado === 'perdida')
  const riesgo = porModulo.filter(x => x.estado === 'critico' || x.estado === 'cuidado')
  const peor: Estado = perdidas.length ? 'perdida' : porModulo.some(x => x.estado === 'critico') ? 'critico' : riesgo.length ? 'cuidado' : 'ok'
  const { color, Icon } = ESTADOS[peor]
  const titulo = perdidas.length
    ? `Has superado el 20 % en ${perdidas.length} ${perdidas.length === 1 ? 'módulo' : 'módulos'}`
    : riesgo.length
      ? `Ojo con ${riesgo.length} ${riesgo.length === 1 ? 'módulo' : 'módulos'}`
      : total === 0 ? 'Sin faltas. ¡Sigue así!' : 'Todo bajo control'
  const sub = perdidas.length || riesgo.length
    ? [...perdidas, ...riesgo].map(x => x.m.nombre).join(' · ')
    : 'Ningún módulo pasa del 10 % de faltas.'

  return (
    <div className="flex items-center gap-4 rounded-2xl p-4 md:p-5" style={{ ...varsColor(color), background: 'var(--c-suave)' }}>
      <span className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--c)] text-white shadow-card">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-base md:text-lg font-bold text-text-primary leading-snug">{titulo}</p>
        <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">{sub}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-3xl font-extrabold font-mono leading-none text-[color:var(--c-ink)]">{total}</p>
        <p className="mt-1 text-2xs font-semibold uppercase tracking-wider text-text-muted">{total === 1 ? 'hora' : 'horas'}</p>
      </div>
    </div>
  )
}

type Pestana = 'dia' | 'pegar'

/** Panel para apuntar faltas: un día del horario o pegando el listado del instituto. */
function Apuntar({
  porDia, faltas, onAnadir,
}: {
  porDia: Record<number, HorarioClase[]>
  faltas: Falta[]
  onAnadir: (filas: FaltaInput[]) => Promise<void>
}) {
  const [pestana, setPestana] = useState<Pestana>('dia')
  return (
    <div className="rounded-2xl border border-ov/[0.07] p-4 md:p-5">
      <div role="tablist" aria-label="Cómo apuntar faltas" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-ov/[0.04]">
        {([['dia', 'Falté un día', CalendarPlus], ['pegar', 'Pegar del instituto', ClipboardPaste]] as const).map(([id, texto, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors',
              pestana === id ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-secondary',
              FOCO,
            )}
          >
            <Icon size={14} aria-hidden="true" />{texto}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {pestana === 'dia'
          ? <MarcarDia porDia={porDia} faltas={faltas} onAnadir={onAnadir} />
          : <Importar faltas={faltas} onAnadir={onAnadir} />}
      </div>
    </div>
  )
}

/** Marcar un día entero (o parte) a partir del horario. */
function MarcarDia({
  porDia, faltas, onAnadir,
}: {
  porDia: Record<number, HorarioClase[]>
  faltas: Falta[]
  onAnadir: (filas: FaltaInput[]) => Promise<void>
}) {
  const [fecha, setFecha] = useState(hoyISO)
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)

  const dia = new Date(`${fecha}T12:00:00`).getDay()
  const sesiones = porDia[dia] ?? []
  const yaMarcadas = new Set(faltas.filter(f => f.fecha === fecha && f.hora_inicio).map(f => f.hora_inicio))
  const elegidas = sesiones.filter(s => !yaMarcadas.has(s.hora_inicio) && !quitadas.has(s.hora_inicio))

  const alternar = (hora: string) => setQuitadas(prev => {
    const n = new Set(prev)
    if (n.has(hora)) n.delete(hora)
    else n.add(hora)
    return n
  })

  const enviar = async () => {
    setEnviando(true)
    await onAnadir(elegidas.map(s => ({ modulo: ALIAS[s.codigo] ?? s.codigo, fecha, hora_inicio: s.hora_inicio })))
    setQuitadas(new Set())
    setEnviando(false)
  }

  return (
    <div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-text-primary">¿Qué día?</span>
        <input
          type="date"
          value={fecha}
          max={hoyISO()}
          onChange={e => { setFecha(e.target.value || hoyISO()); setQuitadas(new Set()) }}
          className={cn('h-9 px-3 rounded-lg bg-ov/[0.04] border border-ov/[0.08] text-sm text-text-primary', FOCO)}
        />
      </label>

      {sesiones.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">Ese día no hay clases en el horario.</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-text-muted">Toca una clase para quitarla si sí fuiste.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sesiones.map(s => {
              const marcada = yaMarcadas.has(s.hora_inicio)
              const activa = !marcada && !quitadas.has(s.hora_inicio)
              return (
                <button
                  key={s.hora_inicio}
                  disabled={marcada}
                  onClick={() => alternar(s.hora_inicio)}
                  aria-pressed={activa}
                  style={varsColor(materiaColor(s.materia))}
                  className={cn(
                    'flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    activa ? 'bg-[var(--c-medio)] border-[color:var(--c)] text-text-primary'
                      : marcada ? 'border-dashed border-ov/[0.12] text-text-faint cursor-not-allowed'
                        : 'border-ov/[0.08] text-text-muted line-through',
                    FOCO,
                  )}
                  title={marcada ? 'Ya está apuntada' : s.materia}
                >
                  {activa || marcada ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
                  <span className="font-mono">{s.hora_inicio}</span>
                  <span className="text-[color:var(--c-ink)]">{s.codigo}</span>
                </button>
              )
            })}
          </div>
          <button
            onClick={enviar}
            disabled={elegidas.length === 0 || enviando}
            className={cn('mt-4 w-full h-10 rounded-xl text-sm font-bold bg-primary text-white transition-opacity disabled:opacity-40', FOCO)}
          >
            {elegidas.length === 0
              ? yaMarcadas.size ? 'Ese día ya está apuntado' : 'Elige alguna clase'
              : `Apuntar ${elegidas.length} ${elegidas.length === 1 ? 'hora' : 'horas'} de falta`}
          </button>
        </>
      )}
    </div>
  )
}

/** Pegar el listado de faltas del instituto: se apuntan todas y las repetidas se ignoran. */
function Importar({ faltas, onAnadir }: { faltas: Falta[]; onAnadir: (filas: FaltaInput[]) => Promise<void> }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const { filas, desconocidas } = useMemo(() => leerFaltas(texto), [texto])
  const existentes = new Set(faltas.map(f => `${f.fecha} ${f.hora_inicio}`))
  const nuevas = filas.filter(f => !existentes.has(`${f.fecha} ${f.hora_inicio}`))

  const enviar = async () => {
    setEnviando(true)
    await onAnadir(nuevas)
    setTexto('')
    setEnviando(false)
  }

  return (
    <div>
      <p className="text-xs text-text-muted">
        Copia la lista de faltas de la plataforma del instituto (fecha, hora y módulo) y pégala aquí.
        Las que ya tengas apuntadas no se repiten.
      </p>
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={6}
        placeholder={'19/11/2026\n08:00 - 08:55\nProgramación multimedia y dispositivos móviles (PGL)\nFalta sin justificar'}
        className={cn('mt-2 w-full px-3 py-2 rounded-xl bg-ov/[0.04] border border-ov/[0.08] text-xs font-mono text-text-primary placeholder:text-text-faint resize-y', FOCO)}
      />
      {texto.trim() && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-2xs font-semibold">
          <span className="px-2 py-1 rounded-full bg-ov/[0.05] text-text-secondary">{filas.length} detectadas</span>
          <span className="px-2 py-1 rounded-full bg-primary/15 text-primary-light">{nuevas.length} nuevas</span>
          {filas.length > nuevas.length && (
            <span className="px-2 py-1 rounded-full bg-ov/[0.05] text-text-muted">{filas.length - nuevas.length} ya apuntadas</span>
          )}
          {desconocidas.length > 0 && (
            <span className="px-2 py-1 rounded-full bg-amber-subtle text-amber-dark dark:text-amber-light" title={desconocidas.join('\n')}>
              {desconocidas.length} módulo{desconocidas.length === 1 ? '' : 's'} sin reconocer
            </span>
          )}
        </div>
      )}
      <button
        onClick={enviar}
        disabled={nuevas.length === 0 || enviando}
        className={cn('mt-3 w-full h-10 rounded-xl text-sm font-bold bg-primary text-white transition-opacity disabled:opacity-40', FOCO)}
      >
        {nuevas.length === 0
          ? filas.length ? 'Todas ya estaban apuntadas' : 'Pega tu listado de faltas'
          : `Importar ${nuevas.length} ${nuevas.length === 1 ? 'falta' : 'faltas'}`}
      </button>
    </div>
  )
}

/** Tarjeta de un módulo: barra hasta el 20 %, lo que queda y botones +/−. */
function TarjetaModulo({
  m, propias, estado, onMas, onMenos, onBorrar,
}: {
  m: Modulo
  propias: Falta[]
  estado: Estado
  onMas: () => void
  onMenos: () => void
  onBorrar: (id: string) => void
}) {
  const [abierta, setAbierta] = useState(false)
  const h = propias.length
  const limite = m.horas * 0.2
  const aviso = m.horas * 0.1
  const quedan = Math.max(0, limite - h)
  const pct = Math.min(100, (h / limite) * 100)
  const colorEstado = ESTADOS[estado].color

  return (
    <div className="rounded-2xl border border-ov/[0.07] bg-surface overflow-hidden" style={varsColor(materiaColor(m.nombre))}>
      <div className="h-1 bg-[var(--c)]" aria-hidden="true" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-bold font-mono text-[color:var(--c-ink)]">{m.sigla}</span>
              <span className="text-2xs text-text-faint font-mono">{m.codigo} · {m.horas} h</span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-text-primary leading-snug line-clamp-2" title={m.nombre}>{m.nombre}</p>
          </div>
          <ChipEstado estado={estado} />
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="leading-none">
            <span className="text-3xl font-extrabold font-mono text-text-primary">{h}</span>
            <span className="text-sm font-mono text-text-muted"> / {fmt(limite)} h</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={onMenos}
              disabled={h === 0}
              aria-label={`Quitar la última falta de ${m.nombre}`}
              className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-ov/[0.05] text-text-secondary hover:bg-ov/[0.09] disabled:opacity-30 transition-colors', FOCO)}
            >
              <Minus size={16} />
            </button>
            <button
              onClick={onMas}
              aria-label={`Añadir una hora de falta hoy en ${m.nombre}`}
              className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--c)] text-white hover:opacity-90 transition-opacity', FOCO)}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Barra hasta el 20 %: la marca central es el 10 % */}
        <div className="mt-3 relative">
          <div
            className="h-2.5 rounded-full bg-ov/[0.07] overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Math.round(limite * 10) / 10}
            aria-valuenow={h}
            aria-label={`Faltas en ${m.nombre}`}
          >
            <div className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${pct}%`, background: colorEstado }} />
          </div>
          <span className="absolute -top-[3px] left-1/2 w-0.5 h-4 rounded-full bg-text-faint/50" aria-hidden="true" />
          <div className="mt-1 flex justify-between text-2xs font-mono text-text-faint">
            <span>0</span>
            <span>10 % · {fmt(aviso)} h</span>
            <span>20 %</span>
          </div>
        </div>

        <p className="mt-2 text-xs font-medium text-text-secondary" style={estado === 'ok' ? undefined : { color: colorEstado }}>
          {estado === 'perdida'
            ? `Te has pasado ${fmt(h - limite)} h del límite`
            : <>Te quedan <b className="font-bold">{fmt(quedan)} h</b> para perder la evaluación continua</>}
        </p>

        {h > 0 && (
          <button
            onClick={() => setAbierta(a => !a)}
            aria-expanded={abierta}
            className={cn('mt-2 flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-text-secondary rounded', FOCO)}
          >
            <ChevronDown size={12} className={cn('transition-transform', abierta && 'rotate-180')} aria-hidden="true" />
            {abierta ? 'Ocultar días' : `Ver días (${h})`}
          </button>
        )}
        {abierta && (
          <ul className="mt-2 flex flex-col gap-1">
            {propias.map(f => (
              <li key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-ov/[0.035] text-xs">
                <span className="text-text-secondary first-letter:uppercase">{fechaCorta(f.fecha)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-text-muted">{f.hora_inicio ?? 'manual'}</span>
                  <button
                    onClick={() => onBorrar(f.id)}
                    aria-label="Borrar esta falta"
                    className={cn('w-6 h-6 rounded-md flex items-center justify-center text-text-faint hover:text-rose hover:bg-rose-subtle', FOCO)}
                  >
                    <X size={12} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Contador de faltas por módulo con límites del 10 % y 20 %, alta por día e importación. */
export function Faltas({ usuarioId, porDia }: { usuarioId: string | undefined; porDia: Record<number, HorarioClase[]> }) {
  const { faltas, loading, error, anadir, borrar } = useFaltas(usuarioId)
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null)

  const porModulo = useMemo(() => MODULOS.map(m => {
    const propias = faltas.filter(f => f.modulo === m.sigla)
    return { m, propias, h: propias.length, estado: estadoDe(propias.length, m.horas) }
  }), [faltas])

  const apuntar = async (filas: FaltaInput[]) => {
    const r = await anadir(filas)
    if (r.error) setAviso({ texto: r.error, error: true })
    else if (filas.length > 1) setAviso({ texto: `Apuntadas ${r.nuevas} ${r.nuevas === 1 ? 'falta' : 'faltas'}.`, error: false })
    else setAviso(null)
  }
  const quitar = async (ids: string[]) => {
    const r = await borrar(ids)
    setAviso(r.error ? { texto: r.error, error: true } : null)
  }

  if (!usuarioId) return <p className="text-sm text-text-muted">Inicia sesión para llevar la cuenta de tus faltas.</p>

  const mensaje = aviso ?? (error ? { texto: error, error: true } : null)

  return (
    <div className="flex flex-col gap-4">
      {loading && faltas.length === 0
        ? <div className="h-[88px] rounded-2xl bg-ov/[0.04] animate-pulse" />
        : <Resumen porModulo={porModulo} />}

      {mensaje && (
        <p
          role={mensaje.error ? 'alert' : 'status'}
          className={cn(
            'text-xs font-medium rounded-lg px-3 py-2',
            mensaje.error ? 'text-rose-dark dark:text-rose-light bg-rose-subtle' : 'text-primary-light bg-primary/10',
          )}
        >
          {mensaje.texto}
        </p>
      )}

      <Apuntar porDia={porDia} faltas={faltas} onAnadir={apuntar} />

      <div className="grid gap-3 sm:grid-cols-2">
        {porModulo.map(({ m, propias, estado }) => (
          <TarjetaModulo
            key={m.sigla}
            m={m}
            propias={propias}
            estado={estado}
            onMas={() => void apuntar([{ modulo: m.sigla, fecha: hoyISO(), hora_inicio: null }])}
            onMenos={() => { if (propias[0]) void quitar([propias[0].id]) }}
            onBorrar={id => void quitar([id])}
          />
        ))}
      </div>

      <p className="text-2xs text-text-faint text-center">
        Cada sesión cuenta como 1 hora · Al 10 % te avisa, al 15 % estás a punto y al 20 % pierdes la evaluación continua.
      </p>
    </div>
  )
}
