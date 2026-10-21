import { useEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import { MAX_MULT, MIN_BET, STEP, chance, maxBetFor, payout } from './frog.js'
import { eur } from './money.js'
import { isMuted, playChip, playLose, playPeg, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import PowerButton from './PowerButton.jsx'
import './Frog.css'

// Estanque (unidades del viewBox): un nenúfar por multiplicador, de ×1 a ×MAX_MULT, en una línea ondulada.
const W = 1000
const H = 330
const PAD_R = 40
const GAP = (W - 120) / (MAX_MULT - 1)
const HOP_MS = 520
const SINK_MS = 1100
const pads = Array.from({ length: MAX_MULT }, (_, i) => i + 1)
const padPos = (mult) => ({ x: 60 + (mult - 1) * GAP, y: 200 + Math.sin(mult * 1.1) * 30 })
const framePos = (mult) => {
  const { x, y } = padPos(mult)
  return `translate(${x}px, ${y - 22}px)`
}

function FrogShape({ sunk }) {
  return (
    <g className={`frog__frog ${sunk ? 'is-sunk' : ''}`}>
      <ellipse className="frog__leg" cx="-17" cy="10" rx="10" ry="6" />
      <ellipse className="frog__leg" cx="17" cy="10" rx="10" ry="6" />
      <ellipse className="frog__body" cx="0" cy="0" rx="21" ry="16" />
      <ellipse className="frog__belly" cx="0" cy="6" rx="12" ry="8" />
      <circle className="frog__eye" cx="-10" cy="-14" r="8" />
      <circle className="frog__eye" cx="10" cy="-14" r="8" />
      <circle className="frog__pupil" cx="-10" cy="-14" r="3.6" />
      <circle className="frog__pupil" cx="10" cy="-14" r="3.6" />
      <path className="frog__mouth" d="M-10 -1 Q0 6 10 -1" />
    </g>
  )
}

// La rana la sortea el servidor con el saldo semanal (cuenta en el Score): cada salto lo pide el jugador y aquí solo se anima.
function Frog({ onExit, juegos }) {
  const [bet, setBet] = useState(50)
  const [sound, setSound] = useState(() => !isMuted())
  const [run, setRun] = useState(null) // { bet, mult } mientras hay una rana en marcha
  const [at, setAt] = useState(1) // nenúfar donde está dibujada la rana
  const [hop, setHop] = useState(null) // salto en el aire: { from, to, after }
  const [sunk, setSunk] = useState(null) // nenúfar donde cayó al agua
  const [asking, setAsking] = useState(false)
  const [last, setLast] = useState(null) // última partida liquidada
  const [burst, setBurst] = useState(null)
  const [ready, setReady] = useState(false)
  const frogRef = useRef(null)
  const lock = useRef(false) // una petición a la vez, aunque se pulse dos veces en el mismo instante
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { request } = juegos
  const serverBalance = juegos.me?.balance ?? 0
  // Se enseña el saldo que ya vio la pantalla: el premio no aparece hasta que acaba el salto.
  const [balance, setBalance] = useState(serverBalance)
  const animating = hop !== null || sunk !== null
  useEffect(() => {
    if (!animating && !asking) setBalance(serverBalance)
  }, [serverBalance, animating, asking])
  const shownBank = useCountUp(balance)

  // Al entrar: si había una rana en marcha (recarga de la página), se recupera.
  useEffect(() => {
    let alive = true
    request({ t: 'solo_frog', a: 'sync' }).then((body) => {
      if (!alive) return
      const view = body?.solo
      if (view?.bet > 0) {
        setRun({ bet: view.bet, mult: view.mult })
        setAt(view.mult)
        setBet(view.bet)
      }
      if (view?.last) setLast(view.last)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [request])

  const mult = run?.mult ?? 1
  const maxBet = maxBetFor(balance)
  const shownBet = run ? run.bet : Math.max(MIN_BET, Math.min(bet, maxBet))
  const broke = !run && !animating && balance < MIN_BET
  const busy = asking || animating || !ready
  const worth = run ? payout(run.bet, mult) : 0

  // Salto animado: arco hasta el siguiente nenúfar. Al acabar se ejecuta hop.after.
  const finishHop = useEffectEvent(() => {
    const { to, after } = hop
    setAt(to)
    setHop(null)
    after()
  })
  useEffect(() => {
    if (!hop) return
    const el = frogRef.current
    const a = padPos(hop.from)
    const b = padPos(hop.to)
    const frames = [
      { transform: framePos(hop.from) },
      { transform: `translate(${(a.x + b.x) / 2}px, ${Math.min(a.y, b.y) - 100}px)`, offset: 0.5 },
      { transform: framePos(hop.to) },
    ]
    const animation = el.animate(frames, { duration: reduced ? 120 : HOP_MS, easing: 'ease-in-out', fill: 'forwards' })
    animation.onfinish = () => finishHop()
    return () => {
      animation.onfinish = null
      animation.cancel()
    }
  }, [hop, reduced])

  // La rana cae al agua: se hunde un momento y vuelve al primer nenúfar para la partida siguiente.
  useEffect(() => {
    if (sunk === null) return
    const timer = setTimeout(
      () => {
        setSunk(null)
        setAt(1)
      },
      reduced ? 400 : SINK_MS,
    )
    return () => clearTimeout(timer)
  }, [sunk, reduced])

  async function act(message) {
    if (busy || lock.current) return null
    lock.current = true
    setAsking(true)
    const body = await request({ t: 'solo_frog', ...message })
    setAsking(false)
    lock.current = false
    return body?.solo ?? null
  }

  async function start() {
    if (busy || run || shownBet < MIN_BET || shownBet > balance) return
    playChip()
    setBurst(null)
    setLast(null)
    const view = await act({ a: 'start', bet: shownBet })
    if (!view) return
    setBalance(view.balance)
    setRun({ bet: view.bet, mult: 1 })
    setAt(1)
  }

  async function jump() {
    if (busy || !run) return
    const view = await act({ a: 'jump' })
    if (!view) return
    const from = at
    const to = view.to
    if (view.ev === 'jump') {
      setHop({
        from,
        to,
        after: () => {
          playPeg(to)
          setRun({ bet: view.bet, mult: view.mult })
        },
      })
    } else {
      // 'fall' (cae al agua) o 'top' (llegó al último nenúfar y cobra solo).
      setHop({
        from,
        to,
        after: () => {
          setRun(null)
          setLast(view.last)
          setBalance(view.balance)
          if (view.ev === 'fall') {
            setSunk(to)
            playLose()
          } else {
            finish(view.last)
          }
        },
      })
    }
  }

  async function cash() {
    if (busy || !run) return
    const view = await act({ a: 'cash' })
    if (!view) return
    setRun(null)
    setLast(view.last)
    setBalance(view.balance)
    finish(view.last)
  }

  function finish(result) {
    if (result.net > 0) {
      playWin(result.mult >= 5)
      setBurst({ id: result.round, amount: result.net, mult: result.mult, stake: result.stake })
    }
  }

  const onPrimary = useEffectEvent(() => (run ? jump() : start()))
  // Espacio salta (o lanza la rana si aún no hay partida). Si el foco está en un botón por teclado, se respeta su acción.
  useEffect(() => {
    const onKey = (event) => {
      if (event.code !== 'Space' || event.repeat) return
      if (event.target instanceof Element && event.target.matches('button:focus-visible, input')) return
      event.preventDefault()
      onPrimary()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  let status = 'Elige tu apuesta con la barra y deja a la rana en el nenúfar.'
  if (juegos.error) status = juegos.error
  else if (broke) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
  else if (sunk !== null) status = '¡Splash! La rana cayó al agua. Pierdes la apuesta.'
  else if (run) status = `Estás en ×${mult}: si cobras ahora recibes ${eur(worth)}. ¿Saltas a ×${mult + 1}? (${chance(mult)} % de acertar)`
  else if (last?.net > 0) status = `¡Cobraste ×${last.mult}! Ganaste ${eur(last.net)}.`
  else if (last) status = `La rana no llegó a ×${last.mult}. Perdiste ${eur(last.stake)}.`
  else if (balance < MIN_BET) status = 'No te alcanza para la apuesta mínima.'
  const lastWon = !run && last?.net > 0

  return (
    <main className="app frog-app">
      <header className="top">
        <h1>Rana</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd className={lastWon ? 'money__up' : ''}>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>{run ? 'En juego' : 'Apuesta'}</dt>
              <dd>{eur(shownBet)}</dd>
            </div>
          </dl>
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
            <PowerButton request={juegos.request} game="frog" hit={juegos.powerHit} />
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
                Pon tu apuesta con la barra y deja a la rana en el nenúfar ×1. Después decides en cada salto: <b>saltar</b> al
                siguiente nenúfar (×2, ×3, ×4…) o <b>cobrar</b> lo que llevas.
              </p>
              <p>
                Si la rana acierta, tu premio sube: a ×3 cobras el triple de lo apostado. Si falla, cae al agua y pierdes la
                apuesta. Cuanto más lejos, más difícil es el siguiente salto: el primero sale {chance(1)} de cada 100 veces.
              </p>
              <p>
                Al llegar a ×{MAX_MULT} cobras solo. Pulsa <kbd>Espacio</kbd> para saltar.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="frog fill">
        <section className="frog__machine" aria-label="Estanque">
          <p className={`status ${lastWon ? 'status--win' : ''}`} aria-live="polite">
            {status}
          </p>
          <div className="frog__pond">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Estanque con ${MAX_MULT} nenúfares; la rana está en el ×${at}`}>
              {pads.map((m) => {
                const { x, y } = padPos(m)
                const state = sunk === m ? 'is-splash' : m < at ? 'is-past' : m === at ? 'is-here' : m === mult + 1 && run ? 'is-next' : ''
                return (
                  <g key={m} className={`frog__pad ${state}`} transform={`translate(${x} ${y})`}>
                    <ellipse className="frog__ripple" rx={PAD_R + 12} ry={(PAD_R + 12) * 0.42} cy="6" />
                    <ellipse className="frog__leaf" rx={PAD_R} ry={PAD_R * 0.42} />
                    <path className="frog__notch" d={`M0 0 L${PAD_R * 0.9} ${-PAD_R * 0.12}`} />
                    <text className="frog__mult" y={PAD_R * 0.72}>
                      ×{m}
                    </text>
                    {sunk === m && <circle className="frog__splash" r="6" />}
                  </g>
                )
              })}
              <g ref={frogRef} className="frog__sprite" style={{ transform: framePos(at) }}>
                <FrogShape sunk={sunk !== null} />
              </g>
            </svg>
          </div>
        </section>

        <aside className="frog__panel">
          <div className="frog__group">
            <h2>Apuesta</h2>
            <label className="frog__slider">
              <span className="frog__amount">{eur(shownBet)}</span>
              <input
                type="range"
                min={MIN_BET}
                max={Math.max(maxBet, MIN_BET)}
                step={STEP}
                value={shownBet}
                disabled={Boolean(run) || animating || maxBet <= MIN_BET}
                aria-label="Apuesta"
                onChange={(event) => setBet(Number(event.target.value))}
              />
              <span className="frog__scale">
                <span>{eur(MIN_BET)}</span>
                <span>{eur(Math.max(maxBet, MIN_BET))}</span>
              </span>
            </label>
            {run && <p className="frog__hint">La apuesta no se cambia mientras la rana está en marcha.</p>}
          </div>

          <div className="actions frog__actions">
            {!run && !broke && (
              <button type="button" className="primary" disabled={busy || shownBet > balance || animating} onClick={start}>
                Lanzar rana <kbd>Espacio</kbd>
              </button>
            )}
            {run && (
              <>
                <button type="button" className="primary" disabled={busy} onClick={jump}>
                  Saltar a ×{mult + 1} <kbd>Espacio</kbd>
                </button>
                <button type="button" className="frog__cash" disabled={busy} onClick={cash}>
                  Cobrar {eur(worth)}
                </button>
              </>
            )}
          </div>

          {run && (
            <p className="frog__odds">
              Siguiente salto: <b>{chance(mult)} %</b> de acertar
            </p>
          )}
        </aside>
      </div>

      {burst && (
        <WinBurst
          key={burst.id}
          amount={burst.amount}
          caption={`×${burst.mult} con ${eur(burst.stake)}`}
          coins={Math.min(70, 20 + burst.mult * 5)}
          big={burst.mult >= 8}
          who={juegos.me?.name}
        />
      )}
    </main>
  )
}

export default Frog
