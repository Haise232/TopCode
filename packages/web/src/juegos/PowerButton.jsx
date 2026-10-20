import { useCallback, useEffect, useRef, useState } from 'react'
import GachaCard from './GachaCard.jsx'
import { wait } from './gacha.js'

const LIVE = new Set(['preflop', 'flop', 'turn', 'river'])

// Poderes de tus cartas del gacha en la mesa de póker (las reglas, en api/_juegos/gacha.mjs y game.mjs). Solo aparece si
// tienes alguna carta con poder; la lista se pide al entrar y en cada mano nueva.
function PowerButton({ request, send, state, mine }) {
  const dialog = useRef(null)
  const [list, setList] = useState(null)
  const load = useCallback(async () => {
    const body = await request({ t: 'gacha', a: 'poderes' })
    if (body?.gacha?.powers) setList(body.gacha.powers)
  }, [request])

  useEffect(() => {
    load()
  }, [load, state.hand])

  if (!list || list.length === 0) return null
  const now = Date.now()
  const inHand = LIVE.has(state.phase) && mine?.inHand && !mine.folded
  const active = Boolean(state.peek)
  const ready = list.filter((p) => !p.readyAt || p.readyAt <= now).length

  return (
    <>
      <button type="button" className="pw-open" aria-label={`Poderes${ready > 0 ? `: ${ready} listos` : ''}`} onClick={() => dialog.current?.showModal()}>
        ✦<span className="pw-open__text"> Poderes</span>
        {ready > 0 ? ` ${ready}` : ''}
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
            <h2>Poderes de tus cartas</h2>
            <button type="button" className="modal__close" aria-label="Cerrar" onClick={() => dialog.current?.close()}>
              ×
            </button>
          </header>
          <p className="pw-note">
            Cada carta épica o mítica de tu colección del gacha tiene un poder para una mano de póker. Se puede usar una vez al
            día y la mesa verá un aviso en el chat.
          </p>
          <ul className="pw-list">
            {list.map((p) => {
              const waiting = p.readyAt > now
              return (
                <li key={p.card.id}>
                  <GachaCard card={p.card} mini />
                  <div>
                    <b>{p.card.power.name}</b>
                    <small>{p.card.name}</small>
                    <p>{p.card.power.text}</p>
                  </div>
                  <button
                    type="button"
                    className="hub-btn hub-btn--primary"
                    disabled={!inHand || active || waiting}
                    onClick={() => {
                      send({ t: 'power', card: p.card.id })
                      dialog.current?.close()
                      setTimeout(load, 800)
                    }}
                  >
                    {waiting ? `En ${wait(p.readyAt - now)}` : 'Usar'}
                  </button>
                </li>
              )
            })}
          </ul>
          {!inHand && <p className="pw-note">Podrás usarlos cuando estés jugando una mano.</p>}
          {inHand && active && <p className="pw-note">Ya tienes un poder activo en esta mano.</p>}
        </div>
      </dialog>
    </>
  )
}

export default PowerButton
