import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { KINDS } from './duel.js'
import { eur } from './money.js'
import { isMuted, playTurn } from './sound.js'
import Avatar from './Avatar.jsx'
import './Duel.css'

const POLL_MS = 20000

// Aviso de duelos en cualquier pantalla de Juegos (menos la de duelos): alguien te reta o acepta tu reto. También cuenta
// los retos que te esperan para el botón del selector (onCount).
export default function DuelAlert({ request, me, hidden, onOpen, onCount }) {
  const [toast, setToast] = useState(null)
  const known = useRef(null) // { open: Set(ids), played: Set(ids) }

  useEffect(() => {
    if (!me) return
    let alive = true
    const load = async () => {
      const body = await request({ t: 'duel', a: 'lista' })
      const d = body?.duel
      if (!d || !alive) return
      const forMe = d.abiertos.filter((x) => x.reta.id !== me)
      onCount(forMe.length)
      const open = new Set(d.abiertos.map((x) => x.id))
      const played = new Set(d.recientes.map((x) => x.id))
      if (known.current) {
        const challenged = forMe.find((x) => x.para?.id === me && !known.current.open.has(x.id))
        const accepted = d.recientes.find((x) => x.reta.id === me && !known.current.played.has(x.id))
        const next = accepted
          ? { id: `a${accepted.id}`, who: accepted.acepta, text: `${accepted.acepta?.name} aceptó tu duelo de ${eur(accepted.apuesta)}: ${accepted.ganador === 'reta' ? '¡has ganado!' : 'has perdido'}` }
          : challenged
            ? { id: `c${challenged.id}`, who: challenged.reta, text: `${challenged.reta.name} te reta a ${KINDS[challenged.tipo].name.toLowerCase()} por ${eur(challenged.apuesta)}` }
            : null
        if (next) {
          setToast(next)
          if (!isMuted()) playTurn()
        }
      }
      known.current = { open, played }
    }
    load()
    const channel = supabase
      .channel('juegos-duelos')
      .on('broadcast', { event: 'cambio' }, () => {
        load()
      })
      .subscribe()
    // Respaldo por si se pierde un aviso de Realtime.
    const poll = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS)
    return () => {
      alive = false
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [me, request, onCount])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 9000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast || hidden) return null
  return (
    <div className="duel-toast" role="status">
      <Avatar name={toast.who?.name ?? '?'} src={toast.who?.avatar} size={40} />
      <p>{toast.text}</p>
      <button
        type="button"
        onClick={() => {
          setToast(null)
          onOpen()
        }}
      >
        Ver
      </button>
      <button type="button" className="duel-toast__x" aria-label="Cerrar" onClick={() => setToast(null)}>
        ×
      </button>
    </div>
  )
}
