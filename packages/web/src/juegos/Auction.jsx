import { useCallback, useEffect, useRef, useState } from 'react'
import { BID_MS, BID_STEP, MAX_BID, PRIZES, ROUND_MS, TIERS, TIER_ORDER, minBid, phaseAt } from './auction.js'
import { eur } from './money.js'
import { buzz, isMuted, playCash, playChip, playLose, playReveal, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import Avatar from './Avatar.jsx'
import './season3.css'

const POLL_MS = 4000 // mientras se puja: cuántos pujan
const REVEAL_WAIT_MS = 900 // tras el cierre, lo que se espera para pedir qué llevaba la caja
const RAISES = [100, 500, 1000, 5000]

// Subasta a ciegas en vivo: el servidor guarda las pujas, abre la caja y paga; aquí se puja y se anima.
function Auction({ onExit, juegos }) {
  const [live, setLive] = useState(null)
  const [amount, setAmount] = useState(0)
  const [sending, setSending] = useState(false)
  const [sound, setSound] = useState(() => !isMuted())
  const [burst, setBurst] = useState(null)
  const [, setTick] = useState(0)
  const skew = useRef(null)
  const seen = useRef(null) // última ronda cuyo resultado ya se celebró
  const { request } = juegos
  const balance = juegos.me?.balance ?? 0
  const shownBank = useCountUp(balance)

  const clock = useCallback(() => Date.now() + (skew.current ?? 0), [])
  const ask = useCallback(
    async (message) => {
      const sent = Date.now()
      const body = await request({ t: 'auction', ...message })
      const got = Date.now()
      if (body?.auction) {
        if (skew.current === null || got - sent < 1500) skew.current = body.auction.now - (sent + got) / 2
        setLive(body.auction)
      }
      return body
    },
    [request],
  )

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(timer)
  }, [])

  const ready = skew.current !== null && live !== null
  const { round, offset, phase } = phaseAt(clock())
  const view = live?.round === round ? live : null

  useEffect(() => {
    ask({ a: 'sync' })
  }, [ask])
  // Mientras se puja, cada poco (para ver cuántos pujan); al cerrar, justo después para abrir la caja.
  useEffect(() => {
    if (!ready) return
    const close = round * ROUND_MS + BID_MS + REVEAL_WAIT_MS - clock()
    const timers = []
    if (close > 0) timers.push(setTimeout(() => document.visibilityState === 'visible' && ask({ a: 'sync' }), close))
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible' && phaseAt(clock()).phase === 'bid') ask({ a: 'sync' })
    }, POLL_MS)
    // La ronda siguiente empieza: se pide la caja nueva.
    timers.push(setTimeout(() => ask({ a: 'sync' }), (round + 1) * ROUND_MS + 200 - clock()))
    return () => {
      timers.forEach(clearTimeout)
      clearInterval(poll)
    }
  }, [ready, round, ask, clock])

  const tier = view?.tier ?? null
  const min = tier ? minBid(tier) : 0
  const mine = view?.bid ?? 0
  const floor = Math.max(min, mine + BID_STEP)
  const target = Math.max(amount, floor)
  const cost = target - mine
  const result = view?.result ?? null
  const bidding = ready && phase === 'bid' && Boolean(view)

  // Al empezar ronda nueva (o cambiar tu puja), la puja propuesta vuelve al mínimo.
  useEffect(() => {
    setAmount(0)
  }, [round, mine])

  // Se celebra el resultado (una vez por ronda) si te llevaste la caja.
  useEffect(() => {
    if (!result || seen.current === round) return
    seen.current = round
    playReveal()
    if (!result.winner?.me) return
    // Con el Admin Abuse, lo que puso la banca viene en tu última subasta.
    const mine = live?.last?.round === round ? live.last : null
    const extra = mine?.abuse ?? 0
    const net = result.amount - result.winner.bid + extra
    if (net > 0) {
      playCash(5)
      playWin(PRIZES[result.prize].mult >= 4)
      buzz([60, 40, 120])
      setBurst({
        id: round,
        amount: net,
        caption: `${PRIZES[result.prize].icon} ${PRIZES[result.prize].name}`,
        tags: extra > 0 ? [`Admin Abuse: +${eur(extra)}`] : [],
      })
    } else {
      playLose()
    }
  }, [result, round, live])

  async function bid() {
    if (!bidding || sending || cost > balance) return
    setSending(true)
    playChip()
    await ask({ a: 'bid', amount: target })
    setSending(false)
  }

  const left = Math.ceil(((phase === 'bid' ? BID_MS : ROUND_MS) - offset) / 1000)
  let status = 'Conectando con la sala de subastas…'
  if (juegos.error) status = juegos.error
  else if (ready && phase === 'bid') status = mine ? `Tu puja: ${eur(mine)}. Puedes subirla hasta que se cierre.` : `Puja en secreto: el que más ofrezca se lleva la caja. Mínimo ${eur(min)}.`
  else if (ready && result) {
    const p = PRIZES[result.prize]
    status = result.winner
      ? `${result.winner.me ? '¡Te la llevas tú!' : `Se la lleva ${result.winner.name}`} por ${eur(result.winner.bid)}: dentro había ${p.icon} ${p.name.toLowerCase()} (${eur(result.amount)}).`
      : `Nadie pujó. Dentro había ${p.icon} ${p.name.toLowerCase()}.`
  } else if (ready) status = 'Abriendo la caja…'

  return (
    <main className="app s3-app auction-app">
      <header className="top">
        <h1>Subasta a ciegas</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>Tu puja</dt>
              <dd>{eur(mine)}</dd>
            </div>
          </dl>
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
            <button
              type="button"
              aria-pressed={sound}
              onClick={() => {
                setMuted(sound)
                setSound(!sound)
              }}
            >
              Sonido
            </button>
            <Help title="Cómo se juega">
              <p>
                Cada minuto la banca subasta una caja para todos. Ves de qué tipo es, pero no lo que lleva. Tienes {BID_MS / 1000} s
                para pujar en secreto: nadie ve cuánto pujan los demás, solo cuántos pujan. Puedes subir tu puja, pero no bajarla.
              </p>
              <p>
                Al cerrar, el que más ha pujado se lleva la caja y paga su puja; a los demás se les devuelve entera. Si hay empate,
                gana el que pujó antes. Después se abre la caja y se ven todas las pujas.
              </p>
              <ul>
                {TIER_ORDER.map((t) => (
                  <li key={t}>
                    <b>{TIERS[t].name}:</b> vale de media {eur(TIERS[t].value)} · puja mínima {eur(minBid(t))}
                  </li>
                ))}
              </ul>
              <p>
                Dentro puede haber: {PRIZES.map((p) => `${p.icon} ${p.name.toLowerCase()} (×${p.mult.toLocaleString('es-ES')})`).join(', ')}. Una de cada tres es
                una piedra.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="s3 fill">
        <section className="s3__stage auction" aria-label="La caja">
          <p className={`status ${result?.winner?.me && result.amount > result.winner.bid ? 'status--win' : ''}`} aria-live="polite">
            {status}
          </p>
          <div className={`auction__box auction__box--${tier ?? 'madera'} ${result ? 'is-open' : ''}`}>
            <div className="auction__timer" style={{ '--left': phase === 'bid' ? 1 - offset / BID_MS : 0 }}>
              <span>{ready ? left : '…'}</span>
              <small>{phase === 'bid' ? 'para cerrar' : 'siguiente'}</small>
            </div>
            <div className="auction__crate" aria-hidden="true">
              <span className="auction__lid" />
              <span className="auction__body">{result ? PRIZES[result.prize].icon : '?'}</span>
            </div>
            <p className="auction__name">
              {tier ? TIERS[tier].name : 'Caja misteriosa'}
              <small>{result ? `${PRIZES[result.prize].name} · ${eur(result.amount)}` : tier ? `Vale de media ${eur(TIERS[tier].value)}` : ''}</small>
            </p>
            <p className="auction__bidders">
              {view ? `${view.bidders} ${view.bidders === 1 ? 'persona ha pujado' : 'personas han pujado'}` : ''}
            </p>
          </div>
          {result && result.bids.length > 0 && (
            <ol className="s3__rank auction__bids" aria-label="Todas las pujas">
              {result.bids.map((b, i) => (
                <li key={`${b.name}-${i}`} className={`${b.me ? 'is-me' : ''} ${i === 0 ? 'is-top' : ''}`}>
                  <b>{i === 0 ? '🏆' : i + 1}</b>
                  <Avatar name={b.name} src={b.avatar} size={24} />
                  <span>{b.name}</span>
                  <em>{eur(b.amount)}</em>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="s3__panel">
          <div className="s3__group">
            <h2>Tu puja</h2>
            <p className="s3__big">
              {eur(target)}
              <small>{mine ? `Ya tienes ${eur(mine)}: pagas ${eur(cost)} más` : `Mínimo ${eur(min)}`}</small>
            </p>
            <div className="s3__quick">
              {RAISES.map((r) => (
                <button key={r} type="button" disabled={!bidding} onClick={() => setAmount(Math.min(MAX_BID, target + r))}>
                  +{r >= 1000 ? `${r / 1000}k` : r}
                </button>
              ))}
            </div>
            <button type="button" className="s3__reset" disabled={!bidding} onClick={() => setAmount(0)}>
              Volver al mínimo
            </button>
          </div>
          <div className="actions s3__actions">
            <button type="button" className="primary" disabled={!bidding || sending || cost > balance} onClick={bid}>
              {sending ? 'Pujando…' : !bidding ? 'Pujas cerradas' : cost > balance ? 'No te llega el saldo' : mine ? `Subir a ${eur(target)}` : `Pujar ${eur(target)}`}
            </button>
          </div>
          <div className="s3__group">
            <h2>Últimas subastas</h2>
            {(live?.history ?? []).length === 0 ? (
              <p className="s3__hint">Todavía no se ha cerrado ninguna esta semana.</p>
            ) : (
              <ul className="auction__history">
                {live.history.map((h) => {
                  const p = PRIZES[h.prize]
                  const net = h.amount - h.winner.bid
                  return (
                    <li key={h.round} className={net > 0 ? 'is-win' : 'is-lose'}>
                      <span>{p.icon}</span>
                      <span>
                        <b>{h.winner.name}</b> pagó {eur(h.winner.bid)} por {p.name.toLowerCase()}
                        <small>
                          {TIERS[h.tier].name} · {net >= 0 ? `ganó ${eur(net)}` : `perdió ${eur(-net)}`}
                        </small>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {burst && <WinBurst key={burst.id} amount={burst.amount} caption={burst.caption} coins={50} big who={juegos.me?.name} tags={burst.tags} />}
    </main>
  )
}

export default Auction
