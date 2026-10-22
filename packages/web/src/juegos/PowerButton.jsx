import { useCallback, useEffect, useRef, useState } from 'react'
import GachaCard from './GachaCard.jsx'
import { eur } from './money.js'
import { wait } from './gacha.js'

const POKER_LIVE = new Set(['preflop', 'flop', 'turn', 'river'])
const TABLES = new Set(['poker', 'blackjack'])
const TOAST_MS = 5000

// «ve las cartas… y sabe si…» (lo que cuenta el chat) dicho a quien lo usa: «ves… y sabes…».
export const youForm = (text) => text.replace(/\bve\b/g, 'ves').replace(/\bsabe\b/g, 'sabes')

// Qué hizo el seguro o el premio en la última jugada.
function hitText(hit) {
  let text
  if (hit.kind === 'seguro') text = hit.extra > 0 ? `te devuelve ${eur(hit.extra)}` : 'no hizo falta: no perdiste'
  else text = hit.extra > 0 ? `+${eur(hit.extra)} de premio` : 'esta vez no ganaste'
  const left = hit.left > 0 ? ` Le ${hit.left === 1 ? 'queda 1 jugada' : `quedan ${hit.left} jugadas`}.` : ''
  return `✦ ${hit.name}: ${text}.${left}`
}

// Poderes de tus cartas del gacha para el juego en el que estás (las reglas, en api/_juegos/gacha.mjs y game.mjs).
// Solo aparece si tienes alguna carta con poder para este juego. En las mesas (póker, blackjack) se usan durante una
// mano; en los juegos en solitario se activa un seguro o un premio para las próximas jugadas.
// game: poker | blackjack | roulette | crash | dungeon | plinko | frog | race | claw. send, state y mine solo hacen falta en las mesas.
// hit: el último efecto que se aplicó (para volver a pedir la lista y que se vean los usos que quedan).
function PowerButton({ request, game, send, state, mine, hit }) {
  const dialog = useRef(null)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)
  const table = TABLES.has(game)

  useEffect(() => {
    if (!hit) return
    setToast(hit)
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [hit])
  const load = useCallback(async () => {
    const body = await request({ t: 'gacha', a: 'poderes' })
    if (body?.gacha?.powers) setData(body.gacha.powers)
  }, [request])

  useEffect(() => {
    load()
  }, [load, state?.hand, state?.round, hit])

  const list = data?.list.filter((p) => p.game === game) ?? []
  if (list.length === 0) return null
  const now = Date.now()
  const active = table ? (state?.peek ?? null) : (data.active.find((e) => e.game === game) ?? null)
  let canPlay = true
  if (game === 'poker') canPlay = POKER_LIVE.has(state?.phase) && mine?.inHand && !mine.folded
  if (game === 'blackjack') canPlay = state?.phase === 'playing' && mine?.cards?.length > 0
  const ready = list.filter((p) => !p.readyAt || p.readyAt <= now).length

  async function use(card) {
    if (table) {
      send({ t: 'power', card, game })
      dialog.current?.close()
      setTimeout(load, 800)
      return
    }
    setBusy(true)
    await request({ t: 'gacha', a: 'activar', card, game })
    await load()
    setBusy(false)
    dialog.current?.close()
  }

  let label = ready > 0 ? ` ${ready}` : ''
  if (!table && active) label = ` activo · ${active.uses}`

  return (
    <>
      {toast && (
        <p className={`pw-toast ${toast.extra > 0 ? 'is-good' : ''}`} role="status">
          {hitText(toast)}
        </p>
      )}
      <button
        type="button"
        className={`pw-open ${!table && active ? 'is-active' : ''}`}
        aria-label={!table && active ? `Poder activo: ${active.name}, ${active.uses} jugadas` : `Poderes${ready > 0 ? `: ${ready} listos` : ''}`}
        onClick={() => dialog.current?.showModal()}
      >
        ✦<span className="pw-open__text"> Poderes</span>
        {label}
      </button>
      <dialog
        ref={dialog}
        className="modal"
        aria-label="Poderes de tus cartas"
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close()
        }}
      >
        <div className="modal__body">
          <header className="modal__head">
            <h2>Tus poderes para este juego</h2>
            <button type="button" className="modal__close" aria-label="Cerrar" onClick={() => dialog.current?.close()}>
              ×
            </button>
          </header>
          <p className="pw-note">
            {table
              ? 'Cada carta de tu biblioteca tiene un poder para esta mesa, que dura una mano. Usarlo gasta la carta: sale de tu biblioteca y vuelve a quedar libre. La mesa verá un aviso en el chat.'
              : 'Cada carta de tu biblioteca tiene un poder para este juego: un seguro si pierdes o un premio si ganas. Usarlo gasta la carta: sale de tu biblioteca y vuelve a quedar libre. Uno activo a la vez.'}
          </p>
          {!table && active && (
            <p className="pw-active">
              ✦ Activo: <b>{active.name}</b> · {active.uses === 1 ? 'queda 1 jugada' : `quedan ${active.uses} jugadas`}
            </p>
          )}
          <ul className="pw-list">
            {list.map((p) => {
              const waiting = p.readyAt > now
              return (
                <li key={p.card.id}>
                  <GachaCard card={p.card} mini />
                  <div>
                    <b>
                      {p.power.strong && '★ '}
                      {p.power.name}
                    </b>
                    <small>{p.card.name}</small>
                    <p>{p.power.text}</p>
                  </div>
                  <button
                    type="button"
                    className="hub-btn hub-btn--primary"
                    disabled={busy || !canPlay || Boolean(active) || waiting}
                    onBlur={() => setConfirm(null)}
                    onClick={() => {
                      if (confirm !== p.card.id) return setConfirm(p.card.id)
                      setConfirm(null)
                      use(p.card.id)
                    }}
                  >
                    {waiting ? `En ${wait(p.readyAt - now)}` : confirm === p.card.id ? '¿Gastar la carta?' : table ? 'Usar' : 'Activar'}
                  </button>
                </li>
              )
            })}
          </ul>
          {table && !canPlay && <p className="pw-note">Podrás usarlos cuando estés jugando una mano.</p>}
          {table && canPlay && active && <p className="pw-note">Ya tienes un poder activo en esta mano.</p>}
        </div>
      </dialog>
    </>
  )
}

export default PowerButton
