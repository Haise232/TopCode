import { useEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import { BETS, MULTIPLIERS, RISKS, ROWS } from './plinko.js'
import { eur } from './money.js'
import { isMuted, playChip, playLose, playPeg, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import PowerButton from './PowerButton.jsx'
import './Plinko.css'

// Medidas del tablero (unidades del viewBox): S es la distancia entre clavos.
const S = 40
const W = (ROWS + 2) * S
const TOP = S * 1.1
const ROW_GAP = S * 0.88
const PEG_R = 4.2
const BALL_R = 8.5
const SLOT_Y = TOP + (ROWS - 1) * ROW_GAP + S * 0.95
const SLOT_H = S * 0.9
const H = SLOT_Y + SLOT_H + 6
const ROW_MS = 165
const MAX_BALLS = 12
const HISTORY = 14

const pegY = (row) => TOP + row * ROW_GAP
// Clavo j de la fila r: cada fila tiene r + 3 clavos, centrados.
const pegX = (row, j) => W / 2 + (j - (row + 2) / 2) * S
// Centro de la casilla k (0 a ROWS).
const slotX = (k) => W / 2 + (k - ROWS / 2) * S
const fmt = (mult) => `${mult.toLocaleString('es-ES')}×`

// Color de una casilla según lo que paga: de las orillas (calientes) al centro (fríos).
function toneOf(mult) {
  if (mult >= 10) return 'hot'
  if (mult >= 3) return 'warm'
  if (mult >= 1.5) return 'gold'
  if (mult >= 1) return 'even'
  return 'cold'
}

// Fotogramas de una bola: toca un clavo en cada fila, da un saltito y cae al siguiente hueco.
function framesOf(path) {
  const frames = [{ transform: `translate(${W / 2}px, ${TOP - S}px)`, offset: 0, easing: 'ease-in' }]
  const total = ROWS + 1.2
  let rights = 0
  path.forEach((step, row) => {
    const x = W / 2 + (rights - row / 2) * S
    const y = pegY(row) - PEG_R - BALL_R
    frames.push({ transform: `translate(${x}px, ${y}px)`, offset: (row + 0.7) / total, easing: 'ease-out' })
    const nextX = x + (step ? S / 2 : -S / 2)
    frames.push({ transform: `translate(${(x + nextX) / 2}px, ${y - S * 0.2}px)`, offset: (row + 0.95) / total, easing: 'ease-in' })
    rights += step
  })
  frames.push({ transform: `translate(${slotX(rights)}px, ${SLOT_Y + SLOT_H * 0.45}px)`, offset: 1 })
  return frames
}

// Una bola en vuelo. El recorrido ya lo decidió el servidor: aquí solo se anima.
function Ball({ ball, reduced, onPeg, onLand }) {
  const ref = useRef(null)
  const land = useEffectEvent(() => onLand(ball))
  const peg = useEffectEvent((row, j) => onPeg(row, j))
  useEffect(() => {
    const duration = reduced ? 500 : (ROWS + 1.2) * ROW_MS
    const animation = ref.current.animate(framesOf(ball.path), { duration, fill: 'forwards' })
    animation.onfinish = () => land()
    const timers = []
    if (!reduced) {
      let rights = 0
      ball.path.forEach((step, row) => {
        const j = rights + 1
        timers.push(setTimeout(() => peg(row, j), ((row + 0.7) / (ROWS + 1.2)) * duration))
        rights += step
      })
    }
    return () => {
      animation.onfinish = null
      animation.cancel()
      timers.forEach(clearTimeout)
    }
  }, [ball, reduced])
  return (
    <g ref={ref} className="plinko__ball" style={{ transform: `translate(${W / 2}px, ${TOP - S}px)` }}>
      <circle r={BALL_R} />
      <circle r={BALL_R * 0.35} cx={-BALL_R * 0.3} cy={-BALL_R * 0.3} className="plinko__shine" />
    </g>
  )
}

// La bola la sortea el servidor con el saldo semanal (cuenta en el Score); aquí se anima y se pinta el premio.
function Plinko({ onExit, juegos }) {
  const [bet, setBet] = useState(20)
  const [risk, setRisk] = useState('medium')
  const [sound, setSound] = useState(() => !isMuted())
  const [balls, setBalls] = useState([]) // en el aire, con lo que pagarán al caer
  const [asking, setAsking] = useState(false)
  const [history, setHistory] = useState([]) // últimas casillas: { id, mult }
  const [hits, setHits] = useState({}) // casilla → id de la última bola que cayó en ella (para el rebote)
  const [last, setLast] = useState(null) // última bola caída
  const [burst, setBurst] = useState(null)
  const nextId = useRef(1)
  const pegs = useRef(new Map())
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { request } = juegos
  const serverBalance = juegos.me?.balance ?? 0
  // Saldo de la última respuesta: se cambia a la vez que sale la bola, así nunca se ve un instante el premio antes de
  // tiempo. Sin bolas en el aire se sigue el del servidor (puede cambiar jugando en otra mesa).
  const [balance, setBalance] = useState(serverBalance)
  useEffect(() => {
    if (!asking && balls.length === 0) setBalance(serverBalance)
  }, [serverBalance, asking, balls.length])

  // El saldo del servidor ya incluye lo que pagarán las bolas en el aire: se esconde hasta que caen.
  const pendingPay = balls.reduce((sum, b) => sum + b.payout, 0)
  const shownBank = useCountUp(Math.max(0, balance - pendingPay))
  const multipliers = MULTIPLIERS[risk]
  const broke = balls.length === 0 && balance < BETS[0]
  const canDrop = !asking && balls.length < MAX_BALLS && balance >= bet
  // Mientras hay bolas en el aire el riesgo no cambia: el tablero tiene que pintar lo que se apostó.
  const flying = balls.length > 0

  async function drop() {
    if (!canDrop) return
    playChip()
    setBurst(null)
    setAsking(true)
    const body = await request({ t: 'solo_plinko', bet, risk })
    setAsking(false)
    if (!body?.solo) return
    const { path, slot, payout } = body.solo
    setBalance(body.solo.balance)
    setBalls((list) => [...list, { id: nextId.current++, path, slot, payout, bet, risk, mult: MULTIPLIERS[risk][slot] }])
  }
  const onDrop = useEffectEvent(drop)

  function onPeg(row, j) {
    const el = pegs.current.get(`${row}-${j}`)
    if (el) {
      el.classList.remove('is-hit')
      // Fuerza a reiniciar la animación del destello.
      void el.getBoundingClientRect()
      el.classList.add('is-hit')
    }
    playPeg(row)
  }

  function onLand(ball) {
    setBalls((list) => list.filter((b) => b.id !== ball.id))
    setHits((h) => ({ ...h, [ball.slot]: ball.id }))
    setHistory((list) => [{ id: ball.id, mult: ball.mult }, ...list].slice(0, HISTORY))
    setLast(ball)
    if (ball.payout > ball.bet) playWin(ball.mult >= 10)
    else if (ball.payout < ball.bet) playLose()
    if (ball.mult >= 10) setBurst(ball)
  }

  // Espacio suelta una bola. Si el foco está en un botón por teclado, se respeta su acción.
  useEffect(() => {
    const onKey = (event) => {
      if (event.code !== 'Space' || event.repeat) return
      if (event.target instanceof Element && event.target.matches('button:focus-visible')) return
      event.preventDefault()
      if (event.type === 'keydown') onDrop()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  let status = 'Elige tu apuesta y el riesgo, y suelta la bola.'
  if (juegos.error) status = juegos.error
  else if (broke) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
  else if (balance < bet && !flying) status = 'No te alcanza para esta apuesta: elige una menor.'
  else if (last) {
    const net = last.payout - last.bet
    status =
      net > 0
        ? `¡${fmt(last.mult)}! Ganaste ${eur(net)}.`
        : net < 0
          ? `${fmt(last.mult)}: recuperas ${eur(last.payout)} de ${eur(last.bet)}.`
          : `${fmt(last.mult)}: recuperas tu apuesta.`
  }
  const lastWon = last && last.payout > last.bet

  return (
    <main className="app plinko-app">
      <header className="top">
        <h1>Plinko</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd className={lastWon ? 'money__up' : ''}>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>Apuesta</dt>
              <dd>{eur(bet)}</dd>
            </div>
          </dl>
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
            <PowerButton request={juegos.request} game="plinko" hit={juegos.powerHit} />
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
                Suelta una bola: cae por {ROWS} filas de clavos y en cada una rebota a un lado o al otro. La casilla donde
                acaba multiplica tu apuesta.
              </p>
              <p>
                Las orillas pagan mucho y salen poco; el centro sale casi siempre y paga menos de lo apostado. El riesgo
                cambia los premios: con «Bajo» casi nunca pierdes mucho; con «Alto» las orillas pagan hasta{' '}
                {fmt(MULTIPLIERS.high[0])}.
              </p>
              <p>
                Puedes tener hasta {MAX_BALLS} bolas en el aire. Pulsa <kbd>Espacio</kbd> para soltar una.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="plinko fill">
        <section className="plinko__machine" aria-label="Tablero">
          <p className={`status ${lastWon ? 'status--win' : ''}`} aria-live="polite">
            {status}
          </p>
          <div className="plinko__board">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tablero de ${ROWS} filas con riesgo ${RISKS.find((r) => r.id === risk).name.toLowerCase()}`}>
              <defs>
                <radialGradient id="plinko-ball" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#fff6cf" />
                  <stop offset="55%" stopColor="#f0c75a" />
                  <stop offset="100%" stopColor="#a8761d" />
                </radialGradient>
              </defs>
              {Array.from({ length: ROWS }, (_, row) =>
                Array.from({ length: row + 3 }, (_, j) => (
                  <circle
                    key={`${row}-${j}`}
                    ref={(el) => {
                      if (el) pegs.current.set(`${row}-${j}`, el)
                      else pegs.current.delete(`${row}-${j}`)
                    }}
                    className="plinko__peg"
                    cx={pegX(row, j)}
                    cy={pegY(row)}
                    r={PEG_R}
                  />
                )),
              )}
              {multipliers.map((mult, k) => (
                <g
                  key={`${k}-${hits[k] ?? 0}`}
                  className={`plinko__slot plinko__slot--${toneOf(mult)} ${hits[k] ? 'is-hit' : ''}`}
                >
                  <rect x={slotX(k) - S / 2 + 2} y={SLOT_Y} width={S - 4} height={SLOT_H} rx={6} />
                  <text x={slotX(k)} y={SLOT_Y + SLOT_H / 2}>
                    {mult.toLocaleString('es-ES')}
                  </text>
                </g>
              ))}
              {balls.map((ball) => (
                <Ball key={ball.id} ball={ball} reduced={reduced} onPeg={onPeg} onLand={onLand} />
              ))}
            </svg>
          </div>
        </section>

        <aside className="plinko__panel">
          <div className="plinko__group">
            <h2>Riesgo</h2>
            <div className="plinko__seg" role="group" aria-label="Riesgo">
              {RISKS.map(({ id, name }) => (
                <button key={id} type="button" aria-pressed={risk === id} disabled={flying} onClick={() => setRisk(id)}>
                  {name}
                </button>
              ))}
            </div>
            {flying && <p className="plinko__hint">Espera a que caigan las bolas para cambiarlo.</p>}
          </div>

          <div className="plinko__group">
            <h2>Apuesta por bola</h2>
            <div className="bets plinko__bets" role="group" aria-label="Apuesta por bola">
              {BETS.map((value) => (
                <button key={value} type="button" aria-pressed={bet === value} disabled={balance < value} onClick={() => setBet(value)}>
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="actions plinko__drop">
            {!broke && (
              <button type="button" className="primary" disabled={!canDrop} onClick={drop}>
                Soltar bola <kbd>Espacio</kbd>
              </button>
            )}
          </div>

          <div className="plinko__group">
            <h2>Últimas bolas</h2>
            {history.length === 0 ? (
              <p className="plinko__hint">Todavía no has soltado ninguna.</p>
            ) : (
              <ol className="plinko__history">
                {history.map((h) => (
                  <li key={h.id} className={`plinko__chip plinko__chip--${toneOf(h.mult)}`}>
                    {fmt(h.mult)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>

      {burst && (
        <WinBurst
          key={burst.id}
          amount={burst.payout - burst.bet}
          caption={`${fmt(burst.mult)} con ${eur(burst.bet)}`}
          coins={Math.min(70, Math.round(24 + burst.mult * 2))}
          big={burst.mult >= 20}
          who={juegos.me?.name}
        />
      )}
    </main>
  )
}

export default Plinko
