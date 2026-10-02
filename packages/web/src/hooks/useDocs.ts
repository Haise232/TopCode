import { useCallback, useEffect, useState } from 'react'
import { MATERIAS } from '@topcode/shared'
import { supabase } from '../lib/supabase'

export interface DocColeccion {
  id: string
  titulo: string
  descripcion: string | null
  materia: string
  created_by: string | null
  autor: string
  created_at: string
  updated_at: string
  paginas?: number
}

export interface DocPaginaResumen {
  id: string
  coleccion_id: string
  titulo: string
  orden: number
  updated_at: string
}

export interface DocPagina extends DocPaginaResumen {
  contenido: string
  created_by: string | null
  autor: string
  updated_by_nombre: string
  created_at: string
}

export interface DocRevision {
  id: string
  pagina_id: string
  titulo: string
  contenido: string
  editado_por_nombre: string
  created_at: string
}

export interface DocBusqueda {
  id: string
  coleccion_id: string
  titulo: string
  contenido: string
  docs_colecciones: { titulo: string } | null
}

export type ColeccionInput = Pick<DocColeccion, 'titulo' | 'descripcion' | 'materia'>

export const SELECT_CLASS =
  'w-full bg-input border border-border rounded-xl px-3 py-3 text-sm text-text-primary outline-none focus:border-primary/50'

export function materiaLabel(codigo: string) {
  if (codigo === 'general') return 'General'
  return MATERIAS.find(m => m.codigo === codigo)?.nombreCorto ?? codigo
}

const RESUMEN_COLS = 'id, coleccion_id, titulo, orden, updated_at'

export function sortPaginas<T extends { orden: number; titulo: string }>(paginas: T[]): T[] {
  return [...paginas].sort((a, b) =>
    a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es', { numeric: true, sensitivity: 'base' })
  )
}

// ── Colecciones ───────────────────────────────────────────────────────────────

export function useDocColecciones() {
  const [colecciones, setColecciones] = useState<DocColeccion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('docs_colecciones')
      .select('*, docs_paginas(count)')
      .order('updated_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) setError(e.message)
        else {
          setError(null)
          setColecciones((data ?? []).map(({ docs_paginas, ...c }) => ({
            ...(c as DocColeccion),
            paginas: (docs_paginas as { count: number }[] | null)?.[0]?.count ?? 0,
          })))
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [tick])

  const refresh = useCallback(() => setTick(t => t + 1), [])
  return { colecciones, loading, error, refresh }
}

export function useDocColeccion(id: string | undefined) {
  const [coleccion, setColeccion] = useState<DocColeccion | null>(null)
  const [paginas, setPaginas] = useState<DocPaginaResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('docs_colecciones').select('*').eq('id', id).maybeSingle(),
      supabase.from('docs_paginas').select(RESUMEN_COLS).eq('coleccion_id', id),
    ]).then(([col, pags]) => {
      if (cancelled) return
      const e = col.error ?? pags.error
      if (e) setError(e.message)
      else {
        setError(null)
        setColeccion(col.data as DocColeccion | null)
        setPaginas(sortPaginas((pags.data ?? []) as DocPaginaResumen[]))
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [id, tick])

  const refresh = useCallback(() => setTick(t => t + 1), [])
  return { coleccion, paginas, loading, error, refresh }
}

export async function createColeccion(input: ColeccionInput) {
  const { data, error } = await supabase
    .from('docs_colecciones')
    .insert(input)
    .select('id')
    .single()
  return { id: (data?.id as string | undefined) ?? null, error: error?.message ?? null }
}

export async function updateColeccion(id: string, input: ColeccionInput) {
  const { error } = await supabase.from('docs_colecciones').update(input).eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteColeccion(id: string) {
  const { error } = await supabase.from('docs_colecciones').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── Páginas ───────────────────────────────────────────────────────────────────

export async function fetchPagina(id: string) {
  const { data, error } = await supabase.from('docs_paginas').select('*').eq('id', id).maybeSingle()
  return { pagina: data as DocPagina | null, error: error?.message ?? null }
}

export async function createPagina(coleccionId: string, titulo: string, contenido: string, orden: number) {
  const { data, error } = await supabase
    .from('docs_paginas')
    .insert({ coleccion_id: coleccionId, titulo, contenido, orden })
    .select('id')
    .single()
  return { id: (data?.id as string | undefined) ?? null, error: traducirError(error?.message) }
}

/**
 * Guarda una página solo si nadie la ha modificado desde que se abrió
 * (compara updated_at). Si hubo cambios de otra persona devuelve conflict.
 */
export async function savePagina(id: string, cambios: { titulo: string; contenido: string }, updatedAtEsperado: string) {
  const { data, error } = await supabase
    .from('docs_paginas')
    .update(cambios)
    .eq('id', id)
    .eq('updated_at', updatedAtEsperado)
    .select('*')
  if (error) return { pagina: null, conflict: false, error: traducirError(error.message) }
  const pagina = (data?.[0] as DocPagina | undefined) ?? null
  return { pagina, conflict: !pagina, error: null }
}

export async function deletePagina(id: string) {
  const { error } = await supabase.from('docs_paginas').delete().eq('id', id)
  return { error: error?.message ?? null }
}

/** Sube varios .md a una colección. Si ya existe una página con el mismo título se sobrescribe. */
export async function importarPaginas(coleccionId: string, archivos: { titulo: string; contenido: string; orden: number }[]) {
  const filas = archivos.map(a => ({ coleccion_id: coleccionId, ...a }))
  for (let i = 0; i < filas.length; i += 50) {
    const { error } = await supabase
      .from('docs_paginas')
      .upsert(filas.slice(i, i + 50), { onConflict: 'coleccion_id,titulo' })
    if (error) return { error: traducirError(error.message) }
  }
  return { error: null }
}

export async function fetchRevisiones(paginaId: string) {
  const { data, error } = await supabase
    .from('docs_revisiones')
    .select('id, pagina_id, titulo, contenido, editado_por_nombre, created_at')
    .eq('pagina_id', paginaId)
    .order('created_at', { ascending: false })
    .limit(50)
  return { revisiones: (data ?? []) as DocRevision[], error: error?.message ?? null }
}

function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, c => `\\${c}`)
}

export async function buscarDocs(q: string) {
  const pattern = `%${escapeLike(q)}%`
  const cols = 'id, coleccion_id, titulo, contenido, docs_colecciones(titulo)'
  const [porTitulo, porContenido] = await Promise.all([
    supabase.from('docs_paginas').select(cols).ilike('titulo', pattern).limit(20),
    supabase.from('docs_paginas').select(cols).ilike('contenido', pattern).limit(20),
  ])
  const vistos = new Set<string>()
  const resultados: DocBusqueda[] = []
  for (const row of [...(porTitulo.data ?? []), ...(porContenido.data ?? [])] as unknown as DocBusqueda[]) {
    if (vistos.has(row.id)) continue
    vistos.add(row.id)
    resultados.push(row)
  }
  return { resultados, error: porTitulo.error?.message ?? porContenido.error?.message ?? null }
}

function traducirError(message: string | undefined): string | null {
  if (!message) return null
  if (message.includes('duplicate key') || message.includes('docs_paginas_coleccion_id_titulo_key')) {
    return 'Ya existe una página con ese título en esta colección.'
  }
  if (message.includes('check constraint')) return 'El título o el contenido superan el tamaño permitido.'
  return message
}
