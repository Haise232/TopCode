import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  AUTOS,
  BETS_MS,
  CHIPS,
  FLIGHT_MS,
  HOUSE,
  MAX_MULT,
  ROUND_MS,
  fmtMult,
  initialState,
  isDirty,
  msFor,
  multiplierAt,
  payout,
  phaseAt,
  reducer,
  unconfirmed,
} from './crash.js'
import { eur } from './money.js'
import { isMuted, playBoom, playChip, playLaunch, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import WinToast from './WinToast.jsx'
import Help from './Help.jsx'
import './Roulette.css'
import './Crash.css'

const SEND_MS = 300 // la apuesta se manda al servidor un momento después de dejar de tocar las fichas
const LAST_CALL_MS = 3000
const POLL_MS = 1000 // si la espera larga falla, se pregunta cada segundo si ya explotó
const WINNERS_WAIT_MS = 1500 // tras la explosión, para preguntar quién retiró (los automáticos ya se han pagado)
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
// Color de cada explosión en el historial: el color nunca va solo, también va el número.
const toneOf = (mult) => (mult < 200 ? 'low' : mult < 1000 ? 'mid' : 'high')

// Curva del vuelo dibujada con el reloj del servidor: todos ven el mismo cohete a la vez.
// boom: multiplicador donde explotó esta ronda (null si sigue volando o aún no se sabe).
function Sky({ clock, round, boom }) {
  const path = useRef(null)
  const area = useRef(null)
  const rocket = useRef(null)
  const label = useRef(null)
  const box = useRef(null)
  const props = useRef({ round, boom })
  props.current = { round, boom }

  useEffect(() => {
    let frame
    const W = 300
    const H = 180
    const draw = () => {
      const t = clock()
      const { round, boom } = props.current
      const flown = t - (round * ROUND_MS + BETS_MS)
      // Con la explosión conocida, la curva se queda donde explotó.
      const end = boom !== null ? Math.min(flown, msFor(boom)) : Math.min(flown, FLIGHT_MS)
      const mult = boom !== null && flown >= msFor(boom) ? boom : multiplierAt(end)
      const state = flown < 0 ? 'waiting' : boom !== null && flown >= msFor(boom) ? 'boom' : 'flying'
      box.current.dataset.state = state
      if (state === 'waiting') {
        const left = Math.ceil(-flown / 1000)
        label.current.textContent = `Despega en ${left} s`
        path.current.setAttribute('d', '')
        area.current.setAttribute('d', '')
        rocket.current.setAttribute('transform', `translate(14 ${H - 14}) rotate(-45)`)
      } else {
        // Escalas que crecen con el vuelo: al principio se ve cerca y luego se aleja.
        const xMax = Math.max(8000, end * 1.15)
        const yMax = Math.max(2, (mult / 100) * 1.25)
        const x = (ms) => 14 + (ms / xMax) * (W - 28)
        const y = (m) => H - 14 - ((m - 1) / (yMax - 1)) * (H - 28)
        const steps = 40
        let d = ''
        for (let i = 0; i <= steps; i++) {
          const ms = (end * i) / steps
          d += `${i ? 'L' : 'M'}${x(ms).toFixed(1)} ${y(multiplierAt(ms) / 100).toFixed(1)}`
        }
        path.current.setAttribute('d', d)
        area.current.setAttribute('d', `${d}L${x(end).toFixed(1)} ${H - 14}L14 ${H - 14}Z`)
        const tipX = x(end)
        const tipY = y(mult / 100)
        const before = Math.max(0, end - 300)
        const angle = (Math.atan2(y(multiplierAt(before) / 100) - tipY, tipX - x(before)) * 180) / Math.PI
        rocket.current.setAttribute('transform', `translate(${tipX.toFixed(1)} ${tipY.toFixed(1)}) rotate(${(-angle).toFixed(1)})`)
        label.current.textContent = state === 'boom' ? `¡Boom! ${fmtMult(mult)}` : fmtMult(mult)
      }
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [clock])

  return (
    <div className="sky" ref={box} data-state="waiting">
      <svg viewBox="0 0 300 180" aria-hidden="true" preserveAspectRatio="none">
        <path ref={area} className="sky__area" />
        <path ref={path} className="sky__line" />
        <g ref={rocket} className="sky__rocket">
          <g className="sky__ship">
            <path d="M-12 -4 L6 -4 Q14 0 6 4 L-12 4 Z" className="sky__body" />
            <path d="M-12 -4 L-17 -9 L-9 -4 Z M-12 4 L-17 9 L-9 4 Z" className="sky__fin" />
            <circle cx="1" cy="0" r="2" className="sky__window" />
            <path d="M-12 -2.5 L-22 0 L-12 2.5 Z" className="sky__flame" />
          </g>
          <g className="sky__blast">
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1="0" y1="0" x2="16" y2="0" transform={`rotate(${i * 45})`} />
            ))}
            <circle r="9" />
          </g>
        </g>
      </svg>
      <p className="sky__mult" ref={label} />
    </div>
  )
}

// Cuenta atrás de las apuestas: el aro de la ruleta en vivo.
function Countdown({ phase, offset }) {
  const left = phase === 'betting' ? Math.ceil((BETS_MS - offset) / 1000) : 0
  const fraction = phase === 'betting' ? 1 - offset / BETS_MS : 0
  return (
    <div
      className={`countdown countdown--${phase === 'betting' ? 'betting' : 'spinning'} ${phase === 'betting' && left <= LAST_CALL_MS / 1000 ? 'countdown--last' : ''}`}
      style={{ '--left': fraction }}
      aria-hidden="true"
    >
      <span>{phase === 'betting' ? left : '•'}</span>
    </div>
  )
}

// El Cohete en vivo: un multiplicador que sube para todos cada 30 s. El servidor decide dónde explota y paga;
// aquí se apuesta mientras está en tierra y se retira durante el vuelo.
function Crash({ onExit, juegos }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [sound, setSound] = useState(() => !isMuted())
  const [live, setLive] = useState(null) // última respuesta del servidor
  const [sending, setSending] = useState(false)
  const [cashing, setCashing] = useState(false)
  const [winners, setWinners] = useState({ round: null, list: [] })
  const [retry, setRetry] = useState(0)
  const [, setTick] = useState(0)
  const skew = useRef(null)
  const { request } = juegos
  const balance = juegos.me?.balance ?? 0
  const { chip, stake, auto } = state

  const clock = useCallback(() => Date.now() + (skew.current ?? 0), [])
  const { round, offset, phase, flown } = phaseAt(clock())
  const ready = skew.current !== null

  const ask = useCallback(
    async (message) => {
      const sent = Date.now()
      const body = await request({ t: 'solo_crash', ...message })
      const got = Date.now()
      if (body?.solo) {
        // La diferencia de reloj se mide en el punto medio del viaje (la espera larga no sirve: tarda a propósito).
        if (message.a !== 'wait' && (skew.current === null || got - sent < 1500)) skew.current = body.solo.now - (sent + got) / 2
        if (body.solo.winners && Number.isSafeInteger(message.winners)) setWinners({ round: message.winners, list: body.solo.winners })
        setLive(body.solo)
      }
      return body
    },
    [request],
  )

  // Cuatro veces por segundo: cuenta atrás y cambio de fase (la curva va aparte, a todo ritmo).
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (ready) dispatch({ type: 'ROUND', round })
  }, [ready, round])

  useEffect(() => {
    ask({ a: 'sync' })
  }, [ask])
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') ask({ a: 'sync' })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [ask])

  // Explosión de esta ronda, si ya se sabe.
  const boom = live?.round === round && live.crash !== null ? live.crash : null
  const exploded = boom !== null && flown >= msFor(boom)

  // Durante el vuelo, una espera larga: el servidor contesta justo cuando explota. Si falla, se pregunta cada segundo.
  const flying = ready && phase !== 'betting' && boom === null
  useEffect(() => {
    if (!flying) return
    let gone = false
    let timer = null
    ask({ a: 'wait' }).then((body) => {
      if (gone || body?.solo?.crash != null) return
      timer = setTimeout(() => setRetry((n) => n + 1), POLL_MS)
    })
    return () => {
      gone = true
      clearTimeout(timer)
    }
  }, [flying, round, retry, ask])

  // Poco después de explotar se pregunta quién retiró, para anunciarlo a todos.
  useEffect(() => {
    if (boom === null) return
    const wait = round * ROUND_MS + BETS_MS + msFor(boom) + WINNERS_WAIT_MS - clock()
    if (wait < 0) return
    const timer = setTimeout(() => {
      if (document.visibilityState === 'visible') ask({ a: 'sync', winners: round })
    }, wait)
    return () => clearTimeout(timer)
  }, [boom, round, ask, clock])

  // Apuesta que el servidor ya tenía para esta ronda (por ejemplo, tras recargar).
  useEffect(() => {
    if (live) dispatch({ type: 'SERVER', round: live.round, bet: live.bet, auto: live.auto })
  }, [live])

  // La apuesta se confirma con el servidor poco después de tocarla (y al momento si se acaba el tiempo).
  const dirty = isDirty(state)
  useEffect(() => {
    if (!dirty || phase !== 'betting' || state.round !== round) return
    const bet = stake
    const chosen = stake > 0 ? auto : null
    const wait = Math.max(0, Math.min(SEND_MS, BETS_MS - offset - 150))
    const timer = setTimeout(async () => {
      setSending(true)
      const body = await ask({ a: 'bet', round, bet, auto: chosen })
      setSending(false)
      if (body?.solo) dispatch({ type: 'CONFIRMED', round, stake: bet, auto: chosen })
      else dispatch({ type: 'REJECTED', round })
    }, wait)
    return () => clearTimeout(timer)
    // offset cambia cuatro veces por segundo: solo se vuelve a programar si cambia la apuesta o la ronda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, stake, auto, phase, round, state.round, ask])

  const available = Math.max(0, balance - unconfirmed(state))
  const betting = ready && phase === 'betting' && state.round === round
  const inPlay = live?.round === round ? live.bet : 0 // apuesta en el aire (0 si ya retiraste)
  const mine = live?.last && live.last.round === round ? live.last : null
  const shownBank = useCountUp(available)
  const now = flown >= 0 ? (exploded ? boom : multiplierAt(Math.min(flown, FLIGHT_MS))) : 100
  const autoHit = inPlay > 0 && live.auto !== null && boom === null && now >= live.auto
  const canCashout = ready && phase !== 'betting' && !exploded && boom === null && inPlay > 0 && !autoHit && !cashing

  const cashout = useCallback(async () => {
    if (!canCashout) return
    setCashing(true)
    await ask({ a: 'cashout', round })
    setCashing(false)
  }, [canCashout, ask, round])

  // Espacio o Intro para retirar sin buscar el botón.
  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, dialog')) return
      if (!canCashout) return
      event.preventDefault()
      cashout()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canCashout, cashout])

  // Sonidos: despegue, explosión y premio.
  const launchKey = ready && phase !== 'betting' && flown < 1500 ? round : null
  useEffect(() => {
    if (launchKey !== null) playLaunch()
  }, [launchKey])
  const boomKey = exploded && flown - msFor(boom) < 1500 ? round : null
  useEffect(() => {
    if (boomKey !== null) playBoom()
  }, [boomKey])
  const winKey = mine && mine.net > 0 ? round : null
  useEffect(() => {
    if (winKey !== null) playWin(mine.mult >= 1000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winKey])

  const crashes = live ? live.history.crashes : []
  const shownCrashes = live && live.history.last === round && !exploded ? crashes.slice(1) : crashes
  const players = live?.round === round ? (live.players ?? 0) : 0
  const broke = balance === 0 && stake === 0
  const canRepeat = betting && stake === 0 && state.last > 0 && state.last <= available
  const won = mine && mine.net > 0
  const othersWon = useMemo(
    () =>
      winners.list
        .filter((w) => !w.me)
        .map((w) => ({ key: `${winners.round}-${w.name}`, name: w.name, amount: w.amount, detail: `en el cohete (${fmtMult(w.mult)})` })),
    [winners],
  )

  let call = 'Conectando…'
  let detail = ''
  if (ready) {
    if (phase === 'betting') {
      call = BETS_MS - offset <= LAST_CALL_MS ? 'Últimas apuestas' : 'Apuesta antes del despegue'
      if (broke) detail = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
      else if (stake > 0) {
        const target = auto ? ` · retiro automático a ${fmtMult(auto)}` : ''
        detail = sending || dirty ? `Enviando ${eur(stake)}…` : `Apuesta aceptada: ${eur(stake)}${target}.`
      } else detail = 'Elige una ficha y súmala a tu apuesta.'
    } else if (!exploded) {
      call = boom === null && flown >= FLIGHT_MS ? 'Aterrizando…' : 'En vuelo'
      if (mine) detail = `Retiraste a ${fmtMult(mine.mult)}: +${eur(mine.payout)}.`
      else if (autoHit) detail = `Retiro automático a ${fmtMult(live.auto)}: cobras ${eur(payout(inPlay, live.auto))}.`
      else if (inPlay > 0) detail = `Si retiras ya: ${eur(payout(inPlay, now))}.`
      else detail = 'Mira el vuelo y apuesta en la siguiente ronda.'
    } else {
      call = `Explotó en ${fmtMult(boom)}`
      if (mine) detail = mine.net > 0 ? `¡Has ganado ${eur(mine.net)}! Felicidades.` : `Perdiste ${eur(-mine.net)}.`
      else if (inPlay > 0) detail = `Perdiste ${eur(inPlay)}.`
      else detail = 'Prepárate para la siguiente ronda.'
    }
    if (juegos.error) detail = juegos.error
  }

  return (
    <main className="app crash-live">
      <header className="top">
        <h1>Cohete</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd className={won ? 'money__up' : ''}>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>En juego</dt>
              <dd>{eur(phase === 'betting' ? stake : inPlay)}</dd>
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
                Es en vivo: el cohete es el mismo para todos y despega cada 30 segundos. Tienes 10 segundos para apostar; al
                despegar, el multiplicador sube desde 1,00× hasta un máximo de 25×.
              </p>
              <p>
                Pulsa <strong>Retirar</strong> (o la barra espaciadora) antes de que explote y cobras tu apuesta por el
                multiplicador de ese momento. Si explota antes, la pierdes.
              </p>
              <p>
                Con el retiro automático, el servidor retira por ti en cuanto el cohete llega a ese multiplicador, aunque cierres
                la pestaña.
              </p>
              <p>
                Nadie sabe dónde explotará: lo decide el servidor al azar. Retires cuando retires, de media se recupera el{' '}
                {Math.round(HOUSE * 100)} % de lo apostado, y algunas rondas explotan nada más despegar.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="floor fill">
        <section className="side crash__side">
          <Sky clock={clock} round={round} boom={boom} />
          <div className="recent crash__recent">
            <h2>Últimas explosiones</h2>
            {shownCrashes.length === 0 ? (
              <p>Todavía no ha despegado ninguno.</p>
            ) : (
              <ol>
                {shownCrashes.slice(0, 14).map((mult, i) => (
                  <li key={`${round}-${i}`} className={`burst burst--${toneOf(mult)}`}>
                    {fmtMult(mult)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="play">
          <div className="dealer">
            <Countdown phase={ready ? phase : 'flight'} offset={offset} />
            <p className={`status ${won ? 'status--win' : ''}`} aria-live="polite">
              <strong>{call}</strong>
              {detail && <span>{detail}</span>}
            </p>
            <p className="dealer__players">{players > 0 ? `${plural(players, 'jugador', 'jugadores')} en este vuelo` : 'En vivo'}</p>
          </div>

          <div className="crash__panel">
            <button type="button" className="cashout" disabled={!canCashout} onClick={cashout}>
              {inPlay > 0 && !exploded && phase !== 'betting' ? (
                <>
                  <span>Retirar</span>
                  <small>{eur(payout(inPlay, autoHit ? live.auto : now))}</small>
                </>
              ) : (
                <span>{mine && mine.net > 0 ? `Retirado a ${fmtMult(mine.mult)}` : 'Retirar'}</span>
              )}
            </button>

            <div className="crash__stake">
              <span>Tu apuesta</span>
              <strong>{eur(stake)}</strong>
            </div>

            <fieldset className="crash__auto" disabled={!betting}>
              <legend>Retiro automático</legend>
              <div className="crash__autos">
                <button type="button" aria-pressed={auto === null} onClick={() => dispatch({ type: 'AUTO', auto: null })}>
                  No
                </button>
                {AUTOS.map((value) => (
                  <button key={value} type="button" aria-pressed={auto === value} onClick={() => dispatch({ type: 'AUTO', auto: value })}>
                    {fmtMult(value)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="controls">
            <div className="chips" role="group" aria-label="Valor de la ficha">
              {CHIPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`chip chip--bj${value}`}
                  aria-pressed={chip === value}
                  disabled={available < value}
                  onClick={() => dispatch({ type: 'SELECT_CHIP', chip: value })}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="actions">
              <button
                type="button"
                className="primary"
                disabled={!betting || broke || chip > available}
                onClick={() => {
                  playChip()
                  dispatch({ type: 'ADD', available })
                }}
              >
                Sumar {chip}
              </button>
              {canRepeat ? (
                <button type="button" onClick={() => dispatch({ type: 'REPEAT', available })}>
                  Repetir {eur(state.last)}
                </button>
              ) : (
                <>
                  <button type="button" disabled={!betting || stake === 0 || stake > available} onClick={() => dispatch({ type: 'DOUBLE', available })}>
                    Doblar
                  </button>
                  <button type="button" disabled={!betting || stake === 0} onClick={() => dispatch({ type: 'CLEAR' })}>
                    Quitar
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {won && (
        <WinBurst
          key={round}
          amount={mine.net}
          caption={`Retiraste a ${fmtMult(mine.mult)}`}
          coins={Math.min(70, Math.round(20 + (mine.mult / 100) * 4))}
          big={mine.mult >= 1000}
          who={juegos.me?.name}
          tags={[mine.auto && 'Retiro automático', mine.mult >= MAX_MULT - 100 && '¡Casi en órbita!'].filter(Boolean)}
        />
      )}
      <WinToast wins={othersWon} />
    </main>
  )
}

export default Crash
