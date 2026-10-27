// Parser de eventos en español natural. Puro: sin I/O ni Date.now().
// Zona horaria de referencia: Europe/Madrid (el "hoy" se calcula con Intl).

import { buscarMateriaEnPalabras, normalizarPalabra } from './materias.ts'
import { etiquetaTipo, type TipoEvento } from './tipos.ts'

export type ParseResult =
  | {
    ok: true
    titulo: string
    /** YYYY-MM-DD */
    fecha: string
    /** HH:MM o null si no se indicó hora */
    hora: string | null
    /** nombreCorto de MATERIAS o null */
    materia: string | null
    /** Tipo de evento deducido de las palabras clave (por defecto 'actividad') */
    tipo: TipoEvento
    /** Notas no bloqueantes para mostrar al usuario */
    avisos: string[]
  }
  | { ok: false; error: string }

export const TITULO_MAX = 120
export const TEXTO_MAX = 500
const ZONA = 'Europe/Madrid'

const AYUDA = 'Ejemplo: «examen jueves 22 AED», «entrega 7/11 DPL 23:59» o «tutoría mañana a las 10».'

interface Ymd {
  y: number
  m: number
  d: number
}

interface Tok {
  orig: string
  n: string // normalizada (minusculas, sin tildes, sin signos en los bordes)
}

class ErrorParseo extends Error {}

// ---------------------------------------------------------------- fechas

const formateador = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function ahoraMadrid(ahora: Date): { hoy: Ymd; minutos: number } {
  const p: Record<string, number> = {}
  for (const parte of formateador.formatToParts(ahora)) {
    if (parte.type !== 'literal') p[parte.type] = Number(parte.value)
  }
  return { hoy: { y: p.year, m: p.month, d: p.day }, minutos: p.hour * 60 + p.minute }
}

const dia = (f: Ymd): number => Math.floor(Date.UTC(f.y, f.m - 1, f.d) / 86_400_000)

function desdeDia(n: number): Ymd {
  const dt = new Date(n * 86_400_000)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

function valida(f: Ymd): boolean {
  if (f.m < 1 || f.m > 12 || f.d < 1) return false
  const dt = new Date(Date.UTC(f.y, f.m - 1, f.d))
  return dt.getUTCFullYear() === f.y && dt.getUTCMonth() === f.m - 1 && dt.getUTCDate() === f.d
}

const diaSemana = (f: Ymd): number => new Date(Date.UTC(f.y, f.m - 1, f.d)).getUTCDay()
const pad = (n: number): string => String(n).padStart(2, '0')
const iso = (f: Ymd): string => `${String(f.y).padStart(4, '0')}-${pad(f.m)}-${pad(f.d)}`
const legible = (f: Ymd): string => `${pad(f.d)}/${pad(f.m)}/${f.y}`

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
}
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9,
  set: 9, oct: 10, nov: 11, dic: 12,
}
const esMes = (n: string): boolean => Object.hasOwn(MESES, n)
const esDiaSemana = (n: string): boolean => Object.hasOwn(DIAS_SEMANA, n)
const MAX_DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// Palabras que, justo antes de un número, indican que forma parte del título
// ("práctica 2", "tema 5") y no es un día del mes.
const PREFIJO_NUMERO_TITULO = new Set([
  'practica', 'tema', 'unidad', 'ut', 'ud', 'ejercicio', 'ejercicios', 'tarea', 'actividad',
  'parte', 'fase', 'proyecto', 'trabajo', 'numero', 'n', 'no', 'lab', 'laboratorio', 'sprint',
  'sesion', 'leccion', 'capitulo', 'cap', 'version', 'v', 'evaluacion', 'trimestre', 'ra',
])
// Palabras que acompañan a una fecha y se retiran del título si la preceden.
const RELLENO_PREVIO_FECHA = new Set(['el', 'para', 'este', 'esta', 'dia', 'del', 'hasta'])
// Palabras que, justo antes de un numero, lo marcan como dia del mes con prioridad.
const PREFIJO_DIA = new Set(['el', 'dia', 'del', 'para', 'hasta'])
// Palabras (singular) que, justo despues de un numero, lo convierten en una cantidad.
const UNIDADES = new Set([
  'dia', 'semana', 'hora', 'minuto', 'parcial', 'tema', 'ejercicio', 'pregunta', 'pagina', 'punto',
  'alumno', 'problema', 'practica', 'mes', 'meses',
])
// Plurales que NO son una unidad ("22 las", "3 y 4"...).
const NO_UNIDAD_PLURAL = new Set(['las', 'los', 'mas', 'menos', 'tras', 'dos', 'tres', 'pues', 'antes', 'ademas'])
const MSG_VARIAS = 'Has puesto más de una fecha en el mensaje. Indica solo una (por ejemplo «examen jueves 22»).'
const MSG_RELATIVA = 'No admito fechas relativas como «en 3 días» o «en 2 semanas». ' +
  'Escribe la fecha: «examen el 22», «examen viernes», «examen 22/10», «examen mañana» o «examen pasado mañana».'
const MODIFICADOR_PROXIMO = new Set(['proximo', 'proxima', 'siguiente'])
const BORDE_TITULO = new Set(['el', 'la', 'los', 'las', 'para', 'de', 'del', 'a', 'en', 'y', 'con', 'por', 'hasta'])

// ---------------------------------------------------------------- tokens

function tokenizar(texto: string): Tok[] {
  return texto
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((orig) => ({ orig, n: normalizarPalabra(orig) }))
}

const esNum = (s: string | undefined): boolean => s !== undefined && /^\d{1,2}$/.test(s)

// ---------------------------------------------------------------- hora

interface HoraRes {
  h: number
  min: number
  /** true si se dio un rango ("de 10 a 12") y solo se guarda la hora de inicio */
  rango: boolean
}

type Periodo = 'manana' | 'madrugada' | 'am' | 'pm' | 'noche' | 'mediodia'

/** "10", "10:30", "10.30", "10h", "10h30" -> hora/minuto. */
function horaSimple(s: string): { h: number; min: number } | null {
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d{1,2})[:.](\d{2})h?$/))) return { h: Number(m[1]), min: Number(m[2]) }
  if ((m = s.match(/^(\d{1,2})(?:h|hs|hrs)(\d{2})?$/))) return { h: Number(m[1]), min: m[2] ? Number(m[2]) : 0 }
  if (esNum(s)) return { h: Number(s), min: 0 }
  return null
}

/** Periodo del dia tras la hora: "de la tarde", "del mediodia", "pm"... */
function leerPeriodo(
  toks: Tok[],
  libre: (i: number) => boolean,
  fin: number,
): { periodo: Periodo | null; fin: number } {
  const sig = (k: number): string | undefined => (libre(fin + k) ? toks[fin + k].n : undefined)
  if (sig(1) === 'de' && sig(2) === 'la' && libre(fin + 3)) {
    const p = toks[fin + 3].n
    if (p === 'manana') return { periodo: 'manana', fin: fin + 3 }
    if (p === 'madrugada') return { periodo: 'madrugada', fin: fin + 3 }
    if (p === 'tarde') return { periodo: 'pm', fin: fin + 3 }
    if (p === 'noche') return { periodo: 'noche', fin: fin + 3 }
  } else if (sig(1) === 'del' && sig(2) === 'mediodia') return { periodo: 'mediodia', fin: fin + 2 }
  else if (sig(1) === 'pm') return { periodo: 'pm', fin: fin + 1 }
  else if (sig(1) === 'am') return { periodo: 'am', fin: fin + 1 }
  return { periodo: null, fin }
}

function ajustarPeriodo(h: number, min: number, periodo: Periodo | null): { h: number; min: number } {
  switch (periodo) {
    case 'pm':
      return { h: h >= 1 && h < 12 ? h + 12 : h, min }
    case 'noche':
      // "12 de la noche" = final del dia (23:59), no 00:00 (que seria el inicio del mismo dia).
      if (h === 12 && min === 0) return { h: 23, min: 59 }
      if (h === 12) return { h: 0, min }
      return { h: h >= 5 && h < 12 ? h + 12 : h, min }
    case 'madrugada':
    case 'am':
      return { h: h === 12 ? 0 : h, min }
    case 'mediodia':
      return { h: h >= 1 && h <= 3 ? h + 12 : h, min }
    default: // 'manana' ("12 de la mañana" = 12:00) o sin periodo
      return { h, min }
  }
}

function errorHora(orig: string): ErrorParseo {
  return new ErrorParseo(`La hora «${orig}» no es válida. Usa un formato como 23:59, 10h o «a las 10».`)
}

function extraerHora(toks: Tok[], usados: Set<number>): HoraRes | null {
  const libre = (i: number): boolean => i >= 0 && i < toks.length && !usados.has(i)

  // Rango: "de 10 a 12", "de las 10 a las 12".
  for (let i = 0; i < toks.length; i++) {
    if (!libre(i) || toks[i].n !== 'de') continue
    let j = i + 1
    if (libre(j) && (toks[j].n === 'las' || toks[j].n === 'la')) j++
    if (!libre(j)) continue
    const a = horaSimple(toks[j].n)
    if (!a || a.h > 23 || a.min > 59) continue
    let k = j + 1
    if (!libre(k) || (toks[k].n !== 'a' && toks[k].n !== 'hasta')) continue
    k++
    if (libre(k) && (toks[k].n === 'las' || toks[k].n === 'la')) k++
    if (!libre(k)) continue
    const b = horaSimple(toks[k].n)
    if (!b || b.h > 24 || b.min > 59) continue
    const { periodo, fin } = leerPeriodo(toks, libre, k)
    const r = ajustarPeriodo(a.h, a.min, periodo)
    if (r.h > 23) throw errorHora(toks[j].orig)
    for (let x = i; x <= fin; x++) usados.add(x)
    return { ...r, rango: true }
  }

  for (let i = 0; i < toks.length; i++) {
    if (usados.has(i)) continue
    const t = toks[i].n
    let h: number | null = null
    let min = 0
    let conMin = false // los minutos ya venian en el propio token
    let fin = i // ultimo indice consumido
    let m: RegExpMatchArray | null

    if ((m = t.match(/^(\d{1,2})[:.](\d{2})h?$/))) {
      h = Number(m[1]); min = Number(m[2]); conMin = true
    } else if ((m = t.match(/^(\d{1,2})(?:h|hs|hrs)(\d{2})?$/))) {
      h = Number(m[1]); min = m[2] ? Number(m[2]) : 0; conMin = true
    } else if (esNum(t) && libre(i + 1) && ['h', 'hs', 'hrs', 'horas'].includes(toks[i + 1].n)) {
      h = Number(t); fin = i + 1
    } else if (esNum(t) && i > 0 && libre(i - 1) &&
      (toks[i - 1].n === 'las' || (toks[i - 1].n === 'la' && Number(t) === 1))) {
      h = Number(t)
    } else {
      continue
    }

    // Complementos: "y media", "y cuarto", "y 15", "menos cuarto", "menos 5", "en punto".
    const sig = (k: number): string | undefined => (libre(fin + k) ? toks[fin + k].n : undefined)
    const num = sig(2)
    // "y 30" no son minutos si lo que sigue es un mes ("a las 9 y 30 de octubre" no tiene sentido, pero "10 y 22 oct" tampoco).
    const sigueMes = (): boolean => {
      const a = sig(3)
      if (a === undefined) return false
      return esMes(a) || (a === 'de' && libre(fin + 4) && esMes(toks[fin + 4].n))
    }
    if (sig(1) === 'y' && sig(2) === 'media') { min = 30; fin += 2 }
    else if (sig(1) === 'y' && sig(2) === 'cuarto') { min = 15; fin += 2 }
    else if (sig(1) === 'menos' && sig(2) === 'cuarto') { h = (h + 23) % 24; min = 45; fin += 2 }
    else if (!conMin && sig(1) === 'y' && esNum(num) && Number(num) <= 59 && !sigueMes()) {
      min = Number(num); fin += 2
    } else if (!conMin && sig(1) === 'menos' && esNum(num) && Number(num) >= 1 && Number(num) <= 59 && !sigueMes()) {
      h = (h + 23) % 24; min = 60 - Number(num); fin += 2
    } else if (sig(1) === 'en' && sig(2) === 'punto') { fin += 2 }

    const per = leerPeriodo(toks, libre, fin)
    fin = per.fin
    ;({ h, min } = ajustarPeriodo(h, min, per.periodo))

    if (h < 0 || h > 23 || min < 0 || min > 59) throw errorHora(toks[i].orig)

    // Consumir el rango y el "a las"/"a la"/"las"/"la" previo.
    let ini = i
    if (ini > 0 && libre(ini - 1) && (toks[ini - 1].n === 'las' || toks[ini - 1].n === 'la')) {
      ini -= 1
      if (ini > 0 && libre(ini - 1) && toks[ini - 1].n === 'a') ini -= 1
    }
    for (let k = ini; k <= fin; k++) usados.add(k)
    return { h, min, rango: false }
  }
  return null
}

// ---------------------------------------------------------------- fecha

interface Explicita {
  d: number
  m: number
  y: number | null
}

/** Marca como usados los rellenos previos ("el", "para", "próximo"...) y devuelve si hubo "próximo". */
function consumirPrevios(toks: Tok[], usados: Set<number>, desde: number): boolean {
  let proximo = false
  let i = desde - 1
  while (i >= 0 && !usados.has(i)) {
    const n = toks[i].n
    if (RELLENO_PREVIO_FECHA.has(n)) usados.add(i)
    else if (MODIFICADOR_PROXIMO.has(n)) { usados.add(i); proximo = true }
    else break
    i--
  }
  return proximo
}

function buscarExplicita(toks: Tok[], usados: Set<number>): Explicita | null {
  for (let i = 0; i < toks.length; i++) {
    if (usados.has(i)) continue
    const t = toks[i].n
    let m: RegExpMatchArray | null

    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
      usados.add(i); consumirPrevios(toks, usados, i)
      return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
    }
    if ((m = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?$/))) {
      usados.add(i); consumirPrevios(toks, usados, i)
      let y: number | null = null
      if (m[3]) y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
      return { d: Number(m[1]), m: Number(m[2]), y }
    }
    if ((m = t.match(/^(\d{1,2})[/-]([a-z]+)(?:[/-](\d{4}))?$/)) && esMes(m[2])) {
      usados.add(i); consumirPrevios(toks, usados, i)
      return { d: Number(m[1]), m: MESES[m[2]], y: m[3] ? Number(m[3]) : null }
    }
    if (esNum(t)) {
      // "22 de octubre [de 2026]" / "22 oct"
      let k = i + 1
      const libre = (j: number): boolean => j < toks.length && !usados.has(j)
      if (libre(k) && toks[k].n === 'de') k++
      if (libre(k) && esMes(toks[k].n)) {
        const mes = MESES[toks[k].n]
        let fin = k
        let y: number | null = null
        let j = k + 1
        if (libre(j) && toks[j].n === 'de') j++
        if (libre(j) && /^\d{4}$/.test(toks[j].n)) { y = Number(toks[j].n); fin = j }
        for (let x = i; x <= fin; x++) usados.add(x)
        consumirPrevios(toks, usados, i)
        return { d: Number(t), m: mes, y }
      }
    }
  }
  return null
}

function buscarRelativa(toks: Tok[], usados: Set<number>): number | null {
  for (let i = 0; i < toks.length; i++) {
    if (usados.has(i)) continue
    const t = toks[i].n
    // "por la mañana", "de la mañana": no es la fecha.
    if ((t === 'manana') && i > 0 && toks[i - 1].n === 'la') continue
    if (t === 'hoy') { usados.add(i); consumirPrevios(toks, usados, i); return 0 }
    if (t === 'manana') { usados.add(i); consumirPrevios(toks, usados, i); return 1 }
    if (t === 'pasado' && i + 1 < toks.length && !usados.has(i + 1) && toks[i + 1].n === 'manana') {
      usados.add(i); usados.add(i + 1); consumirPrevios(toks, usados, i)
      return 2
    }
  }
  return null
}

function buscarDiaSemana(
  toks: Tok[],
  usados: Set<number>,
): { dow: number; estricto: boolean; texto: string } | null {
  for (let i = 0; i < toks.length; i++) {
    if (usados.has(i) || !esDiaSemana(toks[i].n)) continue
    usados.add(i)
    let estricto = consumirPrevios(toks, usados, i)
    // "lunes que viene", "lunes próximo"
    if (i + 2 < toks.length && !usados.has(i + 1) && !usados.has(i + 2) &&
      toks[i + 1].n === 'que' && toks[i + 2].n === 'viene') {
      usados.add(i + 1); usados.add(i + 2); estricto = true
    } else if (i + 1 < toks.length && !usados.has(i + 1) && MODIFICADOR_PROXIMO.has(toks[i + 1].n)) {
      usados.add(i + 1); estricto = true
    }
    return { dow: DIAS_SEMANA[toks[i].n], estricto, texto: NOMBRES_DIA[DIAS_SEMANA[toks[i].n]] }
  }
  return null
}

interface CandidatoDia {
  i: number
  v: number
  /** precedido de el/dia/del/para/hasta */
  prefijado: boolean
}

/** El token siguiente convierte al numero en una cantidad ("3 ejercicios", "2 parciales", "3 dias"). */
function esUnidad(n: string | undefined): boolean {
  if (n === undefined) return false
  if (UNIDADES.has(n)) return true
  if (esMes(n) || esDiaSemana(n) || NO_UNIDAD_PLURAL.has(n)) return false
  return /^[a-z]{3,}s$/.test(n)
}

/** Numeros sueltos 1-31 que podrian ser un dia del mes. */
function candidatosDia(toks: Tok[], usados: Set<number>): CandidatoDia[] {
  const r: CandidatoDia[] = []
  for (let i = 0; i < toks.length; i++) {
    if (usados.has(i) || !esNum(toks[i].n)) continue
    const v = Number(toks[i].n)
    if (v < 1 || v > 31) continue
    if (i > 0 && PREFIJO_NUMERO_TITULO.has(toks[i - 1].n)) continue
    if (esUnidad(toks[i + 1]?.n)) continue
    const prev = i > 0 && !usados.has(i - 1) ? toks[i - 1].n : ''
    r.push({ i, v, prefijado: PREFIJO_DIA.has(prev) })
  }
  return r
}

/**
 * Elige el dia del mes: prioridad al numero tras el/dia/del/para/hasta; si no hay,
 * un numero suelto solo se acepta si es el unico candidato.
 */
function buscarDiaSuelto(toks: Tok[], usados: Set<number>, haySemana: boolean): number | null {
  const cands = candidatosDia(toks, usados)
  const pref = cands.filter((c) => c.prefijado)
  if (pref.length > 1) throw new ErrorParseo(MSG_VARIAS)
  let elegido: CandidatoDia | undefined = pref[0]
  if (!elegido && cands.length === 1) elegido = cands[0]
  if (!elegido && cands.length > 1 && !haySemana) throw new ErrorParseo(MSG_VARIAS)
  if (!elegido) return null
  usados.add(elegido.i)
  consumirPrevios(toks, usados, elegido.i)
  return elegido.v
}

function resolverExplicita(e: Explicita, hoy: Ymd, avisos: string[]): Ymd {
  if (e.m < 1 || e.m > 12 || e.d < 1 || e.d > MAX_DIAS_MES[e.m - 1]) {
    throw new ErrorParseo(`La fecha ${e.d}/${e.m} no existe.`)
  }
  if (e.y !== null) {
    if (e.y > hoy.y + 2) {
      throw new ErrorParseo(`El año ${e.y} queda demasiado lejos (máximo ${hoy.y + 2}).`)
    }
    const f = { y: e.y, m: e.m, d: e.d }
    if (!valida(f)) throw new ErrorParseo(`La fecha ${e.d}/${e.m}/${e.y} no existe.`)
    return f
  }
  for (let y = hoy.y; y <= hoy.y + 8; y++) {
    const f = { y, m: e.m, d: e.d }
    if (valida(f) && dia(f) >= dia(hoy)) {
      if (y > hoy.y) avisos.push(`El ${pad(e.d)}/${pad(e.m)} ya pasó este año, así que he usado ${y}.`)
      return f
    }
  }
  throw new ErrorParseo(`No he podido resolver la fecha ${e.d}/${e.m}.`)
}

function resolverDiaSuelto(d: number, hoy: Ymd, avisos: string[]): Ymd {
  for (let k = 0; k <= 13; k++) {
    const idx = hoy.m - 1 + k
    const f = { y: hoy.y + Math.floor(idx / 12), m: (idx % 12) + 1, d }
    if (valida(f) && dia(f) >= dia(hoy)) {
      if (k > 0) avisos.push(`El día ${d} ya pasó este mes, así que he usado ${legible(f)}.`)
      return f
    }
  }
  throw new ErrorParseo(`No he podido resolver el día ${d}.`)
}

function resolverFecha(
  toks: Tok[],
  usados: Set<number>,
  hoy: Ymd,
  avisos: string[],
  msgSinFecha = `No he encontrado la fecha. ${AYUDA}`,
): Ymd {
  // Dos dias de la semana distintos ("jueves 22 y viernes 23").
  const dows = new Set<number>()
  for (let i = 0; i < toks.length; i++) {
    if (!usados.has(i) && esDiaSemana(toks[i].n)) dows.add(DIAS_SEMANA[toks[i].n])
  }
  if (dows.size > 1) throw new ErrorParseo(MSG_VARIAS)

  const rel = buscarRelativa(toks, usados)
  const exp = buscarExplicita(toks, usados)
  if (rel !== null && exp !== null) throw new ErrorParseo(MSG_VARIAS)
  if (exp !== null && buscarExplicita(toks, new Set(usados)) !== null) throw new ErrorParseo(MSG_VARIAS)
  let suelto: number | null = null
  if (rel !== null) {
    // "examen mañana 22": cualquier numero candidato es una segunda fecha.
    if (candidatosDia(toks, usados).length > 0) throw new ErrorParseo(MSG_VARIAS)
  } else if (exp !== null) {
    if (candidatosDia(toks, usados).some((c) => c.prefijado)) throw new ErrorParseo(MSG_VARIAS)
  } else {
    suelto = buscarDiaSuelto(toks, usados, dows.size > 0)
  }
  const sem = buscarDiaSemana(toks, usados)

  let fecha: Ymd
  if (rel !== null) fecha = desdeDia(dia(hoy) + rel)
  else if (exp !== null) fecha = resolverExplicita(exp, hoy, avisos)
  else if (suelto !== null) fecha = resolverDiaSuelto(suelto, hoy, avisos)
  else if (sem !== null) {
    const hoyDow = diaSemana(hoy)
    let delta = (sem.dow - hoyDow + 7) % 7
    if (delta === 0 && sem.estricto) delta = 7
    fecha = desdeDia(dia(hoy) + delta)
  } else {
    throw new ErrorParseo(msgSinFecha)
  }

  if (sem !== null && diaSemana(fecha) !== sem.dow) {
    throw new ErrorParseo(
      `No coinciden el día y la fecha: el ${legible(fecha)} es ${NOMBRES_DIA[diaSemana(fecha)]}, no ${sem.texto}. ` +
        'Revisa el mensaje y vuelve a enviarlo.',
    )
  }
  if (dia(fecha) < dia(hoy)) {
    throw new ErrorParseo(`La fecha ${legible(fecha)} ya ha pasado.`)
  }
  return fecha
}

// ------------------------------------------- fechas relativas no soportadas

const UNIDAD_RELATIVA = new Set(['dia', 'dias', 'semana', 'semanas', 'mes', 'meses', 'hora', 'horas'])
const CANTIDAD_PALABRA = new Set(['un', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete'])

/** "en 3 dias", "dentro de 2 semanas", "en una semana", "la semana que viene". */
function hayRelativaNoSoportada(toks: Tok[]): boolean {
  for (let i = 0; i < toks.length; i++) {
    const n = toks[i].n
    if (n === 'semana' && (
      (i + 2 < toks.length && toks[i + 1].n === 'que' && toks[i + 2].n === 'viene') ||
      (i > 0 && (toks[i - 1].n === 'proxima' || toks[i - 1].n === 'siguiente'))
    )) return true
    if (!UNIDAD_RELATIVA.has(n) || i < 2) continue
    const cant = toks[i - 1].n
    if (!esNum(cant) && !CANTIDAD_PALABRA.has(cant)) continue
    const pre = toks[i - 2].n
    if (pre === 'en' || (pre === 'de' && i >= 3 && toks[i - 3].n === 'dentro')) return true
  }
  return false
}

// ---------------------------------------------------------------- titulo

function componerTitulo(toks: Tok[], usados: Set<number>): string {
  let resto = toks.filter((_, i) => !usados.has(i))
  while (resto.length > 0 && BORDE_TITULO.has(resto[0].n)) resto = resto.slice(1)
  while (resto.length > 0 && BORDE_TITULO.has(resto[resto.length - 1].n)) resto = resto.slice(0, -1)
  let titulo = resto.map((t) => t.orig).join(' ')
  titulo = titulo.replace(/\p{C}/gu, '').replace(/^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g, '').trim()
  return titulo.charAt(0).toUpperCase() + titulo.slice(1)
}

// ---------------------------------------------------------------- tipo

const PALABRAS_TEORICO = new Set(['examen', 'parcial', 'prueba', 'test', 'control'])
const PALABRAS_PRESENTACION = new Set(['presentacion', 'exposicion', 'expo', 'defensa'])
const PALABRAS_ESPECIAL = new Set(['especial', 'excursion', 'charla', 'evento', 'salida', 'visita'])
const PALABRAS_TRABAJO = new Set(['trabajo', 'proyecto'])
// Palabras que solo indican el tipo y se retiran del titulo.
const PALABRAS_QUITAR = new Set(['entrega', 'examen', 'presentacion', 'especial'])

/**
 * Deduce el tipo a partir de las palabras libres (no usadas por fecha/hora/materia)
 * y devuelve los indices que hay que retirar del titulo.
 */
function detectarTipo(toks: Tok[], usados: Set<number>): { tipo: TipoEvento; quitar: Set<number> } {
  const libre = (i: number): boolean => i >= 0 && i < toks.length && !usados.has(i)
  const quitar = new Set<number>()
  let practico = false
  let teorico = false
  let presentacion = false
  let especial = false
  let trabajo = false

  for (let i = 0; i < toks.length; i++) {
    if (!libre(i)) continue
    const n = toks[i].n
    if (PALABRAS_QUITAR.has(n)) quitar.add(i)
    if (PALABRAS_TEORICO.has(n)) teorico = true
    else if (PALABRAS_PRESENTACION.has(n)) presentacion = true
    else if (PALABRAS_ESPECIAL.has(n)) especial = true
    else if (PALABRAS_TRABAJO.has(n)) trabajo = true

    if (n === 'examen' || n === 'prueba') {
      // "examen practico", "examen de practicas", "prueba practica", "practico examen"
      let j = i + 1
      let conDe = false
      if (libre(j) && toks[j].n === 'de') { j++; conDe = true }
      const t = libre(j) ? toks[j].n : ''
      if (t === 'practico' || t === 'practicos' || t === 'practicas' || (t === 'practica' && n === 'prueba' && !conDe)) {
        practico = true
        if (n === 'examen') for (let k = i + 1; k <= j; k++) quitar.add(k)
      } else if (n === 'examen' && !conDe && (t === 'teorico' || t === 'teoricos')) {
        quitar.add(j)
      }
      if (libre(i - 1) && (toks[i - 1].n === 'practico' || toks[i - 1].n === 'practicos')) {
        practico = true
        if (n === 'examen') quitar.add(i - 1)
      } else if (n === 'examen' && libre(i - 1) && toks[i - 1].n === 'teorico') {
        quitar.add(i - 1)
      }
    }
  }

  const tipo: TipoEvento = practico
    ? 'examen_practico'
    : teorico
    ? 'examen_teorico'
    : presentacion
    ? 'presentacion'
    : especial
    ? 'especial'
    : trabajo
    ? 'trabajo'
    : 'actividad'
  return { tipo, quitar }
}

// ---------------------------------------------------------------- API

/**
 * Interpreta un mensaje como evento de calendario.
 * @param texto  Mensaje del usuario, p. ej. "examen jueves 22 AED".
 * @param ahora  Instante actual (inyectado para poder testear); el "hoy" se calcula en Europe/Madrid.
 */
export function parseEvento(texto: string, ahora: Date): ParseResult {
  try {
    if (typeof texto !== 'string' || texto.trim() === '') {
      return { ok: false, error: `El mensaje está vacío. ${AYUDA}` }
    }
    if (texto.length > TEXTO_MAX) {
      return { ok: false, error: `El mensaje es demasiado largo (máximo ${TEXTO_MAX} caracteres).` }
    }
    if (!(ahora instanceof Date) || Number.isNaN(ahora.getTime())) {
      return { ok: false, error: 'No se pudo determinar la fecha actual.' }
    }

    const { hoy, minutos } = ahoraMadrid(ahora)
    const toks = tokenizar(texto)
    const usados = new Set<number>()
    const avisos: string[] = []

    if (hayRelativaNoSoportada(toks)) return { ok: false, error: MSG_RELATIVA }

    // 1) materia (frases completas, antes de interpretar numeros)
    const coin = buscarMateriaEnPalabras(toks.map((t) => t.n))
    const idxMateria = new Set<number>()
    if (coin) {
      for (let i = coin.inicio; i < coin.fin; i++) { usados.add(i); idxMateria.add(i) }
      const otra = buscarMateriaEnPalabras(toks.map((t) => t.n), usados)
      if (otra) avisos.push(`He encontrado varias materias; he usado «${coin.materia.nombreCorto}».`)
    }

    // 2) hora, 3) fecha
    const hm = extraerHora(toks, usados)
    const fecha = resolverFecha(toks, usados, hoy, avisos)
    const hora = hm ? `${pad(hm.h)}:${pad(hm.min)}` : null
    if (hm?.rango) avisos.push(`Solo se guarda la hora de inicio (${hora}); he ignorado la hora de fin.`)
    if (hm && dia(fecha) === dia(hoy) && hm.h * 60 + hm.min < minutos) {
      avisos.push('La hora indicada ya ha pasado hoy.')
    }

    // 4) tipo, titulo y materia
    const { tipo, quitar } = detectarTipo(toks, usados)
    // Con codigo (AED) se quita del titulo; con nombre largo se queda tal cual se escribio.
    const esCodigo = coin !== null && coin.fin - coin.inicio === 1 &&
      toks[coin.inicio].n === normalizarPalabra(coin.materia.codigo)
    const usadosTitulo = new Set([...usados, ...quitar])
    if (coin && !esCodigo) for (const i of idxMateria) usadosTitulo.delete(i)
    const materia = coin ? coin.materia.nombreCorto : null
    let titulo = componerTitulo(toks, usadosTitulo)
    if (titulo === '') titulo = materia ?? etiquetaTipo(tipo)
    if (titulo.length > TITULO_MAX) {
      return { ok: false, error: `El título es demasiado largo (${titulo.length} caracteres, máximo ${TITULO_MAX}).` }
    }

    return { ok: true, titulo, fecha: iso(fecha), hora, materia, tipo, avisos }
  } catch (e) {
    if (e instanceof ErrorParseo) return { ok: false, error: e.message }
    throw e
  }
}

export type ParseFechaHoraResult =
  | { ok: true; fecha: string; hora: string | null; avisos: string[] }
  | { ok: false; error: string }

const AYUDA_FECHA = 'Ejemplos: «viernes», «22/10», «el 22 de octubre», «mañana a las 10» o «jueves 23:59».'

/**
 * Interpreta solo la fecha (y hora opcional) de un mensaje. Ignora el texto sobrante.
 * @param texto  p. ej. "mañana a las 10", "22/10", "el 22".
 * @param ahora  Instante actual (inyectado); el "hoy" se calcula en Europe/Madrid.
 */
export function parseFechaHora(texto: string, ahora: Date): ParseFechaHoraResult {
  const sinFecha = `No he entendido la fecha. ${AYUDA_FECHA}`
  try {
    if (typeof texto !== 'string' || texto.trim() === '') return { ok: false, error: sinFecha }
    if (texto.length > TEXTO_MAX) {
      return { ok: false, error: `El mensaje es demasiado largo (máximo ${TEXTO_MAX} caracteres).` }
    }
    if (!(ahora instanceof Date) || Number.isNaN(ahora.getTime())) {
      return { ok: false, error: 'No se pudo determinar la fecha actual.' }
    }
    const { hoy, minutos } = ahoraMadrid(ahora)
    const toks = tokenizar(texto)
    const usados = new Set<number>()
    const avisos: string[] = []
    if (hayRelativaNoSoportada(toks)) return { ok: false, error: MSG_RELATIVA }

    const hm = extraerHora(toks, usados)
    const fecha = resolverFecha(toks, usados, hoy, avisos, sinFecha)
    const hora = hm ? `${pad(hm.h)}:${pad(hm.min)}` : null
    if (hm?.rango) avisos.push(`Solo se guarda la hora de inicio (${hora}); he ignorado la hora de fin.`)
    if (hm && dia(fecha) === dia(hoy) && hm.h * 60 + hm.min < minutos) {
      avisos.push('La hora indicada ya ha pasado hoy.')
    }
    return { ok: true, fecha: iso(fecha), hora, avisos }
  } catch (e) {
    if (e instanceof ErrorParseo) return { ok: false, error: e.message }
    throw e
  }
}
