import { useEffect, useReducer, useState } from 'react'
import {
  CHIPS,
  SEGMENT,
  STRAIGHT_PAYS,
  WHEEL,
  colorOf,
  initialState,
  reducer,
  streakBonus,
  totalOf,
  totalsById,
} from './roulette.js'
import { eur } from './money.js'
import { isMuted, playChip, playLose, playSpin, playWin, playZap, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'

const COLOR_NAMES = { red: 'rojo', black: 'negro', green: 'verde' }
const mod = (a, n) => ((a % n) + n) % n
const listOf = (items) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : `${items[0]}`

// Cada casilla lleva su posición en la mesa horizontal (c, r) y la columna
// que ocupa cuando la mesa se gira a vertical en pantallas estrechas (mc).
const CELLS = [
  { id: 'n:0', n: 0, label: '0', tone: 'green', c: 1, r: 1, cs: 1, rs: 3, mc: 1 },
  ...Array.from({ length: 36 }, (_, i) => {
    const n = i + 1
    const r = 3 - ((n - 1) % 3)
    return { id: `n:${n}`, n, label: `${n}`, tone: colorOf(n), c: Math.ceil(n / 3) + 1, r, mc: 4 - r }
  }),
  ...[1, 2, 3].map((k) => ({
    id: `col:${k}`,
    label: '2 a 1',
    name: `Columna ${k}`,
    c: 14,
    r: 4 - k,
    mc: k,
  })),
  ...[1, 2, 3].map((k) => ({
    id: `dozen:${k}`,
    label: `${k}ª docena`,
    c: 2 + (k - 1) * 4,
    r: 4,
    cs: 4,
    mc: 4,
  })),
  ...[
    { id: 'low', label: '1 a 18' },
    { id: 'even', label: 'Par' },
    { id: 'red', label: 'Rojo', diamond: 'red' },
    { id: 'black', label: 'Negro', diamond: 'black' },
    { id: 'odd', label: 'Impar' },
    { id: 'high', label: '19 a 36' },
  ].map((cell, i) => ({ ...cell, c: 2 + i * 2, r: 5, cs: 2, mc: 5 })),
]

const polar = (deg, radius) => {
  const rad = (deg * Math.PI) / 180
  return `${(radius * Math.sin(rad)).toFixed(3)} ${(-radius * Math.cos(rad)).toFixed(3)}`
}

function pocketPath(index) {
  const from = (index - 0.5) * SEGMENT
  const to = (index + 0.5) * SEGMENT
  return `M ${polar(from, 84)} A 84 84 0 0 1 ${polar(to, 84)} L ${polar(to, 46)} A 46 46 0 0 0 ${polar(from, 46)} Z`
}

function Wheel({ disc, ball, ms, spinning }) {
  return (
    <div
      className={`wheel ${spinning ? 'wheel--spinning' : ''}`}
      style={{ '--spin': `${ms}ms` }}
      role="img"
      aria-label="Rueda de la ruleta"
    >
      <svg viewBox="-100 -100 200 200" aria-hidden="true">
        <circle r="100" className="wheel__wood" />
        <circle r="90" className="wheel__track" />
        <circle r="97" className="wheel__trim" />
      </svg>
      <svg
        viewBox="-100 -100 200 200"
        className="wheel__disc"
        style={{ transform: `rotate(${disc}deg)` }}
        aria-hidden="true"
      >
        {WHEEL.map((n, i) => (
          <g key={n}>
            <path d={pocketPath(i)} className={`pocket pocket--${colorOf(n)}`} />
            <text transform={`rotate(${i * SEGMENT}) translate(0 -73)`} className="pocket__number">
              {n}
            </text>
          </g>
        ))}
        <circle r="54" className="wheel__well" />
        <circle r="46" className="wheel__cone" />
        <path d="M -34 0 H 34 M 0 -34 V 34" className="wheel__spokes" />
        {[0, 90, 180, 270].map((deg) => (
          <circle key={deg} r="4.5" transform={`rotate(${deg}) translate(0 -34)`} className="wheel__knob" />
        ))}
        <circle r="11" className="wheel__knob" />
      </svg>
      <div className="wheel__orbit" style={{ transform: `rotate(${ball}deg)` }}>
        <span className="wheel__ball" />
      </div>
    </div>
  )
}

function Table({ totals, result, lucky, disabled, onPlace }) {
  const luckyOrder = Object.keys(lucky)
  return (
    <div className="felt">
      {CELLS.map((cell) => {
        const amount = totals[cell.id]
        const hit = result !== null && cell.n === result
        const boost = cell.n !== undefined ? lucky[cell.n] : undefined
        const name = cell.name ?? cell.label
        return (
          <button
            key={cell.id}
            type="button"
            className={`cell ${cell.tone ? `cell--${cell.tone}` : 'cell--outside'} ${
              cell.id.startsWith('col:') ? 'cell--column' : ''
            } ${hit ? 'cell--hit' : ''} ${boost ? 'cell--lucky' : ''}`}
            style={{
              '--c': cell.c,
              '--r': cell.r,
              '--cs': cell.cs ?? 1,
              '--rs': cell.rs ?? 1,
              '--mc': cell.mc,
              '--z': boost ? luckyOrder.indexOf(`${cell.n}`) : 0,
            }}
            disabled={disabled}
            aria-label={amount ? `${name}, apostado ${eur(amount)}` : name}
            onClick={() => onPlace(cell.id)}
          >
            {cell.diamond && <span className={`diamond diamond--${cell.diamond}`} />}
            <span className="cell__label">{cell.label}</span>
            {boost && <span className="boost">×{boost}</span>}
            {amount && <span className="stack">{amount}</span>}
          </button>
        )
      })}
    </div>
  )
}

// La tirada la sortea el servidor con el saldo semanal (cuenta en el Score); aquí solo se apuesta y se anima la rueda.
function Roulette({ onExit, juegos }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [wheel, setWheel] = useState({ disc: 0, ball: 0, ms: 4000 })
  const [turbo, setTurbo] = useState(false)
  // En móvil la rueda sale encima de la mesa mientras gira y un momento después.
  const [wheelUp, setWheelUp] = useState(false)
  const [sound, setSound] = useState(() => !isMuted())
  const { bank, chip, placed, lastPlaced, phase, lucky, result, net, bonus, boosted, streak, spins, history } = state
  const { request } = juegos
  const balance = juegos.me?.balance

  const spinning = phase !== 'betting'
  const onTable = totalOf(placed)
  const lastTotal = totalOf(lastPlaced)
  const canRepeat = placed.length === 0 && lastTotal > 0 && lastTotal <= bank
  const broke = !spinning && bank === 0 && onTable === 0
  const won = !spinning && result !== null && net > 0
  const big = won && net >= lastTotal * 10
  // Cuanto mayor es el premio respecto a lo apostado, más fichas saltan.
  const coins = Math.min(70, Math.round(24 + (net / Math.max(lastTotal, 1)) * 6))
  const nextBonus = Math.round(streakBonus(streak + 1) * 100)
  const shownBank = useCountUp(bank)

  useEffect(() => {
    if (!spinning) return
    const timer = setTimeout(() => dispatch({ type: 'SETTLE' }), wheel.ms + 350)
    return () => clearTimeout(timer)
  }, [spinning, wheel.ms])

  useEffect(() => {
    if (spinning || !wheelUp) return
    const timer = setTimeout(() => setWheelUp(false), 1600)
    return () => clearTimeout(timer)
  }, [spinning, wheelUp])

  useEffect(() => {
    if (spins === 0) return
    if (net > 0) playWin(big)
    else playLose()
  }, [spins, net, big])

  // Saldo de la semana y racha guardada en el servidor.
  useEffect(() => {
    if (balance !== undefined) dispatch({ type: 'SYNC', balance })
  }, [balance])
  useEffect(() => {
    request({ t: 'solo_state' }).then((body) => {
      if (body?.soloState) dispatch({ type: 'SYNC', balance: body.me.balance, streak: body.soloState.streak })
    })
  }, [request])

  async function spin() {
    if (spinning) return
    const bets = placed.length > 0 ? placed : canRepeat ? lastPlaced : null
    if (!bets) return
    dispatch({ type: 'ASK' })
    const body = await request({ t: 'solo_roulette', bets })
    if (!body?.solo) {
      dispatch({ type: 'REJECTED' })
      return
    }
    const { number } = body.solo
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ms = reduced ? 300 : turbo ? 1800 : 4000
    // La rueda gira en sentido horario y la bola en el contrario; la bola
    // termina sobre el ángulo que ocupa la casilla ganadora al detenerse.
    const disc = wheel.disc + (turbo ? 360 : 720) + Math.random() * 360
    const target = mod(disc + WHEEL.indexOf(number) * SEGMENT, 360)
    const base = wheel.ball - (turbo ? 720 : 1440)
    setWheel({ disc, ball: base - mod(base - target, 360), ms })
    dispatch({ type: 'SPIN', result: body.solo })
    setWheelUp(true)
    playSpin(ms)
    playZap()
  }

  function place(id) {
    if (bank >= chip) playChip()
    dispatch({ type: 'PLACE', id })
  }

  // Espacio gira. Si el foco está en un botón por teclado, se respeta su acción.
  useEffect(() => {
    const onKey = (event) => {
      if (event.code !== 'Space' || event.repeat) return
      if (event.target instanceof Element && event.target.matches('button:focus-visible')) return
      event.preventDefault()
      if (event.type === 'keydown') spin()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  })

  let status = 'Elige una ficha y toca la mesa para apostar.'
  if (phase === 'waiting') status = 'No va más…'
  else if (spinning) status = `No va más. Relámpago en ${listOf(Object.keys(lucky))}.`
  else if (juegos.error) status = juegos.error
  else if (broke) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
  else if (onTable > 0) status = `Tienes ${eur(onTable)} en la mesa.`
  else if (result !== null) {
    const outcome = net > 0 ? `Ganaste ${eur(net)}.` : net < 0 ? `Perdiste ${eur(-net)}.` : 'Quedaste igual.'
    status = `Salió el ${result}, ${COLOR_NAMES[colorOf(result)]}. ${outcome}`
  }

  return (
    <main className="app">
      <header className="top">
        <h1>Ruleta</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd className={won ? 'money__up' : ''}>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>En la mesa</dt>
              <dd>{eur(onTable)}</dd>
            </div>
            <div>
              <dt>Racha</dt>
              <dd className={streak >= 2 ? 'money__hot' : ''}>
                {streak}
                {nextBonus > 0 && <small>+{nextBonus}% si ganas</small>}
              </dd>
            </div>
          </dl>
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
            <button type="button" aria-pressed={turbo} onClick={() => setTurbo(!turbo)}>
              Turbo
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
                Elige una ficha y toca la mesa para apostar; pulsa <kbd>Espacio</kbd> o «Girar» para lanzar la bola.
              </p>
              <p>
                En cada tirada caen de 1 a 3 números relámpago: si aciertas uno a pleno, paga entre 50 y 150 a 1.
              </p>
              <p>Cada victoria seguida en la que al menos duplicas lo apostado suma un 5% extra a la siguiente, hasta un 15%.</p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
              <h3>Pagos</h3>
              <p>
                Pleno {STRAIGHT_PAYS} a 1 · Docena y columna 2 a 1 · Rojo, negro, par, impar, 1-18 y 19-36: 1 a 1.
              </p>
            </Help>
          </div>
        </div>
      </header>

      <div className={`floor fill ${big ? 'floor--shake' : ''}`}>
        <section className={`side ${wheelUp ? 'side--up' : ''}`}>
          <Wheel disc={wheel.disc} ball={wheel.ball} ms={wheel.ms} spinning={spinning} />
          <div className="recent">
            <h2>Últimos números</h2>
            {history.length === 0 ? (
              <p>Todavía no ha salido ninguno.</p>
            ) : (
              <ol>
                {history.map((n, i) => (
                  <li key={spins - i} className={`tile tile--${colorOf(n)}`}>
                    {n}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="play">
          <p className={`status ${won && onTable === 0 ? 'status--win' : ''}`} aria-live="polite">
            {status}
          </p>

          <Table
            totals={totalsById(placed)}
            result={result}
            lucky={lucky}
            disabled={spinning || broke}
            onPlace={place}
          />

          <div className="controls">
            <div className="chips" role="group" aria-label="Valor de la ficha">
              {CHIPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`chip chip--${value}`}
                  aria-pressed={chip === value}
                  disabled={spinning || bank < value}
                  onClick={() => dispatch({ type: 'SELECT_CHIP', chip: value })}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="actions">
              {broke ? null : (
                <>
                  {canRepeat ? (
                    <button type="button" disabled={spinning} onClick={() => dispatch({ type: 'REPEAT' })}>
                      Repetir apuesta
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={spinning || placed.length === 0}
                        onClick={() => dispatch({ type: 'UNDO' })}
                      >
                        Deshacer
                      </button>
                      <button
                        type="button"
                        disabled={spinning || placed.length === 0}
                        onClick={() => dispatch({ type: 'CLEAR' })}
                      >
                        Quitar todo
                      </button>
                      <button
                        type="button"
                        disabled={spinning || onTable === 0 || onTable > bank}
                        onClick={() => dispatch({ type: 'DOUBLE' })}
                      >
                        Doblar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="primary"
                    disabled={spinning || (placed.length === 0 && !canRepeat)}
                    onClick={spin}
                  >
                    {canRepeat ? 'Repetir y girar' : 'Girar'}
                  </button>
                </>
              )}
            </div>
          </div>

        </section>
      </div>

      {won && (
        <WinBurst
          key={spins}
          amount={net}
          caption={`Ganaste con el ${result}`}
          coins={coins}
          big={big}
          tags={[
            boosted && `Relámpago ×${boosted}`,
            bonus > 0 && `Racha de ${streak}: +${eur(bonus)} extra`,
          ].filter(Boolean)}
        />
      )}
    </main>
  )
}

export default Roulette
