import { useEffect, useReducer, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import { BETS, LINES, MIN_RUN, PAYS, REELS, init, lineRun, reducer, windowOf } from './slots.js'
import { STARTING_BANK, saveWallet } from './wallet.js'
import { isMuted, playChip, playClunk, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import SlotSymbol from './SlotSymbol.jsx'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import './Slots.css'

const SYMBOL_NAMES = {
  cherry: 'cerezas',
  lemon: 'limones',
  bell: 'campanas',
  star: 'estrellas',
  diamond: 'diamantes',
  seven: 'sietes',
  wild: 'comodines',
}
const PAYTABLE = ['seven', 'diamond', 'star', 'bell', 'lemon', 'cherry']

function Paytable({ lineBet }) {
  return (
    <table className="paytable__table">
      <thead>
        <tr>
          <th scope="col">Símbolo</th>
          {[3, 4, 5].map((n) => (
            <th key={n} scope="col">
              x{n}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {PAYTABLE.map((name) => (
          <tr key={name}>
            <th scope="row">
              <SlotSymbol name={name} />
            </th>
            {PAYS[name].map((mult, i) => (
              <td key={i}>${mult * lineBet}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Rules() {
  return (
    <>
      <p>
        Hay {LINES.length} líneas de pago y cada una lleva una parte igual de tu apuesta. Se premian {MIN_RUN}, 4 o 5
        símbolos iguales seguidos desde la izquierda; cada línea premiada paga por separado.
      </p>
      <p className="hint">
        El <SlotSymbol name="wild" /> sustituye a cualquier símbolo y solo sale en los rodillos 2, 3 y 4. Pulsa{' '}
        <kbd>Espacio</kbd> para girar.
      </p>
    </>
  )
}


function Slots({ onExit }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const [turbo, setTurbo] = useState(false)
  const [auto, setAuto] = useState(false)
  const [sound, setSound] = useState(() => !isMuted())
  const { bank, best, bet, stops, landed, phase, wins, payout, paidBet, tier, spins } = state

  const spinning = phase === 'spinning'
  const broke = !spinning && bank < BETS[0]
  const won = !spinning && (tier === 'win' || tier === 'big')
  const big = won && tier === 'big'
  const shownBank = useCountUp(bank)
  const lineBet = bet / LINES.length
  const grid = stops.map((stop, reel) => windowOf(reel, stop))
  // Con cuatro rodillos ya alineados en alguna línea, el último se hace esperar.
  const tease =
    spinning &&
    landed === REELS.length - 1 &&
    LINES.some((rows) => lineRun(rows.slice(0, landed).map((row, reel) => grid[reel][row])).count === landed)

  const winCells = new Set()
  for (const win of wins) {
    LINES[win.line].slice(0, win.count).forEach((row, reel) => winCells.add(`${reel}-${row}`))
  }

  useEffect(() => {
    if (!spinning) return
    let delay = turbo ? 100 : 300
    if (landed === 0) delay = turbo ? 250 : 700
    else if (tease) delay = turbo ? 600 : 1500
    const timer = setTimeout(() => {
      playClunk()
      dispatch({ type: 'LAND' })
    }, delay)
    return () => clearTimeout(timer)
  }, [spinning, landed, tease, turbo])

  useEffect(() => {
    if (tier === 'none') return
    playWin(tier === 'big')
  }, [spins, tier])

  useEffect(() => {
    saveWallet({ bank, best })
  }, [bank, best])

  function spin() {
    if (spinning || bank < bet) return
    playChip()
    dispatch({ type: 'SPIN', stops: REELS.map((strip) => Math.floor(Math.random() * strip.length)) })
  }
  const onSpin = useEffectEvent(spin)

  // Giro automático: vuelve a tirar solo, dejando ver los premios.
  useEffect(() => {
    if (!auto || spinning || bank < bet) return
    const timer = setTimeout(onSpin, tier === 'win' || tier === 'big' ? 1800 : 450)
    return () => clearTimeout(timer)
  }, [auto, spinning, bank, bet, tier])

  // Espacio gira. Si el foco está en un botón por teclado, se respeta su acción.
  useEffect(() => {
    const onKey = (event) => {
      if (event.code !== 'Space' || event.repeat) return
      if (event.target instanceof Element && event.target.matches('button:focus-visible')) return
      event.preventDefault()
      if (event.type === 'keydown') onSpin()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  let status = 'Elige tu apuesta y gira.'
  if (spinning) status = tease ? '¡Casi! Falta un rodillo…' : 'Girando…'
  else if (broke) status = 'Te quedaste sin saldo.'
  else if (bank < bet) status = 'No te alcanza para esta apuesta: elige una menor.'
  else if (payout > 0) {
    const lines = wins.map((win) => `${win.count} ${SYMBOL_NAMES[win.symbol]} (línea ${win.line + 1})`)
    status = `Ganaste $${payout}: ${lines.join('; ')}.`
  } else if (spins > 0) status = 'Nada esta vez.'

  return (
    <main className="app">
      <header className="top">
        <h1>Tragamonedas</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo</dt>
              <dd className={won ? 'money__up' : ''}>${shownBank}</dd>
            </div>
            <div>
              <dt>Apuesta</dt>
              <dd>${bet}</dd>
            </div>
            <div>
              <dt>Récord</dt>
              <dd>${best}</dd>
            </div>
          </dl>
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
            <button type="button" aria-pressed={turbo} onClick={() => setTurbo(!turbo)}>
              Turbo
            </button>
            <button type="button" aria-pressed={auto} onClick={() => setAuto(!auto)}>
              Auto
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
            <Help label="Premios" title={`Premios con $${bet} de apuesta`} className="only-narrow">
              <div className="paytable">
                <Paytable lineBet={lineBet} />
              </div>
            </Help>
            <Help title="Cómo se juega">
              <Rules />
            </Help>
          </div>
        </div>
      </header>

      <div className={`slots fill ${big ? 'floor--shake' : ''}`}>
        <section className="machine">
          <p className={`status ${payout > 0 && !spinning ? 'status--win' : ''}`} aria-live="polite">
            {status}
          </p>

          <div className={`reels ${tease ? 'reels--tease' : ''}`}>
            <div className="reels__grid">
              {grid.map((column, reel) => {
                const rolling = spinning && reel >= landed
                return (
                  <div key={reel} className={`reel ${rolling ? 'reel--rolling' : ''}`}>
                    {rolling ? (
                      <div
                        key="strip"
                        className="reel__strip"
                        style={{ '--len': REELS[reel].length, '--speed': `${0.36 + reel * 0.04}s` }}
                      >
                        {[...REELS[reel], ...REELS[reel].slice(0, 3)].map((name, i) => (
                          <div key={i} className="slot">
                            <SlotSymbol name={name} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div key="stop" className="reel__stop">
                        {column.map((name, row) => (
                          <div key={row} className={`slot ${winCells.has(`${reel}-${row}`) ? 'slot--win' : ''}`}>
                            <SlotSymbol name={name} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {!spinning && wins.length > 0 && (
                <svg className="winlines" viewBox={`0 0 ${REELS.length} 3`} preserveAspectRatio="none" aria-hidden="true">
                  {wins.map((win) => (
                    <polyline
                      key={win.line}
                      className={`winline winline--${win.line % 5}`}
                      points={LINES[win.line]
                        .slice(0, win.count)
                        .map((row, reel) => `${reel + 0.5},${row + 0.5}`)
                        .join(' ')}
                    />
                  ))}
                </svg>
              )}
            </div>
          </div>

          <div className="machine__bar">
            <div className="bets" role="group" aria-label="Apuesta por tirada">
              {BETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={bet === value}
                  disabled={spinning || bank < value}
                  onClick={() => dispatch({ type: 'SET_BET', bet: value })}
                >
                  ${value}
                </button>
              ))}
            </div>
            <div className="actions">
              {broke ? (
                <button type="button" className="primary" onClick={() => dispatch({ type: 'RESET' })}>
                  Empezar de nuevo con ${STARTING_BANK}
                </button>
              ) : (
                <button type="button" className="primary" disabled={spinning || bank < bet} onClick={spin}>
                  Girar
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="paytable">
          <h2>Premios con ${bet} de apuesta</h2>
          <Paytable lineBet={lineBet} />
        </aside>
      </div>

      {won && (
        <WinBurst
          key={spins}
          amount={payout}
          caption={`Con $${paidBet} de apuesta`}
          coins={Math.min(70, Math.round(24 + (payout / Math.max(paidBet, 1)) * 3))}
          big={big}
        />
      )}
    </main>
  )
}

export default Slots
