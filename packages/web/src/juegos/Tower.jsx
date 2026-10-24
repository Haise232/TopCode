import { useEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import { MIN_BET, MODES, STEP, chance, clampBet, fmtMult, maxBetFor, multAt, payout } from './tower.js'
import { eur } from './money.js'
import { buzz, isMuted, playCash, playChip, playHop, playLand, playSplash, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import Avatar from './Avatar.jsx'
import './season3.css'

const STEP_MS = 650 // lo que dura la animación de pisar una baldosa
const HISTORY = 12

// La Torre la sortea el servidor con el saldo semanal (cuenta en el Score): cada piso lo pide el jugador y aquí se anima.
function Tower({ onExit, juegos }) {
  const [bet, setBet] = useState(50)
  const [mode, setMode] = useState('normal')
  const [sound, setSound] = useState(() => !isMuted())
  const [run, setRun] = useState(null) // { bet, mode, floor, path } mientras hay una torre en marcha
  const [asking, setAsking] = useState(false)
  const [reveal, setReveal] = useState(null) // { floor, tile, broken, fell } el piso que se acaba de pisar
  const [last, setLast] = useState(null)
  const [history, setHistory] = useState([])
  const [ranking, setRanking] = useState([])
  const [burst, setBurst] = useState(null)
  const [ready, setReady] = useState(false)
  const lock = useRef(false)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { request } = juegos
  const serverBalance = juegos.me?.balance ?? 0
  const [balance, setBalance] = useState(serverBalance)
  useEffect(() => {
    if (!asking && !reveal) setBalance(serverBalance)
  }, [serverBalance, asking, reveal])
  const shownBank = useCountUp(balance)

  const record = (result) => {
    setLast(result)
    setHistory((list) => (list.some((h) => h.id === result.round) ? list : [{ id: result.round, mult: result.net >= 0 ? result.mult : 0 }, ...list].slice(0, HISTORY)))
  }

  const apply = (view) => {
    if (view.ranking) setRanking(view.ranking)
    if (view.bet > 0) {
      setRun({ bet: view.bet, mode: view.mode, floor: view.floor, path: view.path })
      setMode(view.mode)
      setBet(view.bet)
    } else setRun(null)
  }

  const resync = useEffectEvent(async () => {
    const body = await request({ t: 'solo_tower', a: 'sync' })
    const view = body?.solo
    if (!view) return
    apply(view)
    if (view.last) record(view.last)
    setBalance(view.balance)
  })
  useEffect(() => {
    let alive = true
    resync().then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  // El piso que se acaba de pisar se enseña un momento antes de seguir (o de caer).
  useEffect(() => {
    if (!reveal) return
    const timer = setTimeout(() => setReveal(null), reduced ? 250 : reveal.fell ? 1400 : STEP_MS)
    return () => clearTimeout(timer)
  }, [reveal, reduced])

  async function act(message) {
    if (lock.current) return null
    lock.current = true
    setAsking(true)
    const body = await request({ t: 'solo_tower', ...message })
    lock.current = false
    setAsking(false)
    const view = body?.solo ?? null
    if (!view) await resync()
    return view
  }

  const cfg = MODES[run?.mode ?? mode]
  const floor = run?.floor ?? 0
  const maxBet = maxBetFor(balance)
  const shownBet = run ? run.bet : clampBet(bet, maxBet)
  const busy = asking || !ready || Boolean(reveal)
  const canBet = !run && !asking && maxBet >= MIN_BET
  const worth = run && floor > 0 ? payout(run.bet, run.mode, floor) : 0
  const pct = Math.round(chance(run?.mode ?? mode) * 100)

  async function start() {
    if (busy || run || shownBet > balance) return
    playChip()
    setBurst(null)
    setLast(null)
    const view = await act({ a: 'start', bet: shownBet, mode })
    if (!view) return
    setBalance(view.balance)
    apply(view)
  }

  async function pick(tile) {
    if (busy || !run) return
    const at = run.floor + 1
    playHop(at)
    const view = await act({ a: 'pick', tile })
    if (!view) return
    const fell = view.ev === 'fall'
    setReveal({ floor: at, tile, broken: view.step.broken, fell })
    if (fell) {
      playSplash()
      buzz([40, 40, 160])
      setRun((r) => (r ? { ...r, path: [...r.path, view.step] } : r))
      setTimeout(() => {
        apply(view)
        record(view.last)
        setBalance(view.balance)
      }, reduced ? 250 : 1400)
      return
    }
    playLand(at)
    if (view.ev === 'top') {
      apply(view)
      record(view.last)
      setBalance(view.balance)
      finish(view.last)
    } else apply(view)
  }

  async function cash() {
    if (busy || !run || floor < 1) return
    const view = await act({ a: 'cash' })
    if (!view) return
    apply(view)
    record(view.last)
    setBalance(view.balance)
    finish(view.last)
  }

  function finish(result) {
    if (result.net <= 0) return
    playCash(Math.min(10, Math.round(result.mult)))
    playWin(result.mult >= 10)
    buzz([60, 40, 80])
    setBurst({ id: result.round, amount: result.net, mult: result.mult, stake: result.stake, floor: result.floor })
  }

  const onKeys = useEffectEvent((event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.matches('input, select, textarea')) return
    const n = Number(event.key)
    if (run && n >= 1 && n <= cfg.tiles) {
      event.preventDefault()
      pick(n - 1)
    } else if ((event.code === 'KeyC' || event.code === 'Enter') && run) {
      event.preventDefault()
      cash()
    } else if (event.code === 'Space' && !run && !target?.matches('button:focus-visible')) {
      event.preventDefault()
      start()
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKeys)
    return () => window.removeEventListener('keydown', onKeys)
  }, [])

  let status = 'Elige dificultad y apuesta, y empieza a subir.'
  if (juegos.error) status = juegos.error
  else if (!ready) status = 'Conectando con la torre…'
  else if (reveal?.fell) status = `¡Crack! La baldosa del piso ${reveal.floor} estaba rota. Pierdes la apuesta.`
  else if (asking && run) status = `Pisando el piso ${floor + 1}…`
  else if (run && floor === 0) status = `Piso 1: elige una de las ${cfg.tiles} baldosas (${cfg.broken === 1 ? 'una está rota' : `${cfg.broken} están rotas`}).`
  else if (run) status = `Piso ${floor} superado: llevas ${eur(worth)}. ¿Subes al ${floor + 1} o cobras?`
  else if (last?.net > 0) status = `¡Cobraste ${fmtMult(last.mult)} en el piso ${last.floor}! Ganaste ${eur(last.net)}.`
  else if (last) status = `Caíste en el piso ${last.floor}. Perdiste ${eur(last.stake)}.`
  else if (balance < MIN_BET) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a empezar.'

  // Pisos de arriba abajo: el de arriba del todo es el último.
  const floors = Array.from({ length: cfg.floors }, (_, i) => cfg.floors - i)
  const path = run?.path ?? []

  return (
    <main className="app s3-app tower-app">
      <header className="top">
        <h1>La Torre</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd>{eur(shownBank)}</dd>
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
                Elige la dificultad y la apuesta y empieza a subir. En cada piso hay unas baldosas y alguna está rota: toca una
                (o pulsa su número). Si aguanta, subes y tu premio crece; si está rota, caes y pierdes la apuesta.
              </p>
              <p>
                Cobras cuando quieras con <b>Cobrar</b> (o <kbd>C</kbd>). Al llegar arriba del todo cobras solo.
              </p>
              <ul>
                {Object.entries(MODES).map(([id, m]) => (
                  <li key={id}>
                    <b>{m.name}:</b> {m.tiles} baldosas, {m.broken} rota{m.broken > 1 ? 's' : ''}, {m.floors} pisos, hasta {fmtMult(multAt(id, m.floors))}.
                  </li>
                ))}
              </ul>
              <p>
                Las baldosas rotas se sortean en el servidor justo cuando pisas, así que no hay truco: cobres donde cobres, de
                media se recupera el 96 %. Cada día hay una clasificación con el mejor golpe de cada uno.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="s3 fill">
        <section className="s3__stage tower" aria-label="La torre">
          <p className={`status ${last?.net > 0 && !run ? 'status--win' : ''}`} aria-live="polite">
            {status}
          </p>
          <ol className={`tower__floors ${reveal?.fell ? 'is-shake' : ''}`} style={{ '--tiles': cfg.tiles }}>
            {floors.map((n) => {
              const done = path[n - 1]
              const current = run && n === floor + 1 && !reveal
              const shown = reveal?.floor === n ? reveal : done ? { tile: done.tile, broken: done.broken } : null
              return (
                <li key={n} className={`tower__floor ${current ? 'is-current' : ''} ${n <= floor ? 'is-done' : ''} ${n > floor + 1 ? 'is-far' : ''}`}>
                  <span className="tower__mult">{fmtMult(multAt(run?.mode ?? mode, n))}</span>
                  <span className="tower__tiles">
                    {Array.from({ length: cfg.tiles }, (_, t) => {
                      const broke = shown?.broken.includes(t)
                      const mine = shown?.tile === t
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`tower__tile ${shown ? (broke ? 'is-broken' : 'is-safe') : ''} ${mine ? 'is-mine' : ''}`}
                          disabled={!current || busy}
                          onClick={() => pick(t)}
                          aria-label={current ? `Baldosa ${t + 1} del piso ${n}` : `Piso ${n}`}
                        >
                          {current ? t + 1 : mine ? (broke ? '✕' : '✓') : ''}
                        </button>
                      )
                    })}
                  </span>
                  <span className="tower__worth">{eur(payout(shownBet, run?.mode ?? mode, n))}</span>
                </li>
              )
            })}
            <li className="tower__ground">Planta baja · {MODES[run?.mode ?? mode].name}</li>
          </ol>
        </section>

        <aside className="s3__panel">
          <div className="s3__group">
            <h2>Ahora</h2>
            {run ? (
              <p className="s3__big">
                {floor > 0 ? `${fmtMult(multAt(run.mode, floor))} · ${eur(worth)}` : 'Elige baldosa'}
                <small>
                  Siguiente piso: {eur(payout(run.bet, run.mode, floor + 1))} con un {pct} % de aguantar
                </small>
              </p>
            ) : (
              <p className="s3__big">
                {eur(payout(shownBet, mode, MODES[mode].floors))}
                <small>si llegas arriba ({fmtMult(multAt(mode, MODES[mode].floors))})</small>
              </p>
            )}
          </div>

          <div className="s3__group">
            <h2>Dificultad</h2>
            <div className="s3__seg" role="radiogroup" aria-label="Dificultad">
              {Object.entries(MODES).map(([id, m]) => (
                <button key={id} type="button" role="radio" aria-checked={mode === id} disabled={Boolean(run) || asking} onClick={() => setMode(id)}>
                  {m.name}
                  <small>{Math.round(chance(id) * 100)} %</small>
                </button>
              ))}
            </div>
          </div>

          <div className="s3__group">
            <h2>Apuesta</h2>
            <label className="s3__slider">
              <span className="s3__amount">{eur(shownBet)}</span>
              <input type="range" min={MIN_BET} max={Math.max(maxBet, MIN_BET)} step={STEP} value={shownBet} disabled={!canBet} aria-label="Apuesta" onChange={(e) => setBet(Number(e.target.value))} />
            </label>
            <div className="s3__quick">
              <button type="button" disabled={!canBet} onClick={() => setBet(MIN_BET)}>
                Mín
              </button>
              <button type="button" disabled={!canBet} onClick={() => setBet(clampBet(shownBet / 2, maxBet))}>
                ½
              </button>
              <button type="button" disabled={!canBet} onClick={() => setBet(clampBet(shownBet * 2, maxBet))}>
                ×2
              </button>
              <button type="button" disabled={!canBet} onClick={() => setBet(maxBet)}>
                Máx
              </button>
            </div>
          </div>

          <div className="actions s3__actions">
            {!run ? (
              <button type="button" className="primary" disabled={busy || shownBet > balance || balance < MIN_BET} onClick={start}>
                {asking ? 'Empezando…' : 'Empezar a subir'} <kbd>Espacio</kbd>
              </button>
            ) : (
              <button type="button" className="primary s3__cash" disabled={busy || floor < 1} onClick={cash}>
                {floor < 1 ? 'Sube al menos un piso' : `Cobrar ${eur(worth)}`} <kbd>C</kbd>
              </button>
            )}
          </div>

          <div className="s3__group">
            <h2>Récord del día</h2>
            {ranking.length === 0 ? (
              <p className="s3__hint">Nadie ha cobrado hoy todavía. ¡El primero se pone arriba!</p>
            ) : (
              <ol className="s3__rank">
                {ranking.map((r, i) => (
                  <li key={`${r.name}-${i}`} className={r.me ? 'is-me' : ''}>
                    <b>{i + 1}</b>
                    <Avatar name={r.name} src={r.avatar} size={24} />
                    <span>{r.name}</span>
                    <em>
                      {fmtMult(r.mult)} · {MODES[r.mode]?.name ?? ''}
                    </em>
                  </li>
                ))}
              </ol>
            )}
            {history.length > 0 && (
              <ol className="s3__chips" aria-label="Últimas partidas">
                {history.map((h) => (
                  <li key={h.id} className={h.mult > 0 ? 'is-win' : 'is-lose'}>
                    {h.mult > 0 ? fmtMult(h.mult) : '✕'}
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
          amount={burst.amount}
          caption={`${fmtMult(burst.mult)} en el piso ${burst.floor}`}
          coins={Math.min(70, 20 + Math.round(burst.mult) * 3)}
          big={burst.mult >= 10}
          who={juegos.me?.name}
        />
      )}
    </main>
  )
}

export default Tower
