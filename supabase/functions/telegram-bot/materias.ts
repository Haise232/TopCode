// IMPORTANTE: copia de packages/shared/src/constants/materias.ts.
// Deno no resuelve `@topcode/shared`, asi que la lista se duplica aqui.
// MANTENER SINCRONIZADA con ese archivo: si cambia alli, cambiarla tambien aqui.
// El valor que se guarda en `eventos.materia` es `nombreCorto` (lo espera Calendar.tsx).

export interface Materia {
  codigo: string
  nombre: string
  nombreCorto: string
}

export const MATERIAS: Materia[] = [
  { codigo: 'AED', nombre: 'Acceso a datos',                                              nombreCorto: 'Acceso a datos' },
  { codigo: 'DAD', nombre: 'Desarrollo de interfaces',                                    nombreCorto: 'Desarrollo interfaces' },
  { codigo: 'DPL', nombre: 'Despliegue de aplicaciones web',                              nombreCorto: 'Despliegue apps web' },
  { codigo: 'IPW', nombre: 'Itinerario personal para la empleabilidad II',                nombreCorto: 'Itinerario empleab. II' },
  { codigo: 'PGL', nombre: 'Programación multimedia y dispositivos móviles',              nombreCorto: 'Prog. multimedia' },
  { codigo: 'PGV', nombre: 'Programación de servicios y procesos',                        nombreCorto: 'Prog. servicios y procesos' },
  { codigo: 'PL9', nombre: 'Proyecto intermodular',                                       nombreCorto: 'Proyecto intermodular' },
  { codigo: 'SOJ', nombre: 'Sostenibilidad aplicada al sistema productivo',               nombreCorto: 'Sostenibilidad' },
  { codigo: 'SSG', nombre: 'Sistemas de gestión empresarial',                             nombreCorto: 'Sist. gestión empresarial' },
]

/** Minusculas y sin tildes (conserva la longitud de cada caracter). */
export function normalizar(texto: string): string {
  let salida = ''
  for (const c of texto) {
    const n = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    salida += n.length === 1 ? n : c.toLowerCase()
  }
  return salida
}

/** Quita signos de puntuacion al principio y al final de una palabra. */
function recortarBordes(palabra: string): string {
  return palabra.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

/** Normaliza una palabra suelta: sin signos en los bordes, minusculas, sin tildes. */
export function normalizarPalabra(palabra: string): string {
  return normalizar(recortarBordes(palabra))
}

/** Divide un texto en palabras normalizadas (descarta las vacias). */
export function palabrasNormalizadas(texto: string): string[] {
  return texto.split(/\s+/).map(normalizarPalabra).filter((p) => p.length > 0)
}

interface Candidato {
  palabras: string[]
  materia: Materia
}

let candidatos: Candidato[] | null = null

function obtenerCandidatos(): Candidato[] {
  if (candidatos) return candidatos
  const lista: Candidato[] = []
  for (const materia of MATERIAS) {
    for (const texto of [materia.codigo, materia.nombre, materia.nombreCorto]) {
      const palabras = palabrasNormalizadas(texto)
      if (palabras.length > 0) lista.push({ palabras, materia })
    }
  }
  // Primero las coincidencias mas largas, para que gane la frase completa.
  lista.sort((a, b) => b.palabras.length - a.palabras.length)
  candidatos = lista
  return lista
}

export interface CoincidenciaMateria {
  materia: Materia
  /** Indice (inclusive) de la primera palabra coincidente. */
  inicio: number
  /** Indice (exclusive) tras la ultima palabra coincidente. */
  fin: number
}

/**
 * Busca la primera materia dentro de una lista de palabras ya normalizadas
 * (ver `normalizarPalabra`). Coincide por codigo, nombre o nombreCorto.
 * `ignorar` permite saltar posiciones ya consumidas.
 */
export function buscarMateriaEnPalabras(
  palabras: readonly string[],
  ignorar?: ReadonlySet<number>,
): CoincidenciaMateria | null {
  const cands = obtenerCandidatos()
  for (let i = 0; i < palabras.length; i++) {
    if (ignorar?.has(i)) continue
    for (const c of cands) {
      const n = c.palabras.length
      if (i + n > palabras.length) continue
      let ok = true
      for (let k = 0; k < n; k++) {
        if (ignorar?.has(i + k) || palabras[i + k] !== c.palabras[k]) {
          ok = false
          break
        }
      }
      if (ok) return { materia: c.materia, inicio: i, fin: i + n }
    }
  }
  return null
}

/**
 * Resuelve un texto completo (p. ej. "aed", "Acceso a Datos", "Prog. multimedia")
 * a una materia, ignorando mayusculas y tildes. Devuelve null si no coincide exactamente.
 */
export function resolverMateria(texto: string): Materia | null {
  const palabras = palabrasNormalizadas(texto)
  if (palabras.length === 0) return null
  const m = buscarMateriaEnPalabras(palabras)
  return m && m.inicio === 0 && m.fin === palabras.length ? m.materia : null
}

/** Valor a guardar en `eventos.materia` para un texto dado (nombreCorto) o null. */
export function nombreCortoDeMateria(texto: string): string | null {
  return resolverMateria(texto)?.nombreCorto ?? null
}
