import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ExplorarView, { type DocItem, type ExploreData, type ForoItem, type PromptItem } from '../components/explorar/ExplorarView'

const EMPTY_DATA: ExploreData = { docs: [], prompts: [], dudas: [] }

export default function Explorar() {
  const navigate = useNavigate()
  const [data, setData] = useState<ExploreData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(false)
      const [docs, prompts, dudas] = await Promise.all([
        supabase.from('docs_paginas').select('id, coleccion_id, titulo, updated_at, updated_by_nombre, docs_colecciones(titulo)').order('updated_at', { ascending: false }).limit(3),
        supabase.from('prompts').select('id, titulo, descripcion, contenido, categoria, autor, created_at').order('created_at', { ascending: false }).limit(4),
        supabase.from('foro_posts').select('id, titulo, cuerpo, autor, resuelto, created_at, foro_respuestas(id)').eq('resuelto', false).order('created_at', { ascending: false }).limit(4),
      ])

      if (cancelled) return
      if (docs.error || prompts.error || dudas.error) {
        setError(true)
      } else {
        setData({
          docs: (docs.data ?? []) as unknown as DocItem[],
          prompts: (prompts.data ?? []) as PromptItem[],
          dudas: (dudas.data ?? []) as ForoItem[],
        })
      }
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  return (
    <ExplorarView
      data={data}
      loading={loading}
      error={error}
      onBuscar={q => navigate(`/apuntes?q=${encodeURIComponent(q)}`)}
      onIr={navigate}
    />
  )
}
