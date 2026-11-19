import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, Check, ChevronDown, ChevronRight, ClipboardPaste, Minus, Plus, ShieldCheck, Skull, X } from 'lucide-react'
import { PESO_JUSTIFICADA, pesoFalta, useFaltas, type Falta, type FaltaInput, type HorarioClase } from '@topcode/shared'
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

/** ≥10 % apercibimiento, ≥15 % a punto, ≥20 % evaluación continua perdida. */
function estadoDe(faltadas: number, horas: number): Estado {
  const p = faltadas / horas
  if (p >= 0.2) return 'perdida'
  if (p >= 0.15) return 'critico'
  if (p >= 0.1) return 'cuidado'
  return 'ok'
}

const ESTADOS: Record<Estado, { texto: string; color: string; Icon: typeof Check }> = {
  ok:      { texto: 'Bien',               color: '#10b981', Icon: ShieldCheck },
  cuidado: { texto: 'Apercibimiento',     color: '#f59e0b', Icon: AlertTriangle },
  critico: { texto: 'A punto',            color: '#f97316', Icon: AlertTriangle },
  perdida: { texto: 'Evaluación perdida', color: '#f43f5e', Icon: Skull },
}

const ROJO = '#f43f5e'
/** Colores de las barras: sin justificar en amarillo (rojo al acercarse al apercibimiento) y justificadas en azul. */
const AMARILLO = '#f5b70b'
const AZUL = '#38bdf8'

/** Recuento de un módulo: horas que computan (las justificadas valen 0,75) y desglose. */
interface Cuenta { h: number; injust: number; just: number }
const contar = (lista: Falta[]): Cuenta => {
  const just = lista.filter(f => f.justificada).length
  return { h: lista.reduce((s, f) => s + pesoFalta(f), 0), injust: lista.length - just, just }
}

/** Barra partida: tramo amarillo/rojo (sin justificar) y tramo azul (justificadas), sobre el 20 %. */
function BarraFaltas({ c, limite, alerta, grosor }: { c: Cuenta; limite: number; alerta: boolean; grosor: string }) {
  const pctInjust = Math.min(100, (c.injust / limite) * 100)
  const pctJust = Math.min(100 - pctInjust, ((c.just * PESO_JUSTIFICADA) / limite) * 100)
  return (
    <div className={cn('flex rounded-full bg-ov/[0.07] overflow-hidden', grosor)}>
      <div className="h-full motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${pctInjust}%`, background: alerta ? ROJO : AMARILLO }} />
      <div className="h-full motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${pctJust}%`, background: AZUL }} />
    </div>
  )
}

/** «● 4 sin justificar · ● 2 justificadas» */
function Desglose({ c, alerta, className }: { c: Cuenta; alerta?: boolean; className?: string }) {
  if (c.injust + c.just === 0) return null
  return (
    <span className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-2xs font-semibold text-text-muted', className)}>
      {c.injust > 0 && (
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: alerta ? ROJO : AMARILLO }} aria-hidden="true" />
          {c.injust} sin justificar
        </span>
      )}
      {c.just > 0 && (
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: AZUL }} aria-hidden="true" />
          {c.just} {c.just === 1 ? 'justificada' : 'justificadas'}
        </span>
      )}
    </span>
  )
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
 *   Falta sin justificar        ← o «Falta justificada»
 */
function leerFaltas(texto: string): { filas: FaltaInput[]; desconocidas: string[] } {
  const filas: FaltaInput[] = []
  const desconocidas: string[] = []
  const vistas = new Set<string>()
  let fecha: string | null = null
  let hora: string | null = null
  let ultima: FaltaInput | null = null

  for (const bruta of texto.split(/\r?\n/)) {
    const linea = bruta.trim()
    if (!linea) continue
    const f = linea.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (f) { fecha = `${f[3]}-${f[2].padStart(2, '0')}-${f[1].padStart(2, '0')}`; hora = null; continue }
    const h = linea.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*\d{1,2}:\d{2}$/)
    if (h) { hora = `${h[1].padStart(2, '0')}:${h[2]}`; continue }
    // «Falta justificada» / «Falta sin justificar» va justo después del módulo
    if (/^falta\b/i.test(linea)) {
      if (ultima) ultima.justificada = !/sin justificar|injustificada/i.test(linea) && /justificad/i.test(linea)
      ultima = null
      continue
    }
    const m = linea.match(/^(.+?)\s*\(([A-Z0-9]{2,6})\)$/)
    if (m && fecha && hora) {
      const sigla = siglaDe(m[2], m[1])
      const clave = `${fecha} ${hora}`
      ultima = null
      if (!sigla) desconocidas.push(`${m[1]} (${m[2]})`)
      else if (!vistas.has(clave)) {
        vistas.add(clave)
        ultima = { modulo: sigla, fecha, hora_inicio: hora, justificada: false }
        filas.push(ultima)
      }
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
function Resumen({ porModulo }: { porModulo: { m: Modulo; c: Cuenta; estado: Estado }[] }) {
  const total = porModulo.reduce((s, x) => s + x.c.h, 0)
  const todo = porModulo.reduce((s, x) => ({ h: s.h + x.c.h, injust: s.injust + x.c.injust, just: s.just + x.c.just }), { h: 0, injust: 0, just: 0 })
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
    : 'Ningún módulo llega al apercibimiento (10 %).'

  return (
    <div className="flex items-center gap-4 rounded-2xl p-4 md:p-5" style={{ ...varsColor(color), background: 'var(--c-suave)' }}>
      <span className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--c)] text-white shadow-card">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-base md:text-lg font-bold text-text-primary leading-snug">{titulo}</p>
        <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">{sub}</p>
        <Desglose c={todo} className="mt-1.5" />
      </div>
      <div className="shrink-0 text-right">
        <p className="text-3xl font-extrabold font-mono leading-none text-[color:var(--c-ink)]">{fmt(total)}</p>
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
  const [justificada, setJustificada] = useState(false)

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
    await onAnadir(elegidas.map(s => ({ modulo: ALIAS[s.codigo] ?? s.codigo, fecha, hora_inicio: s.hora_inicio, justificada })))
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
          <div className="mt-4 grid grid-cols-2 gap-1 p-1 rounded-xl bg-ov/[0.04]" role="radiogroup" aria-label="¿Está justificada?">
            {([[false, 'Sin justificar', AMARILLO], [true, 'Justificada', AZUL]] as const).map(([valor, texto, color]) => (
              <button
                key={texto}
                role="radio"
                aria-checked={justificada === valor}
                onClick={() => setJustificada(valor)}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors',
                  justificada === valor ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-secondary',
                  FOCO,
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
                {texto}
              </button>
            ))}
          </div>
          <button
            onClick={enviar}
            disabled={elegidas.length === 0 || enviando}
            className={cn('mt-3 w-full h-10 rounded-xl text-sm font-bold bg-primary text-white transition-opacity disabled:opacity-40', FOCO)}
          >
            {elegidas.length === 0
              ? yaMarcadas.size ? 'Ese día ya está apuntado' : 'Elige alguna clase'
              : `Apuntar ${elegidas.length} ${elegidas.length === 1 ? 'falta' : 'faltas'}${justificada ? ' justificadas' : ''}`}
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
  const existentes = new Map(faltas.filter(f => f.hora_inicio).map(f => [`${f.fecha} ${f.hora_inicio}`, f]))
  const nuevas = filas.filter(f => !existentes.has(`${f.fecha} ${f.hora_inicio}`))
  // Ya apuntadas pero el instituto las ha justificado (o al revés): se actualizan
  const cambian = filas.filter(f => {
    const e = existentes.get(`${f.fecha} ${f.hora_inicio}`)
    return e && e.justificada !== (f.justificada ?? false)
  })
  const iguales = filas.length - nuevas.length - cambian.length
  const total = nuevas.length + cambian.length
  const nJust = filas.filter(f => f.justificada).length

  const enviar = async () => {
    setEnviando(true)
    await onAnadir([...nuevas, ...cambian])
    setTexto('')
    setEnviando(false)
  }

  return (
    <div>
      <p className="text-xs text-text-muted">
        Copia la lista de faltas de la plataforma del instituto (fecha, hora y módulo) y pégala aquí.
        Las que ya tengas apuntadas no se repiten; si el instituto ha justificado alguna, se actualiza.
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
          {nJust > 0 && (
            <span className="px-2 py-1 rounded-full text-sky-600 dark:text-sky-300" style={{ background: 'rgb(56 189 248 / 0.15)' }}>{nJust} justificadas</span>
          )}
          {cambian.length > 0 && (
            <span className="px-2 py-1 rounded-full bg-ov/[0.05] text-text-secondary">{cambian.length} cambian de justificación</span>
          )}
          {iguales > 0 && (
            <span className="px-2 py-1 rounded-full bg-ov/[0.05] text-text-muted">{iguales} ya apuntadas</span>
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
        disabled={total === 0 || enviando}
        className={cn('mt-3 w-full h-10 rounded-xl text-sm font-bold bg-primary text-white transition-opacity disabled:opacity-40', FOCO)}
      >
        {total === 0
          ? filas.length ? 'Todas ya estaban apuntadas' : 'Pega tu listado de faltas'
          : cambian.length === 0
            ? `Importar ${nuevas.length} ${nuevas.length === 1 ? 'falta' : 'faltas'}`
            : `Importar ${nuevas.length} y actualizar ${cambian.length}`}
      </button>
    </div>
  )
}

/** Tarjeta de un módulo: barra hasta el 20 %, lo que queda y botones +/−. */
function TarjetaModulo({
  m, propias, c, estado, acciones,
}: {
  m: Modulo
  propias: Falta[]
  c: Cuenta
  estado: Estado
  /** Sin acciones la tarjeta es solo de lectura (modal de Inicio). */
  acciones?: { onMas: () => void; onMenos: () => void; onBorrar: (id: string) => void; onJustificar: (id: string, v: boolean) => void }
}) {
  const [abierta, setAbierta] = useState(false)
  const h = c.h
  const limite = m.horas * 0.2
  const aviso = m.horas * 0.1
  const quedan = Math.max(0, limite - h)
  const colorEstado = ESTADOS[estado].color
  const alerta = h > 0 && h >= aviso * 0.75

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
            <span className="text-3xl font-extrabold font-mono text-text-primary">{fmt(h)}</span>
            <span className="text-sm font-mono text-text-muted"> / {fmt(limite)} h</span>
          </p>
          {acciones && <div className="flex items-center gap-1">
            <button
              onClick={acciones.onMenos}
              disabled={propias.length === 0}
              aria-label={`Quitar la última falta de ${m.nombre}`}
              className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-ov/[0.05] text-text-secondary hover:bg-ov/[0.09] disabled:opacity-30 transition-colors', FOCO)}
            >
              <Minus size={16} />
            </button>
            <button
              onClick={acciones.onMas}
              aria-label={`Añadir una hora de falta hoy en ${m.nombre}`}
              className={cn('w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--c)] text-white hover:opacity-90 transition-opacity', FOCO)}
            >
              <Plus size={16} />
            </button>
          </div>}
        </div>

        {/* Barra hasta el 20 %: la marca central es el 10 % */}
        <div className="mt-3 relative">
          <div role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(limite * 10) / 10} aria-valuenow={h} aria-label={`Faltas en ${m.nombre}`}>
            <BarraFaltas c={c} limite={limite} alerta={alerta} grosor="h-2.5" />
          </div>
          <span className="absolute -top-[3px] left-1/2 w-0.5 h-4 rounded-full bg-text-faint/50" aria-hidden="true" />
          <div className="mt-1 flex justify-between text-2xs font-mono text-text-faint">
            <span>0</span>
            <span>Apercibimiento · {fmt(aviso)} h</span>
            <span>20 %</span>
          </div>
        </div>

        <Desglose c={c} alerta={alerta} className="mt-2" />
        <p className="mt-1.5 text-xs font-medium text-text-secondary" style={estado === 'ok' ? undefined : { color: colorEstado }}>
          {estado === 'perdida'
            ? `Te has pasado ${fmt(h - limite)} h del límite`
            : <>Te quedan <b className="font-bold">{fmt(quedan)} h</b> para perder la evaluación continua</>}
        </p>

        {acciones && propias.length > 0 && (
          <button
            onClick={() => setAbierta(a => !a)}
            aria-expanded={abierta}
            className={cn('mt-2 flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-text-secondary rounded', FOCO)}
          >
            <ChevronDown size={12} className={cn('transition-transform', abierta && 'rotate-180')} aria-hidden="true" />
            {abierta ? 'Ocultar días' : `Ver días (${propias.length})`}
          </button>
        )}
        {acciones && abierta && (
          <ul className="mt-2 flex flex-col gap-1">
            {propias.map(f => (
              <li key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-ov/[0.035] text-xs">
                <span className="text-text-secondary first-letter:uppercase">{fechaCorta(f.fecha)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-text-muted">{f.hora_inicio ?? 'manual'}</span>
                  <button
                    onClick={() => acciones.onJustificar(f.id, !f.justificada)}
                    title={f.justificada ? 'Pulsa para marcarla sin justificar' : 'Pulsa para marcarla justificada'}
                    className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold transition-colors', FOCO)}
                    style={f.justificada
                      ? { background: 'rgb(56 189 248 / 0.16)', color: 'color-mix(in srgb, #38bdf8, black 30%)' }
                      : { background: 'rgb(245 183 11 / 0.18)', color: 'color-mix(in srgb, #f5b70b, black 40%)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.justificada ? AZUL : AMARILLO }} aria-hidden="true" />
                    {f.justificada ? 'Justificada' : 'Sin justificar'}
                  </button>
                  <button
                    onClick={() => acciones.onBorrar(f.id)}
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

/** Fila compacta de solo lectura (modal de Inicio): faltadas, lo que queda y una barra fina. */
function FilaSimple({ m, c, estado }: { m: Modulo; c: Cuenta; estado: Estado }) {
  const h = c.h
  const limite = m.horas * 0.2
  const aviso = m.horas * 0.1
  const quedan = Math.max(0, limite - h)
  // En rojo desde el 75 % del apercibimiento (7,5 % de las horas): te estás acercando al 10 %
  const alerta = h > 0 && h >= aviso * 0.75
  const color = alerta ? ROJO : estado === 'ok' ? AMARILLO : ESTADOS[estado].color
  return (
    <li className={cn('px-4 py-3', alerta && 'bg-rose-subtle')} style={varsColor(materiaColor(m.nombre))}>
      <div className="flex items-center gap-3">
        <span className="shrink-0 w-1 self-stretch rounded-full bg-[var(--c)]" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate" title={m.nombre}>{m.nombre}</p>
          {/* La barra llega al 20 %; la marca | es el tope del apercibimiento (10 %), justo a la mitad */}
          <div className="relative mt-1.5" aria-hidden="true">
            <BarraFaltas c={c} limite={limite} alerta={alerta} grosor={alerta ? 'h-2' : 'h-1.5'} />
            <span
              className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-text-primary/70"
              style={{ left: `${(aviso / limite) * 100}%` }}
              title={`Apercibimiento: ${fmt(aviso)} h`}
            />
          </div>
          <Desglose c={c} alerta={alerta} className="mt-1" />
          {alerta && (
            <p className="mt-1 flex items-center gap-1 text-2xs font-bold" style={{ color: ROJO }}>
              <AlertTriangle size={11} aria-hidden="true" />
              {h < aviso
                ? `Te acercas al apercibimiento: ${fmt(aviso - h)} h más y llega`
                : estado === 'perdida' ? 'Has perdido la evaluación continua' : 'Ya tienes apercibimiento (10 %)'}
            </p>
          )}
        </div>
        <div className="shrink-0 grid grid-cols-2 gap-3 text-right">
          <div>
            <p className="text-lg font-extrabold font-mono leading-none text-text-primary">{fmt(h)}</p>
            <p className="mt-0.5 text-2xs text-text-muted">faltadas</p>
          </div>
          <div className="min-w-[3.5rem]">
            <p className="text-lg font-extrabold font-mono leading-none" style={{ color: alerta || estado !== 'ok' ? color : undefined }}>
              {estado === 'perdida' ? '0' : fmt(quedan)}
            </p>
            <p className="mt-0.5 text-2xs text-text-muted">te quedan</p>
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * Faltas por módulo frente a los límites del 10 % y 20 %.
 * Con `editable` (página /faltas) añade el panel para apuntar y los botones de cada tarjeta;
 * sin él (modal de Inicio) solo muestra cómo vas y un botón para ir a apuntarlas.
 */
export function Faltas({
  usuarioId, porDia = {}, editable = false, onGestionar,
}: {
  usuarioId: string | undefined
  porDia?: Record<number, HorarioClase[]>
  editable?: boolean
  onGestionar?: () => void
}) {
  const { faltas, loading, error, anadir, borrar, justificar } = useFaltas(usuarioId)
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null)

  const porModulo = useMemo(() => MODULOS.map(m => {
    const propias = faltas.filter(f => f.modulo === m.sigla)
    const c = contar(propias)
    return { m, propias, c, estado: estadoDe(c.h, m.horas) }
  }), [faltas])

  const apuntar = async (filas: FaltaInput[]) => {
    const r = await anadir(filas)
    if (r.error) setAviso({ texto: r.error, error: true })
    else if (filas.length > 1) {
      const partes = [`Apuntadas ${r.nuevas} ${r.nuevas === 1 ? 'falta' : 'faltas'}`]
      if (r.actualizadas) partes.push(`${r.actualizadas} ${r.actualizadas === 1 ? 'cambia' : 'cambian'} de justificación`)
      setAviso({ texto: `${partes.join(' y ')}.`, error: false })
    }
    else setAviso(null)
  }
  const cambiarJustificada = async (id: string, v: boolean) => {
    const r = await justificar(id, v)
    setAviso(r.error ? { texto: r.error, error: true } : null)
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

      {!editable && (
        <div className="flex items-center justify-center gap-4 text-2xs font-semibold text-text-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: AMARILLO }} />Sin justificar</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: AZUL }} />Justificada (×0,75)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: ROJO }} />Cerca del apercibimiento</span>
        </div>
      )}

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

      {editable && <Apuntar porDia={porDia} faltas={faltas} onAnadir={apuntar} />}


      {editable ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {porModulo.map(({ m, propias, c, estado }) => (
            <TarjetaModulo
              key={m.sigla}
              m={m}
              propias={propias}
              c={c}
              estado={estado}
              acciones={{
                onMas: () => void apuntar([{ modulo: m.sigla, fecha: hoyISO(), hora_inicio: null }]),
                onMenos: () => { if (propias[0]) void quitar([propias[0].id]) },
                onBorrar: id => void quitar([id]),
                onJustificar: (id, v) => void cambiarJustificada(id, v),
              }}
            />
          ))}
        </div>
      ) : (
        <ul className="rounded-2xl border border-ov/[0.07] divide-y divide-ov/[0.06] overflow-hidden">
          {porModulo.map(({ m, c, estado }) => <FilaSimple key={m.sigla} m={m} c={c} estado={estado} />)}
        </ul>
      )}

      {onGestionar && (
        <button
          onClick={onGestionar}
          className={cn('flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold bg-primary text-white hover:opacity-90 transition-opacity', FOCO)}
        >
          <CalendarPlus size={16} aria-hidden="true" />
          Añadir faltas
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}

      <p className="text-2xs text-text-faint text-center">
        Cada sesión sin justificar cuenta 1 h y una justificada 0,75 h (un 25 % menos) · Al 10 % hay apercibimiento, al 15 % estás a punto y al 20 % pierdes la evaluación continua.
      </p>
    </div>
  )
}
