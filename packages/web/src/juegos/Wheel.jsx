import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import { BETS_MS, CHIPS, HOUSE, MAX_TOTAL, MULTS, ROUND_MS, SEGMENTS, SPIN_MS, WHEEL, fmtMult, phaseAt, totalOf } from './wheel.js'
import { eur } from './money.js'
import { isMuted, playChip, playLose, playSpin, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import PowerButton from './PowerButton.jsx'
import './Wheel.css'

const N = WHEEL.length
const SLICE = 360 / N
const SEND_MS = 250
const TURNS = 6 // vueltas completas antes de pararse

// Ángulo (grados) al que hay que girar la rueda para que la casilla `index` quede bajo la flecha de arriba.
const angleFor = (index) => -(index * SLICE + SLICE / 2)

// La rueda dibujada en SVG: una porción por casilla, con su multiplicador.
function WheelArt({ rotate, spinning, hit }) {
  const R = 200
  const slices = useMemo(
    () =>
      WHEEL.map((m, i) => {
        const a0 = ((i * SLICE - 90) * Math.PI) / 180
        const a1 = (((i + 1) * SLICE - 90) * Math.PI) / 180
        const d = `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`
        const mid = i * SLICE + SLICE / 2
        return { m, d, mid }
      }),
    [],
  )
  return (
    <div className="wheel-art">
      <span className="wheel-art__pointer" aria-hidden="true" />
      <svg viewBox="-215 -215 430 430" role="img" aria-label="Rueda de la fortuna">
        <circle r="212" className="wheel-art__rim" />
        <g className={`wheel-art__disc ${spinning ? 'is-spinning' : ''}`} style={{ transform: `rotate(${rotate}deg)` }}>
          {slices.map(({ m, d, mid }, i) => (
            <g key={i} className={hit === i ? 'is-hit' : ''}>
              <path d={d} fill={SEGMENTS[m].color} className="wheel-art__slice" />
              <text transform={`rotate(${mid}) translate(0 -168) rotate(90)`} className={`wheel-art__label ${m === 48 ? 'is-top' : ''}`}>
                {m}
              </text>
            </g>
          ))}
          {Array.from({ length: N }, (_, i) => {
            const a = ((i * SLICE - 90) * Math.PI) / 180
            return <circle key={i} cx={203 * Math.cos(a)} cy={203 * Math.sin(a)} r="3" className="wheel-art__peg" />
          })}
        </g>
        <circle r="46" className="wheel-art__hub" />
        <text className="wheel-art__hub-text" y="2">
          TopCode
        </text>
      </svg>
    </div>
  )
}

// Rueda en vivo: una para todos cada ROUND_MS. El servidor sortea y paga; aquí se apuesta y se anima con su reloj.
function Wheel({ onExit, juegos }) {
  const [sound, setSound] = useState(() => !isMuted())
  const [live, setLive] = useState(null)
  const [chip, setChip] = useState(CHIPS[1])
  const [placed, setPlaced] = useState([]) // [{ mult, amount }]
  const [confirmed, setConfirmed] = useState([])
  const [betRound, setBetRound] = useState(null)
  const [sending, setSending] = useState(false)
  const [, setTick] = useState(0)
  const skew = useRef(null)
  const seq = useRef(0)
  const applied = useRef(0)
  const soundRound = useRef(null)
  const spunRound = useRef(null)
  const { request } = juegos

  const clock = useCallback(() => Date.now() + (skew.current ?? 0), [])
  const now = clock()
  const { round, offset, phase } = phaseAt(now)
  const ready = skew.current !== null

  const ask = useCallback(
    async (message) => {
      const n = ++seq.current
      const sent = Date.now()
      const body = await request({ t: 'solo_wheel', ...message })
      const got = Date.now()
      const view = body?.solo
      if (view) {
        if (skew.current === null || got - sent < 1500) skew.current = view.now - (sent + got) / 2
        if (n > applied.current) {
          applied.current = n
          setLive(view)
        }
      }
      return body
    },
    [request],
  )
  const sync = useEffectEvent(() => {
    if (document.visibilityState === 'visible') ask({ a: 'sync' })
  })

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 200)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    ask({ a: 'sync' })
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [ask, sync])

  // Ronda nueva: se vacía el tapete. Al cerrarse las apuestas, se pide la casilla; al pararse la rueda, el resultado.
  useEffect(() => {
    if (!ready) return
    setBetRound(round)
    setPlaced([])
    setConfirmed([])
    const toReveal = Math.max(150, round * ROUND_MS + BETS_MS + 750 - clock())
    const toResult = Math.max(150, round * ROUND_MS + BETS_MS + SPIN_MS + 500 - clock())
    const timers = [setTimeout(sync, 150), setTimeout(sync, toReveal), setTimeout(sync, toResult)]
    return () => timers.forEach(clearTimeout)
  }, [ready, round, sync, clock])

  // Apuestas que el servidor ya tenía (tras recargar).
  useEffect(() => {
    if (live?.round === round && live.bets?.length && placed.length === 0 && confirmed.length === 0) {
      setPlaced(live.bets)
      setConfirmed(live.bets)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  const view = live?.round === round ? live : null
  const index = view?.index ?? null
  const balance = live?.balance ?? juegos.me?.balance ?? 0
  const pending = totalOf(placed) - totalOf(confirmed)
  const available = Math.max(0, balance - pending)
  const onTable = totalOf(placed)
  const betting = ready && phase === 'betting' && betRound === round
  const dirty = JSON.stringify(placed) !== JSON.stringify(confirmed)

  // Se confirman con el servidor poco después de tocar (de una en una).
  useEffect(() => {
    if (!dirty || sending || !betting) return
    const timer = setTimeout(async () => {
      setSending(true)
      const bets = placed
      const body = await ask({ a: 'bet', round, bets })
      setSending(false)
      if (body?.solo) setConfirmed(bets)
      else setPlaced(confirmed)
    }, SEND_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, sending, betting, placed, round])

  const add = (mult) => {
    if (!betting || chip > available || onTable + chip > MAX_TOTAL) return
    playChip()
    setPlaced((list) => {
      const at = list.findIndex((b) => b.mult === mult)
      if (at < 0) return [...list, { mult, amount: chip }]
      return list.map((b, i) => (i === at ? { ...b, amount: b.amount + chip } : b))
    })
  }

  // Giro: durante SPIN_MS la rueda frena hasta la casilla; antes y después, quieta (o despacio en apuestas).
  const spinning = phase === 'spin' && index !== null
  const [rotate, setRotate] = useState(0)
  useEffect(() => {
    if (index === null) return
    const target = angleFor(index) - TURNS * 360
    if (phase === 'spin' && spunRound.current !== round) {
      spunRound.current = round
      setRotate(0)
      // Un fotograma para que el navegador vea el punto de partida antes de animar.
      requestAnimationFrame(() => requestAnimationFrame(() => setRotate(target)))
      if (!isMuted()) playSpin(SPIN_MS - 400)
    } else if (phase === 'result') setRotate(target)
  }, [index, phase, round])

  const last = live?.last ?? null
  const fresh = last && last.round === round && phase === 'result'
  useEffect(() => {
    if (!fresh || soundRound.current === last.round) return
    soundRound.current = last.round
    if (last.net > 0) playWin(last.mult >= 16)
    else if (last.net < 0) playLose()
  }, [fresh, last])

  const shownBank = useCountUp(available)
  const left = phase === 'betting' ? Math.ceil((BETS_MS - offset) / 1000) : 0
  const shownMult = phase === 'result' && index !== null ? WHEEL[index] : null
  let call = 'Conectando…'
  if (ready) {
    if (phase === 'betting') call = left <= 3 ? '¡Últimos segundos!' : 'Hagan sus apuestas'
    else if (phase === 'spin') call = '¡Gira la rueda!'
    else call = shownMult ? `Ha salido el ${fmtMult(shownMult)}` : 'Resultado'
  }
  let detail = ''
  if (fresh) detail = last.net > 0 ? `¡Ganas ${eur(last.net)}!` : last.net < 0 ? `Pierdes ${eur(-last.net)}.` : 'Recuperas lo apostado.'
  else if (onTable > 0) detail = `Juegas ${eur(onTable)}${dirty || sending ? ' (enviando…)' : ''}.`
  else if (phase === 'betting') detail = 'Elige ficha y toca un multiplicador.'
  else detail = 'Siguiente ronda en unos segundos.'

  return (
    <main className="app wheel-app">
      <header className="top">
        <h1>Rueda</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>En juego</dt>
              <dd>{eur(onTable)}</dd>
            </div>
          </dl>
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
            <PowerButton request={juegos.request} game="wheel" hit={juegos.powerHit} />
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
                Es en vivo: la rueda es la misma para todos y gira cada {ROUND_MS / 1000} segundos. Tienes {BETS_MS / 1000} segundos
                para apostar a uno o varios multiplicadores.
              </p>
              <p>
                Si la rueda se para en una casilla de tu multiplicador, cobras tu apuesta por él (×2 = el doble). Cuanto más
                grande, menos casillas tiene: el ×2 sale casi la mitad de las veces y el ×48, una de cada 50.
              </p>
              <p>
                Apuestes a lo que apuestes, de media se recupera el {Math.round(HOUSE * 100)} %. Juegas con tu saldo de la semana:
                cuenta en el Score.
              </p>
            </Help>
          </div>
        </div>
      </header>

      <div className="wheel fill">
        <section className="wheel__stage" aria-label="Rueda">
          <WheelArt rotate={rotate} spinning={spinning} hit={phase === 'result' ? index : null} />
          <div className={`wheel__call ${fresh && last.net > 0 ? 'is-win' : ''}`} aria-live="polite">
            <span className="wheel__count" aria-hidden="true">
              {phase === 'betting' ? left : phase === 'spin' ? '…' : shownMult ? fmtMult(shownMult) : '•'}
            </span>
            <strong>{call}</strong>
            <span>{detail}</span>
          </div>
          {phase === 'betting' && <span className="wheel__fuse" style={{ '--left': 1 - offset / BETS_MS }} aria-hidden="true" />}
        </section>

        <aside className="wheel__panel">
          <div className="wheel__history" aria-label="Últimas tiradas">
            {(live?.history ?? []).slice(0, 12).map((m, i) => (
              <span key={i} className="wheel__past" style={{ '--c': SEGMENTS[m].color }}>
                {fmtMult(m)}
              </span>
            ))}
          </div>

          <div className="wheel__bets" role="group" aria-label="Apuestas">
            {MULTS.map((m) => {
              const bet = placed.find((b) => b.mult === m)
              const won = fresh && last.mult === m && last.bets.some((b) => b.mult === m)
              return (
                <button
                  key={m}
                  type="button"
                  className={`wheel__bet ${bet ? 'has-bet' : ''} ${won ? 'is-won' : ''} ${shownMult === m ? 'is-out' : ''}`}
                  style={{ '--c': SEGMENTS[m].color }}
                  disabled={!betting}
                  onClick={() => add(m)}
                >
                  <b>{fmtMult(m)}</b>
                  <small>
                    {SEGMENTS[m].count} {SEGMENTS[m].count === 1 ? 'casilla' : 'casillas'}
                  </small>
                  {bet && <span className="wheel__chip">{eur(bet.amount)}</span>}
                </button>
              )
            })}
          </div>

          <div className="chips" role="group" aria-label="Valor de la ficha">
            {CHIPS.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip chip--bj${value}`}
                aria-pressed={chip === value}
                disabled={available < value}
                onClick={() => setChip(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="actions">
            <button type="button" disabled={!betting || onTable === 0} onClick={() => setPlaced([])}>
              Quitar
            </button>
            <button
              type="button"
              disabled={!betting || onTable === 0 || onTable * 2 > MAX_TOTAL || onTable > available}
              onClick={() => setPlaced((list) => list.map((b) => ({ ...b, amount: b.amount * 2 })))}
            >
              Doblar
            </button>
          </div>
        </aside>
      </div>

      {fresh && last.net > 0 && (
        <WinBurst
          key={last.round}
          amount={last.net}
          caption={`Salió el ${fmtMult(last.mult)}`}
          coins={Math.min(70, 20 + last.mult * 2)}
          big={last.mult >= 16}
          who={juegos.me?.name}
        />
      )}
    </main>
  )
}

export default Wheel
