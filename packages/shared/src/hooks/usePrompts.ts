import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '../lib/supabase'
import { Prompt } from '../lib/types'

export type PromptInput = Pick<Prompt, 'titulo' | 'contenido' | 'descripcion' | 'categoria' | 'modelo'>

interface UsePromptsReturn {
  prompts: Prompt[]
  loading: boolean
  error: string | null
  addPrompt: (data: PromptInput & Pick<Prompt, 'usuario_id' | 'autor'>) => Promise<{ error: string | null }>
  updatePrompt: (id: string, data: PromptInput) => Promise<{ error: string | null }>
  deletePrompt: (id: string) => Promise<{ error: string | null }>
  refresh: () => void
}

export function usePrompts(): UsePromptsReturn {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSupabase()
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) setError(e.message)
        else { setError(null); setPrompts((data ?? []) as Prompt[]) }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [tick])

  const addPrompt = useCallback(async (data: PromptInput & Pick<Prompt, 'usuario_id' | 'autor'>) => {
    const { error: e } = await getSupabase().from('prompts').insert(data)
    if (!e) setTick(t => t + 1)
    return { error: e?.message ?? null }
  }, [])

  const updatePrompt = useCallback(async (id: string, data: PromptInput) => {
    const { error: e } = await getSupabase()
      .from('prompts')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!e) setTick(t => t + 1)
    return { error: e?.message ?? null }
  }, [])

  const deletePrompt = useCallback(async (id: string) => {
    const { error: e } = await getSupabase().from('prompts').delete().eq('id', id)
    if (!e) setPrompts(prev => prev.filter(p => p.id !== id))
    return { error: e?.message ?? null }
  }, [])

  return { prompts, loading, error, addPrompt, updatePrompt, deletePrompt, refresh: () => setTick(t => t + 1) }
}
