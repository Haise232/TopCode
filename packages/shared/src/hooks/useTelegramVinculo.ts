import { useState, useCallback, useRef, useEffect } from 'react'
import { getSupabase } from '../lib/supabase'

export interface CodigoTelegram {
  codigo: string
  /** Instante de caducidad (ISO). La RPC no la devuelve: se calcula en cliente. */
  expiraEn: string
}

interface UseTelegramVinculoReturn {
  vinculado: boolean
  /** Fecha (ISO) en que se creó el vínculo, o null si no hay vínculo. */
  vinculadoDesde: string | null
  /** ID numérico de Telegram de la cuenta vinculada (como texto), o null. */
  telegramUserId: string | null
  /** Username de Telegram sin @, o null si la cuenta no tiene. */
  telegramUsername: string | null
  loading: boolean
  error: string | null
  generarCodigo: () => Promise<CodigoTelegram | null>
  desvincular: () => Promise<{ error: string | null }>
  refresh: () => Promise<void>
}

// Contrato: generar_codigo_telegram() caduca a los 10 minutos.
const CODIGO_TTL_MS = 10 * 60 * 1000

const MSG_NO_PERMISO = 'Necesitas ser admin con clase asignada y acceso aprobado'
const MSG_GENERAR = 'No se pudo generar el código, inténtalo de nuevo'

export function useTelegramVinculo(): UseTelegramVinculoReturn {
  const [vinculado, setVinculado] = useState(false)
  const [vinculadoDesde, setVinculadoDesde] = useState<string | null>(null)
  const [telegramUserId, setTelegramUserId] = useState<string | null>(null)
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchVinculo = useCallback(async () => {
    const supabase = getSupabase()
    try {
      // RLS: solo devuelve el vínculo propio.
      const { data, error: fetchError } = await supabase
        .from('telegram_vinculos')
        .select('created_at, telegram_user_id, telegram_username')
        .maybeSingle()

      if (!mountedRef.current) return
      if (fetchError) {
        console.error('Error al consultar el vínculo de Telegram:', fetchError)
        setError('No se pudo consultar el estado de Telegram')
        return
      }

      const row = data as {
        created_at: string
        telegram_user_id: number | string | null
        telegram_username: string | null
      } | null
      setVinculado(row !== null)
      setVinculadoDesde(row?.created_at ?? null)
      setTelegramUserId(row?.telegram_user_id != null ? String(row.telegram_user_id) : null)
      setTelegramUsername(row?.telegram_username ? row.telegram_username.replace(/^@/, '') : null)
      setError(null)
    } catch {
      if (mountedRef.current) setError('Error de conexión')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void fetchVinculo()
    return () => { mountedRef.current = false }
  }, [fetchVinculo])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchVinculo()
  }, [fetchVinculo])

  const generarCodigo = useCallback(async (): Promise<CodigoTelegram | null> => {
    const supabase = getSupabase()
    try {
      const { data, error: rpcError } = await supabase.rpc('generar_codigo_telegram')
      if (!mountedRef.current) return null
      if (rpcError) {
        console.error('Error en generar_codigo_telegram:', rpcError)
        setError(rpcError.code === '42501' ? MSG_NO_PERMISO : MSG_GENERAR)
        return null
      }
      if (typeof data !== 'string' || !/^[0-9]{6}$/.test(data)) {
        setError('Respuesta no válida del servidor')
        return null
      }
      setError(null)
      return { codigo: data, expiraEn: new Date(Date.now() + CODIGO_TTL_MS).toISOString() }
    } catch {
      if (mountedRef.current) setError('Error de conexión')
      return null
    }
  }, [])

  const desvincular = useCallback(async (): Promise<{ error: string | null }> => {
    const supabase = getSupabase()
    try {
      const { error: rpcError } = await supabase.rpc('desvincular_telegram')
      if (rpcError) {
        console.error('Error en desvincular_telegram:', rpcError)
        const msg = 'No se pudo desvincular, inténtalo de nuevo'
        if (mountedRef.current) setError(msg)
        return { error: msg }
      }
      if (mountedRef.current) {
        setVinculado(false)
        setVinculadoDesde(null)
        setTelegramUserId(null)
        setTelegramUsername(null)
        setError(null)
      }
      return { error: null }
    } catch {
      const msg = 'Error de conexión'
      if (mountedRef.current) setError(msg)
      return { error: msg }
    }
  }, [])

  return { vinculado, vinculadoDesde, telegramUserId, telegramUsername, loading, error, generarCodigo, desvincular, refresh }
}
