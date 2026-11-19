import { MATERIAS, type EventoCalendario, type TipoEvento } from '@topcode/shared'

/** Un evento leído de un .ics (exportación del calendario de Moodle / Campus). */
export interface EventoIcs {
  uid: string
  titulo: string
  descripcion: string | null
  fecha: string // 'YYYY-MM-DD' en hora local
  hora: string | null // 'HH:MM' en hora local; null si es de día completo
  curso: string | null // CATEGORIES de Moodle (identifica el curso)
}

/** Deshace el plegado de líneas (RFC 5545): las que empiezan por espacio o tabulador continúan la anterior. */
function desplegar(texto: string): string[] {
  const out: string[] = []
  for (const linea of texto.split(/\r?\n/)) {
    if ((linea.startsWith(' ') || linea.startsWith('\t')) && out.length) out[out.length - 1] += linea.slice(1)
    else out.push(linea)
  }
  return out
}

const desescapar = (v: string) =>
  v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim()

const dos = (n: number) => String(n).padStart(2, '0')

/** DTSTART → fecha y hora locales. Admite UTC (…Z), hora flotante y VALUE=DATE. */
function leerFecha(valor: string, params: string): { fecha: string; hora: string | null } | null {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, , z] = m
  if (!h || params.includes('VALUE=DATE')) return { fecha: `${y}-${mo}-${d}`, hora: null }
  const fechaJs = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))
    : new Date(+y, +mo - 1, +d, +h, +mi)
  return {
    fecha: `${fechaJs.getFullYear()}-${dos(fechaJs.getMonth() + 1)}-${dos(fechaJs.getDate())}`,
    hora: `${dos(fechaJs.getHours())}:${dos(fechaJs.getMinutes())}`,
  }
}

export function leerIcs(texto: string): EventoIcs[] {
  const eventos: EventoIcs[] = []
  let actual: Record<string, { valor: string; params: string }> | null = null

  for (const linea of desplegar(texto)) {
    if (linea === 'BEGIN:VEVENT') { actual = {}; continue }
    if (linea === 'END:VEVENT') {
      if (actual?.SUMMARY && actual.DTSTART) {
        const f = leerFecha(actual.DTSTART.valor, actual.DTSTART.params)
        if (f) {
          const titulo = desescapar(actual.SUMMARY.valor)
          eventos.push({
            uid: actual.UID?.valor.trim() || `${titulo}@${f.fecha}`,
            titulo,
            descripcion: actual.DESCRIPTION ? desescapar(actual.DESCRIPTION.valor) || null : null,
            ...f,
            curso: actual.CATEGORIES?.valor.trim() || null,
          })
        }
      }
      actual = null
      continue
    }
    if (!actual) continue
    const dosPuntos = linea.indexOf(':')
    if (dosPuntos < 0) continue
    const [nombre, ...params] = linea.slice(0, dosPuntos).split(';')
    actual[nombre.toUpperCase()] = { valor: linea.slice(dosPuntos + 1), params: params.join(';').toUpperCase() }
  }
  return eventos
}

// ─── Adaptar al calendario de TopCode ────────────────────────────────────────

/** Curso de Moodle (final de CATEGORIES) → materia. Lo no reconocido queda sin materia. */
const MATERIA_POR_CURSO: Record<string, string> = {
  '0103': 'Prog. multimedia',
  '0303': 'Sist. gestión empresarial',
  '0311': 'Despliegue apps web',
  '0731': 'Sostenibilidad',
  '0855': 'Acceso a datos',
  '0856': 'Prog. servicios y procesos',
}

export function materiaDeCurso(curso: string | null): string | null {
  const sufijo = curso?.split('-').pop()
  return (sufijo && MATERIA_POR_CURSO[sufijo]) || null
}

export const MATERIAS_CORTAS = MATERIAS.map(m => m.nombreCorto)

/** «Vencimiento de X» es una entrega (actividad o trabajo); el resto, evento especial. */
export function adaptarTitulo(titulo: string): { titulo: string; tipo: TipoEvento } {
  const m = titulo.match(/^vencimiento de\s+(.+)$/i)
  if (!m) return { titulo, tipo: 'especial' }
  return { titulo: m[1], tipo: /proyecto/i.test(m[1]) ? 'trabajo' : 'actividad' }
}

// ─── Detección de repetidos ──────────────────────────────────────────────────

const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'a', 'con', 'por', 'para', 'un', 'una', 'al', 'vencimiento'])

/** Palabras significativas del título (sin tildes, sin «UT2», «UTNº2», artículos…). */
function palabras(titulo: string): Set<string> {
  return new Set(
    titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(p => p && !VACIAS.has(p) && !/^utn?\d*$/.test(p) && !/^n\d+$/.test(p)),
  )
}

/** Mismo día y títulos casi iguales («UT2 - Mapa ODS…» ≈ «UTNº2 - Mapa ODS…»). */
export function esRepetido(nuevo: { titulo: string; fecha: string; uid: string }, existentes: EventoCalendario[]): EventoCalendario | undefined {
  const a = palabras(nuevo.titulo)
  return existentes.find(ev => {
    if (ev.uid_externo && ev.uid_externo === nuevo.uid) return true
    if (ev.fecha !== nuevo.fecha) return false
    const b = palabras(ev.titulo)
    if (a.size === 0 || b.size === 0) return false
    let comunes = 0
    for (const p of a) if (b.has(p)) comunes++
    return comunes / Math.min(a.size, b.size) >= 0.75
  })
}
