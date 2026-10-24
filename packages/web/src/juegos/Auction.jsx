import { useCallback, useEffect, useRef, useState } from 'react'
import { BID_MS, BID_STEP, MAX_BID, PRIZES, ROUND_MS, TIERS, TIER_ORDER, minBid, phaseAt } from './auction.js'
import { eur } from './money.js'
import { buzz, isMuted, playCash, playChip, playLose, playReveal, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import Avatar from './Avatar.jsx'
import './season3.css'
import './Auction.css'

const POLL_MS = 4000 // mientras se puja: cuántos pujan
const REVEAL_WAIT_MS = 900 // tras el cierre, lo que se espera para pedir qué llevaba la caja
const RAISES = [100, 500, 1000, 5000]
const MAX_PADDLES = 24 // paletas que se dibujan como mucho
const MAX_BARS = 8 // barras de la gráfica de pujas (se añade la tuya si quedara fuera)

// Azar determinista por (índice, semilla): partículas y confeti sin Math.random en el render.
const rnd = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const SPARKS = Array.from({ length: 14 }, (_, i) => i)
const CONFETTI = Array.from({ length: 32 }, (_, i) => i)
const CONFETTI_COLORS = ['#ffd23f', '#ff6b6b', '#7fe7ff', '#9be37b', '#f5a3ff', '#ffffff']
const tension = (n) => (n < 0.25 ? 'Tranquila' : n < 0.5 ? 'Subiendo' : n < 0.78 ? 'Caliente' : '¡Al rojo!')
const short = (n) => (n >= 1000 ? `${n / 1000}k` : String(n))

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
  const [pulse, setPulse] = useState({ round: null, n: 0, delta: 0, key: 0 }) // cambios en el número de pujadores
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
  const bidders = view?.bidders ?? 0

  // Si cambia el número de pujadores se anota cuántos han entrado, para el «+1» que salta.
  if (view && (pulse.round !== round || pulse.n !== bidders)) {
    setPulse({ round, n: bidders, delta: pulse.round === round ? bidders - pulse.n : 0, key: pulse.key + 1 })
  }

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

  const prize = result ? PRIZES[result.prize] : null
  const real = result?.amount ?? 0
  const heat = bidding ? Math.min(1, (0.55 * bidders) / 8 + (0.45 * offset) / BID_MS) : 0
  const left = Math.ceil(((phase === 'bid' ? BID_MS : ROUND_MS) - offset) / 1000)
  const hot = bidding && left <= 5
  // Temblor de la caja: crece en los últimos 12 s de puja.
  const amp = bidding ? Math.max(0, Math.min(1, (12 - left) / 12)) : 0
  // Gráfica de pujas: las mejores y, si hace falta, la tuya.
  let rows = result?.bids ?? []
  if (rows.length > MAX_BARS) {
    const mineRow = rows.findIndex((b) => b.me)
    rows = mineRow >= MAX_BARS ? [...rows.slice(0, MAX_BARS - 1), rows[mineRow]] : rows.slice(0, MAX_BARS)
  }
  const hidden = (result?.bids.length ?? 0) - rows.length
  const scale = Math.max(real, ...(result?.bids ?? []).map((b) => b.amount), 1) * 1.08
  const diff = result?.winner ? result.winner.bid - real : 0
  const history = live?.history ?? []
  const histMax = Math.max(1, ...history.flatMap((h) => [h.amount, h.winner.bid]))
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
        <section className="s3__stage au" aria-label="La subasta">
          <p className={`status ${result?.winner?.me && result.amount > result.winner.bid ? 'status--win' : ''}`} aria-live="polite">
            {status}
          </p>
          <div className={`au-scene au-scene--${tier ?? 'madera'} ${result ? 'is-open' : ''} ${prize?.mult === 0 ? 'is-stone' : ''}`}>
            {/* Podio: foco de luz, caja sobre el atril, cuenta atrás y rótulo del lote */}
            <div className="au-stage">
              <i className="au-spot" aria-hidden="true" />
              <p className="au-lot">
                <small>Lote</small> nº {ready ? round % 1000 : '…'}
              </p>
              <div className={`au-clock ${hot ? 'is-hot' : ''} ${phase === 'reveal' ? 'is-reveal' : ''}`} style={{ '--left': phase === 'bid' ? 1 - offset / BID_MS : 0 }}>
                <span key={left}>{ready ? left : '…'}</span>
                <small>{phase === 'bid' ? 'para cerrar' : 'siguiente'}</small>
              </div>
              <div className="au-sparks" aria-hidden="true">
                {SPARKS.map((i) => (
                  <i key={i} style={{ '--x': `${8 + rnd(i, 1) * 84}%`, '--d': `${2.4 + rnd(i, 2) * 3}s`, '--w': `${-rnd(i, 3) * 5}s`, '--s': `${3 + rnd(i, 4) * 4}px` }} />
                ))}
              </div>
              <div className={`au-crate ${amp > 0 ? 'is-shaking' : ''}`} style={{ '--amp': amp }} aria-hidden="true">
                {result && prize.mult >= 8 && <i className="au-rays" />}
                {result && <i key={`f${round}`} className="au-flash" />}
                {result && prize.mult >= 2 && (
                  <div className="au-confetti" key={`c${round}`}>
                    {CONFETTI.map((i) => (
                      <i
                        key={i}
                        style={{
                          '--dx': `${(rnd(i, 5) - 0.5) * 360}px`,
                          '--dy': `${-90 - rnd(i, 6) * 190}px`,
                          '--r': `${rnd(i, 7) * 720 - 360}deg`,
                          '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                          '--t': `${0.1 + rnd(i, 8) * 0.4}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
                {result && (
                  <span key={`p${round}`} className="au-prize">
                    {prize.icon}
                  </span>
                )}
                <span className="au-lid" />
                <span className="au-body">
                  <b className="au-lock">{result ? '' : '?'}</b>
                </span>
              </div>
              <div className="au-pedestal" aria-hidden="true">
                <i />
              </div>
              <p className="au-name">
                {tier ? TIERS[tier].name : 'Caja misteriosa'}
                <small>{result ? `${prize.name} · ${eur(real)}` : tier ? `Vale de media ${eur(TIERS[tier].value)}` : ''}</small>
              </p>
              {mine > 0 && !result && (
                <p key={mine} className="au-mine">
                  ✋ Tu puja <b>{eur(mine)}</b>
                </p>
              )}
            </div>

            {/* Lado de la sala: paletas y tensión durante la puja; gráfica de pujas al revelar */}
            <div className="au-side">
              {result ? (
                <div className="au-chart" key={round}>
                  <h2>Las pujas, cara a cara</h2>
                  {result.bids.length === 0 ? (
                    <p className="au-empty">Nadie pujó por esta caja.</p>
                  ) : (
                    <>
                      <p className={`au-verdict ${diff > 0 ? 'is-over' : 'is-under'}`}>
                        {diff > 0
                          ? `${result.winner.me ? 'Pagaste' : `${result.winner.name} pagó`} ${eur(diff)} de más`
                          : diff < 0
                            ? `${result.winner.me ? 'Ganaste' : `${result.winner.name} ganó`} ${eur(-diff)}`
                            : `${result.winner.me ? 'Pagaste' : `${result.winner.name} pagó`} justo lo que valía`}
                      </p>
                      <ol className="au-rows" style={{ '--x': Math.min(1, real / scale) }}>
                        {rows.map((b, i) => (
                          <li
                            key={`${b.name}-${i}`}
                            className={`${b.me ? 'is-me' : ''} ${b === result.bids[0] ? 'is-top' : ''} ${b.amount > real ? 'is-over' : 'is-under'}`}
                            style={{ '--i': i, '--w': b.amount / scale }}
                          >
                            <Avatar name={b.name} src={b.avatar} size={26} />
                            <span className="au-who">
                              {b === result.bids[0] && '🏆 '}
                              {b.name}
                              {b.me && ' (tú)'}
                              <em>{eur(b.amount)}</em>
                            </span>
                            <span className="au-track">
                              <i className="au-bar" />
                            </span>
                          </li>
                        ))}
                        <li className="au-mark" aria-hidden="true">
                          <span>Valía {eur(real)}</span>
                        </li>
                      </ol>
                      {hidden > 0 && <p className="au-more">y {hidden} {hidden === 1 ? 'puja más' : 'pujas más'} por debajo</p>}
                    </>
                  )}
                </div>
              ) : (
                <div className="au-room">
                  <h2>La sala</h2>
                  <div className="au-paddles" role="img" aria-label={`${bidders} pujadores`}>
                    {Array.from({ length: Math.min(bidders, MAX_PADDLES) }, (_, i) => (
                      <span key={`${round}-${i}`} className={`au-paddle ${i === 0 && mine ? 'is-me' : ''}`} style={{ '--k': i % 5 }}>
                        <i>{i === 0 && mine ? 'TÚ' : ''}</i>
                      </span>
                    ))}
                    {bidders === 0 && <p className="au-empty">Ninguna paleta en alto todavía</p>}
                    {pulse.delta > 0 && pulse.round === round && (
                      <b key={pulse.key} className="au-plus">
                        +{pulse.delta}
                      </b>
                    )}
                  </div>
                  <p className="au-count">
                    <b>{bidders}</b> {bidders === 1 ? 'pujador' : 'pujadores'}
                    {bidders > MAX_PADDLES && <small> (se dibujan {MAX_PADDLES})</small>}
                  </p>
                  <div className={`au-heat ${heat > 0.78 ? 'is-max' : ''}`} style={{ '--heat': heat }}>
                    <span>
                      Tensión <b>{tension(heat)}</b>
                    </span>
                    <div className="au-heat__bar">
                      <i />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="s3__panel au-panel">
          <div className="s3__group">
            <h2>Tu puja</h2>
            <p className="au-amount" key={target}>
              {eur(target)}
              <small>
                {!bidding ? `Pujas cerradas: la siguiente caja sale en ${left} s` : mine ? `Ya tienes ${eur(mine)}: pagas ${eur(cost)} más` : `Mínimo ${eur(min)}`}
              </small>
            </p>
            <div className="s3__quick au-raises">
              {RAISES.map((r) => (
                <button key={r} type="button" disabled={!bidding} onClick={() => setAmount(Math.min(MAX_BID, target + r))}>
                  +{short(r)}
                </button>
              ))}
            </div>
            <button type="button" className="s3__reset au-reset" disabled={!bidding} onClick={() => setAmount(0)}>
              Volver al mínimo
            </button>
          </div>
          <div className="actions s3__actions au-actions">
            <button type="button" className="primary" disabled={!bidding || sending || cost > balance} onClick={bid}>
              {sending ? 'Pujando…' : !bidding ? 'Pujas cerradas' : cost > balance ? 'No te llega el saldo' : mine ? `Subir a ${eur(target)}` : `Pujar ${eur(target)}`}
            </button>
          </div>
          <div className="s3__group">
            <h2>Últimas subastas</h2>
            {history.length === 0 ? (
              <p className="s3__hint">Todavía no se ha cerrado ninguna esta semana.</p>
            ) : (
              <>
                <div className="au-hist" role="img" aria-label="Puja ganadora contra valor real de las últimas subastas">
                  {[...history].reverse().map((h) => {
                    const win = h.amount - h.winner.bid > 0
                    return (
                      <div key={h.round} className={win ? 'is-win' : 'is-lose'} title={`Pagó ${eur(h.winner.bid)} · valía ${eur(h.amount)}`}>
                        <span className="au-hist__bars">
                          <i className="is-bid" style={{ '--h': h.winner.bid / histMax }} />
                          <i className="is-real" style={{ '--h': h.amount / histMax }} />
                        </span>
                        <small>{PRIZES[h.prize].icon}</small>
                      </div>
                    )
                  })}
                </div>
                <p className="au-legend">
                  <span className="is-bid">Puja ganadora</span>
                  <span className="is-real">Valor real</span>
                </p>
                <ul className="auction__history">
                  {history.map((h) => {
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
              </>
            )}
          </div>
        </aside>
      </div>

      {burst && <WinBurst key={burst.id} amount={burst.amount} caption={burst.caption} coins={50} big who={juegos.me?.name} tags={burst.tags} />}
    </main>
  )
}

export default Auction
