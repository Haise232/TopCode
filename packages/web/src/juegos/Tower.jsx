import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import { MIN_BET, MODES, STEP, chance, clampBet, fmtMult, maxBetFor, multAt, payout } from './tower.js'
import { eur } from './money.js'
import { buzz, isMuted, playCash, playChip, playHop, playLand, playSplash, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import Avatar from './Avatar.jsx'
import './Tower.css'

const STEP_MS = 650 // lo que dura el salto a una baldosa
const FALL_MS = 1500 // lo que se ve la caída antes de volver a empezar
const HISTORY = 12
const MEDALS = ['🥇', '🥈', '🥉']
const SHARDS = 9

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
  const [bank, setBank] = useState(null) // { round, extra }: lo que puso el Admin Abuse en la última partida
  const [ready, setReady] = useState(false)
  const lock = useRef(false)
  const view = useRef(null)
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

  const apply = (v) => {
    if (v.ranking) setRanking(v.ranking)
    if (v.bet > 0) {
      setRun({ bet: v.bet, mode: v.mode, floor: v.floor, path: v.path })
      setMode(v.mode)
      setBet(v.bet)
    } else setRun(null)
  }

  const resync = useEffectEvent(async () => {
    const body = await request({ t: 'solo_tower', a: 'sync' })
    const v = body?.solo
    if (!v) return
    apply(v)
    if (v.last) record(v.last)
    setBalance(v.balance)
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
    const timer = setTimeout(() => setReveal(null), reduced ? 250 : reveal.fell ? FALL_MS : STEP_MS)
    return () => clearTimeout(timer)
  }, [reveal, reduced])

  async function act(message) {
    if (lock.current) return null
    lock.current = true
    setAsking(true)
    const body = await request({ t: 'solo_tower', ...message })
    lock.current = false
    setAsking(false)
    const v = body?.solo ?? null
    if (!v) await resync()
    // Lo que puso la banca (Admin Abuse) en esta jugada.
    else if (body.abuse) v.abuse = body.abuse
    return v
  }

  const cfg = MODES[run?.mode ?? mode]
  const shownMode = run?.mode ?? mode
  const floor = run?.floor ?? 0
  const maxBet = maxBetFor(balance)
  const shownBet = run ? run.bet : clampBet(bet, maxBet)
  const busy = asking || !ready || Boolean(reveal)
  const canBet = !run && !asking && maxBet >= MIN_BET
  const worth = run && floor > 0 ? payout(run.bet, run.mode, floor) : 0
  const pct = Math.round(chance(shownMode) * 100)
  // Sin torre en marcha se ve la última subida (si es de esta dificultad), con la baldosa rota donde caíste.
  const path = run?.path ?? (last?.mode === mode ? (last.path ?? []) : [])

  // Dónde está tu ficha: en la baldosa que acabas de pisar, en la última que aguantó o abajo del todo.
  let pawn = { at: 0, x: 0.5, state: 'idle' }
  if (reveal) pawn = { at: reveal.floor, x: (reveal.tile + 0.5) / cfg.tiles, state: reveal.fell ? 'fall' : 'land' }
  else if (run && floor > 0) pawn = { at: floor, x: (path[floor - 1].tile + 0.5) / cfg.tiles, state: 'stand' }
  else if (!run && last?.net > 0 && last.mode === mode) pawn = { at: last.floor, x: (last.path[last.floor - 1].tile + 0.5) / cfg.tiles, state: 'win' }
  const height = Math.min(1, pawn.at / cfg.floors) // para el cielo: 0 abajo, 1 en la cima

  // La cámara sigue a la ficha: su piso queda algo por debajo del centro.
  useLayoutEffect(() => {
    const box = view.current
    if (!box) return
    const target = box.querySelector(pawn.at > 0 ? `[data-floor="${pawn.at}"]` : '.tw-ground')
    if (!target) return
    const top = target.offsetTop + target.offsetHeight / 2 - box.clientHeight * 0.62
    box.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' })
  }, [pawn.at, shownMode, reduced])

  async function start() {
    if (busy || run || shownBet > balance) return
    playChip()
    setBurst(null)
    setLast(null)
    setBank(null)
    const v = await act({ a: 'start', bet: shownBet, mode })
    if (!v) return
    setBalance(v.balance)
    apply(v)
  }

  async function pick(tile) {
    if (busy || !run) return
    const at = run.floor + 1
    playHop(at)
    const v = await act({ a: 'pick', tile })
    if (!v) return
    const fell = v.ev === 'fall'
    setReveal({ floor: at, tile, broken: v.step.broken, fell })
    if (fell) {
      if (v.abuse) setBank({ round: v.last.round, ...v.abuse })
      setTimeout(() => {
        playSplash()
        buzz([40, 40, 160])
      }, reduced ? 0 : 280)
      setRun((r) => (r ? { ...r, path: [...r.path, v.step] } : r))
      setTimeout(
        () => {
          apply(v)
          record(v.last)
          setBalance(v.balance)
        },
        reduced ? 250 : FALL_MS,
      )
      return
    }
    setTimeout(() => playLand(at), reduced ? 0 : 320)
    if (v.ev === 'top') {
      apply(v)
      record(v.last)
      setBalance(v.balance)
      finish(v.last, v.abuse)
    } else apply(v)
  }

  async function cash() {
    if (busy || !run || floor < 1) return
    const v = await act({ a: 'cash' })
    if (!v) return
    apply(v)
    record(v.last)
    setBalance(v.balance)
    finish(v.last, v.abuse)
  }

  function finish(result, abuse) {
    if (abuse) setBank({ round: result.round, ...abuse })
    if (result.net <= 0) return
    playCash(Math.min(10, Math.round(result.mult)))
    playWin(result.mult >= 10)
    buzz([60, 40, 80])
    setBurst({ id: result.round, amount: result.net + (abuse?.extra ?? 0), mult: result.mult, floor: result.floor, extra: abuse?.extra ?? 0 })
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
  let tone = ''
  if (juegos.error) status = juegos.error
  else if (!ready) status = 'Conectando con la torre…'
  else if (reveal?.fell) {
    status = `¡Crack! La baldosa del piso ${reveal.floor} estaba rota.`
    tone = 'bad'
  } else if (asking && run) status = `Saltando al piso ${floor + 1}…`
  else if (run && floor === 0) status = `Piso 1: elige una de las ${cfg.tiles} baldosas. ${cfg.broken === 1 ? 'Una está rota' : `${cfg.broken} están rotas`}.`
  else if (run) status = `¡Aguanta! Piso ${floor}: llevas ${eur(worth)}. ¿Subes o cobras?`
  else if (last?.net > 0) {
    status = `¡Cobraste ${fmtMult(last.mult)} en el piso ${last.floor}! Ganaste ${eur(last.net + (bank?.round === last.round ? bank.extra : 0))}.`
    tone = 'good'
  } else if (last && bank?.round === last.round && bank.extra > 0) status = `Caíste en el piso ${last.floor}, pero el Admin Abuse te devuelve ${eur(bank.extra)}.`
  else if (last) {
    status = `Caíste en el piso ${last.floor}. Perdiste ${eur(last.stake)}.`
    tone = 'bad'
  } else if (balance < MIN_BET) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a empezar.'

  const floors = Array.from({ length: cfg.floors }, (_, i) => cfg.floors - i)
  const top = multAt(shownMode, cfg.floors)

  return (
    <main className="app tw-app" style={{ '--h': height }}>
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
                Elige la dificultad y la apuesta y empieza a subir. En cada piso hay unas baldosas de cristal y alguna está rota:
                toca una (o pulsa su número). Si aguanta, saltas al piso siguiente y tu premio crece; si está rota, caes y pierdes
                la apuesta.
              </p>
              <p>
                Cobras cuando quieras con <b>Cobrar</b> (o <kbd>C</kbd>). Al llegar a la cima cobras solo.
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
                media se recupera el 96 %. Cada día hay una clasificación con el mejor golpe de cada uno. Con el Admin Abuse, la
                banca multiplica lo que ganes o te devuelve lo que pierdas, y tienes más suerte al pisar.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="tw fill">
        <section className={`tw-stage ${reveal?.fell ? 'is-shake' : ''} ${tone === 'good' ? 'is-win' : ''}`} aria-label="La torre">
          <div className="tw-sky" aria-hidden="true">
            <span className="tw-sky__dusk" />
            <span className="tw-sky__night" />
            <span className="tw-sky__space" />
            <span className="tw-stars" />
            <span className="tw-moon" />
            <span className="tw-cloud tw-cloud--1" />
            <span className="tw-cloud tw-cloud--2" />
            <span className="tw-cloud tw-cloud--3" />
            <svg className="tw-city" viewBox="0 0 400 80" preserveAspectRatio="none">
              <path d="M0 80V52h18V38h14v14h10V30h16v22h12V44h20V24h12v28h14V36h18v16h10V20h8v-8h6v8h8v32h14V40h16v12h12V32h18v20h10V46h20V28h14v24h12V40h16v12h18V34h14v18h12V48h14v32Z" />
            </svg>
          </div>

          <p className={`tw-banner ${tone ? `tw-banner--${tone}` : ''}`} aria-live="polite">
            {status}
          </p>

          <div className="tw-view" ref={view}>
            <div className={`tw-tower tw-tower--${shownMode}`} style={{ '--floors': cfg.floors, '--tiles': cfg.tiles }}>
              <div className="tw-crown">
                <span className="tw-crown__rays" aria-hidden="true" />
                <span className="tw-crown__icon" aria-hidden="true">
                  👑
                </span>
                <b>La cima · {fmtMult(top)}</b>
                <small>{eur(payout(shownBet, shownMode, cfg.floors))}</small>
              </div>

              {floors.map((n) => {
                const done = path[n - 1]
                const current = run && n === floor + 1 && !reveal
                const shown = reveal?.floor === n ? reveal : done ? { tile: done.tile, broken: done.broken } : null
                const passed = run ? n <= floor : Boolean(done && !done.broken.includes(done.tile))
                const state = current ? 'is-current' : passed ? 'is-done' : n > (run ? floor + 1 : 1) ? 'is-far' : ''
                return (
                  <div key={n} data-floor={n} className={`tw-floor ${state}`}>
                    <span className="tw-plaque">
                      <small>{n}</small>
                      {fmtMult(multAt(shownMode, n))}
                    </span>
                    <span className="tw-tiles">
                      {Array.from({ length: cfg.tiles }, (_, t) => {
                        const broke = shown?.broken.includes(t)
                        const mine = shown?.tile === t
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`tw-tile ${shown ? (broke ? 'is-broken' : 'is-safe') : ''} ${mine ? 'is-mine' : ''}`}
                            disabled={!current || busy}
                            onClick={() => pick(t)}
                            aria-label={current ? `Baldosa ${t + 1} del piso ${n}` : `Piso ${n}`}
                          >
                            {current && <kbd>{t + 1}</kbd>}
                            {mine && broke && (
                              <span className="tw-shards" aria-hidden="true">
                                {Array.from({ length: SHARDS }, (_, i) => (
                                  <i key={i} style={{ '--i': i }} />
                                ))}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </span>
                    <span className="tw-prize">{eur(payout(shownBet, shownMode, n))}</span>
                  </div>
                )
              })}

              <div className="tw-ground">
                <span className="tw-lamp" aria-hidden="true" />
                Planta baja · {MODES[shownMode].name}
                <span className="tw-lamp" aria-hidden="true" />
              </div>

              <div
                className={`tw-pawn is-${pawn.state}`}
                style={{ '--at': pawn.at, '--x': pawn.x }}
                aria-hidden="true"
              >
                <span key={`${pawn.at}-${pawn.state}`} className="tw-pawn__body">
                  <Avatar name={juegos.me?.name ?? 'Tú'} src={juegos.me?.avatar} size={36} />
                </span>
                <span className="tw-pawn__shadow" />
              </div>
            </div>
          </div>

          <div className="tw-alt" aria-hidden="true">
            <span className="tw-alt__bar">
              <span className="tw-alt__fill" />
            </span>
            <span className="tw-alt__now">{pawn.at > 0 ? fmtMult(multAt(shownMode, pawn.at)) : 'Suelo'}</span>
          </div>
        </section>

        <aside className="tw-panel">
          <div className={`tw-loot ${run && floor > 0 ? 'is-live' : ''}`}>
            {run ? (
              <>
                <small>{floor > 0 ? `Botín en el piso ${floor}` : 'Elige baldosa'}</small>
                <b>{floor > 0 ? eur(worth) : eur(run.bet)}</b>
                <span className="tw-loot__mult">{floor > 0 ? fmtMult(multAt(run.mode, floor)) : 'apostado'}</span>
                <span className="tw-risk">
                  <span>
                    Siguiente: <b>{eur(payout(run.bet, run.mode, floor + 1))}</b>
                  </span>
                  <span className="tw-risk__bar" style={{ '--p': chance(run.mode) }}>
                    <i />
                  </span>
                  <small>{pct} % de que aguante</small>
                </span>
              </>
            ) : (
              <>
                <small>Si llegas a la cima</small>
                <b>{eur(payout(shownBet, mode, MODES[mode].floors))}</b>
                <span className="tw-loot__mult">{fmtMult(multAt(mode, MODES[mode].floors))}</span>
              </>
            )}
          </div>

          <div className="tw-group">
            <h2>Dificultad</h2>
            <div className="tw-modes" role="radiogroup" aria-label="Dificultad">
              {Object.entries(MODES).map(([id, m]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  className={`tw-mode tw-mode--${id}`}
                  disabled={Boolean(run) || asking}
                  onClick={() => setMode(id)}
                >
                  <span className="tw-mode__tiles" aria-hidden="true">
                    {Array.from({ length: m.tiles }, (_, t) => (
                      <i key={t} className={t >= m.tiles - m.broken ? 'is-bad' : ''} />
                    ))}
                  </span>
                  <b>{m.name}</b>
                  <small>
                    {Math.round(chance(id) * 100)} % · hasta {fmtMult(multAt(id, m.floors))}
                  </small>
                </button>
              ))}
            </div>
          </div>

          <div className="tw-group">
            <h2>Apuesta</h2>
            <div className="tw-bet">
              <button type="button" disabled={!canBet} onClick={() => setBet(clampBet(shownBet - STEP * 5, maxBet))} aria-label="Bajar la apuesta">
                −
              </button>
              <span>{eur(shownBet)}</span>
              <button type="button" disabled={!canBet} onClick={() => setBet(clampBet(shownBet + STEP * 5, maxBet))} aria-label="Subir la apuesta">
                +
              </button>
            </div>
            <input
              className="tw-slider"
              type="range"
              min={MIN_BET}
              max={Math.max(maxBet, MIN_BET)}
              step={STEP}
              value={shownBet}
              disabled={!canBet}
              aria-label="Apuesta"
              onChange={(e) => setBet(Number(e.target.value))}
            />
            <div className="tw-quick">
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

          {!run ? (
            <button type="button" className="tw-go" disabled={busy || shownBet > balance || balance < MIN_BET} onClick={start}>
              {asking ? 'Empezando…' : 'Empezar a subir'}
              <kbd>Espacio</kbd>
            </button>
          ) : (
            <button type="button" className="tw-go tw-go--cash" disabled={busy || floor < 1} onClick={cash}>
              {floor < 1 ? 'Sube al menos un piso' : `Cobrar ${eur(worth)}`}
              <kbd>C</kbd>
            </button>
          )}

          <div className="tw-group">
            <h2>Récord del día</h2>
            {ranking.length === 0 ? (
              <p className="tw-hint">Nadie ha cobrado hoy todavía. ¡El primero se pone arriba!</p>
            ) : (
              <ol className="tw-rank">
                {ranking.map((r, i) => (
                  <li key={`${r.name}-${i}`} className={r.me ? 'is-me' : ''}>
                    <span className="tw-rank__pos">{MEDALS[i] ?? i + 1}</span>
                    <Avatar name={r.name} src={r.avatar} size={26} />
                    <span className="tw-rank__name">{r.name}</span>
                    <span className="tw-rank__mult">
                      {fmtMult(r.mult)}
                      <small>{MODES[r.mode]?.name ?? ''}</small>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {history.length > 0 && (
              <ol className="tw-history" aria-label="Últimas partidas">
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
          tags={burst.extra > 0 ? [`Admin Abuse: +${eur(burst.extra)}`] : []}
        />
      )}
    </main>
  )
}

export default Tower
