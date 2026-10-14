import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Conexión de juegos con TopCode: cada acción es una petición a /api/juegos (función de Vercel) con la sesión de
// Supabase, y Supabase Realtime avisa cuando cambia tu mesa para pedir tu vista (cada uno ve solo sus cartas).
// Los temporizadores de la mesa (turnos, crupier) los hace avanzar el propio navegador con «tick» cuando vencen.
// conn: connecting | open | closed (sin red; reintenta) | denied (cuenta no aprobada o sesión caducada)
const HEARTBEAT_MS = 20000
const LOBBY_POLL_MS = 15000
const RETRY_MS = 3000
const ERROR_MS = 3500

export function useJuegos() {
  const [conn, setConn] = useState('connecting')
  const [me, setMe] = useState(null)
  const [room, setRoom] = useState(null)
  const [lobby, setLobby] = useState(null)
  const [chat, setChat] = useState([])
  const [scores, setScores] = useState(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState('')
  const [attempt, setAttempt] = useState(0)
  const chatAfter = useRef(0)
  const roomCode = useRef(null)
  const seq = useRef(0)
  const appliedSeq = useRef(0)
  const errorTimer = useRef(null)
  const alive = useRef(true)

  const showError = useCallback((message) => {
    setError(message)
    clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(''), ERROR_MS)
  }, [])

  const apply = useCallback(
    (body, n) => {
      if (body.me) setMe(body.me)
      if (body.lobby) setLobby(body.lobby)
      if (body.scores) setScores({ ...body.scores, at: Date.now() })
      if (body.error) showError(body.error.message)
      // Una respuesta vieja que llega tarde no pisa una mesa más nueva.
      if ('state' in body && n > appliedSeq.current) {
        appliedSeq.current = n
        const code = body.state?.code ?? null
        if (code !== roomCode.current) {
          roomCode.current = code
          chatAfter.current = 0
          setChat([])
        }
        setRoom(body.state ? { state: body.state, at: Date.now() } : null)
      }
      if (body.chat?.length && roomCode.current) {
        const fresh = body.chat.filter((m) => m.id > chatAfter.current)
        if (fresh.length) {
          chatAfter.current = fresh.at(-1).id
          setChat((list) => [...list, ...fresh].slice(-50))
        }
      }
    },
    [showError],
  )

  const call = useCallback(
    async (msg) => {
      const n = ++seq.current
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      let res
      try {
        res = await fetch('/api/juegos', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ ...msg, chatAfter: chatAfter.current }),
        })
      } catch {
        if (alive.current) setConn('closed')
        return
      }
      const body = await res.json().catch(() => null)
      if (!alive.current) return
      if (res.status === 401 || res.status === 403) {
        setDenied(body?.error?.message ?? 'No se pudo comprobar tu cuenta.')
        setConn('denied')
        return
      }
      if (res.status >= 500 || !body) {
        setConn('closed')
        if (body?.error) showError(body.error.message)
        return
      }
      setConn('open')
      apply(body, n)
    },
    [apply, showError],
  )

  // Al entrar (y tras un fallo de red): saludo, que además devuelve la mesa si ya estabas sentado.
  useEffect(() => {
    alive.current = true
    call({ t: 'hello' })
    return () => {
      alive.current = false
      clearTimeout(errorTimer.current)
    }
  }, [call, attempt])

  useEffect(() => {
    if (conn !== 'closed') return
    const timer = setTimeout(() => setAttempt((a) => a + 1), RETRY_MS)
    return () => clearTimeout(timer)
  }, [conn])

  const code = room?.state.code ?? null

  // Avisos de Realtime: de tu mesa si estás en una, o del selector si no.
  useEffect(() => {
    let debounce = null
    const refresh = (msg, ms) => () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => call(msg), ms)
    }
    const channel = supabase
      .channel(code ? `juegos-mesa-${code}` : 'juegos-lobby')
      .on('broadcast', { event: 'cambio' }, refresh(code ? { t: 'view' } : { t: 'lobby' }, code ? 60 : 400))
      .subscribe()
    // Latido: te mantiene presente en la mesa y recupera cualquier aviso perdido.
    const beat = setInterval(() => call(code ? { t: 'view' } : { t: 'lobby' }), code ? HEARTBEAT_MS : LOBBY_POLL_MS)
    return () => {
      clearTimeout(debounce)
      clearInterval(beat)
      supabase.removeChannel(channel)
    }
  }, [code, call])

  // Temporizador de la mesa: cuando vence, este navegador lo hace avanzar (con un poco de margen aleatorio para que
  // no lleguen todos a la vez).
  const wakeIn = room?.state.wakeIn ?? null
  const at = room?.at
  useEffect(() => {
    if (wakeIn === null || at === undefined) return
    const wait = Math.max(0, wakeIn - (Date.now() - at)) + 150 + Math.random() * 250
    const timer = setTimeout(() => call({ t: 'tick' }), wait)
    return () => clearTimeout(timer)
  }, [wakeIn, at, call])

  // Devuelve true como el WebSocket de juegos original: el envío ya está en marcha.
  const send = useCallback(
    (message) => {
      call(message)
      return true
    },
    [call],
  )

  const leave = useCallback(() => {
    appliedSeq.current = ++seq.current
    roomCode.current = null
    chatAfter.current = 0
    setRoom(null)
    setChat([])
    call({ t: 'leave_room' })
  }, [call])

  const reconnect = useCallback(() => {
    setDenied('')
    setConn('connecting')
    setAttempt((a) => a + 1)
  }, [])

  return { conn, me, room, lobby, chat, scores, error, denied, send, leave, reconnect }
}
