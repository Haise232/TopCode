import { useEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import {
  BASE_FLOORS,
  CREW_MAX,
  MAX_FLOORS,
  MAX_MULT,
  MIN_BET,
  RARITY_FLOORS,
  ROUTES,
  STEP,
  clampBet,
  floorsFor,
  fmtMult,
  maxBetFor,
  multOf,
  payout,
  routeChance,
} from './heist.js'
import { RARITY } from './gacha.js'
import { eur } from './money.js'
import { buzz, isMuted, playCash, playChip, playLand, playSiren, playSteps, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import Avatar from './Avatar.jsx'
import GachaCard from './GachaCard.jsx'
import './season3.css'

const HISTORY = 12

// El Atraco lo sortea el servidor con el saldo semanal (cuenta en el Score): cada planta la pide el jugador.
function Heist({ onExit, juegos }) {
  const [bet, setBet] = useState(50)
  const [crew, setCrew] = useState([]) // ids de las cartas elegidas para la banda
  const [cards, setCards] = useState([]) // tus cartas del gacha
  const [sound, setSound] = useState(() => !isMuted())
  const [run, setRun] = useState(null) // { bet, crew, floors, routes, path }
  const [asking, setAsking] = useState(false)
  const [flash, setFlash] = useState(null) // 'ok' | 'caught' tras cada planta
  const [last, setLast] = useState(null)
  const [history, setHistory] = useState([])
  const [ranking, setRanking] = useState([])
  const [burst, setBurst] = useState(null)
  const [bank, setBank] = useState(null) // { round, extra, modo }: lo que puso el Admin Abuse en el último golpe
  const [ready, setReady] = useState(false)
  const lock = useRef(false)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { request } = juegos
  const serverBalance = juegos.me?.balance ?? 0
  const [balance, setBalance] = useState(serverBalance)
  useEffect(() => {
    if (!asking && !flash) setBalance(serverBalance)
  }, [serverBalance, asking, flash])
  const shownBank = useCountUp(balance)

  const record = (result) => {
    setLast(result)
    setHistory((list) => (list.some((h) => h.id === result.round) ? list : [{ id: result.round, mult: result.net >= 0 ? result.mult : 0 }, ...list].slice(0, HISTORY)))
  }
  const apply = (view) => {
    if (view.ranking) setRanking(view.ranking)
    if (view.cards) setCards(view.cards)
    if (view.bet > 0) {
      setRun({ bet: view.bet, crew: view.crew, floors: view.floors, routes: view.routes, path: view.path })
      setBet(view.bet)
    } else setRun(null)
  }

  const resync = useEffectEvent(async () => {
    const body = await request({ t: 'solo_heist', a: 'sync' })
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

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), reduced ? 250 : flash === 'caught' ? 1600 : 600)
    return () => clearTimeout(timer)
  }, [flash, reduced])

  async function act(message) {
    if (lock.current) return null
    lock.current = true
    setAsking(true)
    const body = await request({ t: 'solo_heist', ...message })
    lock.current = false
    setAsking(false)
    const view = body?.solo ?? null
    if (!view) await resync()
    // Lo que puso la banca (Admin Abuse) en esta jugada.
    else if (body.abuse) view.abuse = body.abuse
    return view
  }

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const chosen = crew.map((id) => byId.get(id)).filter(Boolean)
  const plannedFloors = floorsFor(chosen.map((c) => c.rarity))
  const floors = run?.floors ?? plannedFloors
  const routes = run?.routes ?? []
  const depth = routes.length
  const maxBet = maxBetFor(balance)
  const shownBet = run ? run.bet : clampBet(bet, maxBet)
  const busy = asking || !ready || Boolean(flash)
  const canBet = !run && !asking && maxBet >= MIN_BET
  const worth = run && depth ? payout(run.bet, routes) : 0
  const mult = multOf(routes)
  // Riesgo acumulado: la probabilidad de que te hubieran pillado ya con las rutas que llevas.
  const survived = routes.reduce((p, r) => p * routeChance(r), 1)
  const alarm = run ? Math.round((1 - survived) * 100) : 0
  const crewShown = run ? run.crew : chosen

  function toggle(id) {
    if (run) return
    setCrew((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length >= CREW_MAX ? list : [...list, id]))
  }

  async function start() {
    if (busy || run || shownBet > balance) return
    playChip()
    setBurst(null)
    setLast(null)
    const view = await act({ a: 'start', bet: shownBet, crew })
    if (!view) return
    setBalance(view.balance)
    apply(view)
    playSteps()
  }

  async function go(route) {
    if (busy || !run) return
    const view = await act({ a: 'go', route })
    if (!view) return
    if (view.ev === 'caught') {
      if (view.abuse) setBank({ round: view.last.round, ...view.abuse })
      setFlash('caught')
      if (!isMuted()) playSiren()
      buzz([80, 60, 200])
      setRun((r) => (r ? { ...r, path: [...r.path, { route, ok: false }] } : r))
      setTimeout(() => {
        apply(view)
        record(view.last)
        setBalance(view.balance)
      }, reduced ? 250 : 1600)
      return
    }
    setFlash('ok')
    playLand(view.routes?.length ?? depth + 1)
    apply(view)
    if (view.ev === 'escape') {
      record(view.last)
      setBalance(view.balance)
      finish(view.last, view.abuse)
    }
  }

  async function cash() {
    if (busy || !run || !depth) return
    const view = await act({ a: 'cash' })
    if (!view) return
    apply(view)
    record(view.last)
    setBalance(view.balance)
    finish(view.last, view.abuse)
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
    const keys = { 1: 'sigilo', 2: 'normal', 3: 'loco' }
    if (run && keys[event.key]) {
      event.preventDefault()
      go(keys[event.key])
    } else if ((event.code === 'KeyC' || event.code === 'Enter') && run) {
      event.preventDefault()
      cash()
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKeys)
    return () => window.removeEventListener('keydown', onKeys)
  }, [])

  let status = 'Elige tu banda y tu apuesta, y da el golpe.'
  if (juegos.error) status = juegos.error
  else if (!ready) status = 'Preparando el plan…'
  else if (flash === 'caught') status = `🚨 ¡Os han pillado en la planta ${depth + 1}! La policía se queda con todo.`
  else if (asking && run) status = `Bajando a la planta ${depth + 1}…`
  else if (run && !depth) status = 'Estáis dentro. Elige por dónde bajáis a la planta 1.'
  else if (run) status = `Planta ${depth} limpia: ${eur(worth)} en la bolsa. ¿Bajáis más o huis?`
  else if (last?.net > 0) status = `¡Golpe perfecto! Huisteis con ${fmtMult(last.mult)}: ganaste ${eur(last.net)}.`
  else if (last && bank?.round === last.round && bank.extra > 0) status = `Os pillaron en la planta ${last.floor}, pero el Admin Abuse te devuelve ${eur(bank.extra)}.`
  else if (last) status = `Os pillaron en la planta ${last.floor}. Perdiste ${eur(last.stake)}.`
  else if (balance < MIN_BET) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a empezar.'

  const levels = Array.from({ length: MAX_FLOORS }, (_, i) => i + 1)
  // Sin atraco en marcha se ve el último: por dónde bajasteis y dónde os pillaron.
  const path = run?.path ?? last?.path ?? []
  const trail = run ? routes : path.filter((p) => p.ok).map((p) => p.route)

  return (
    <main className="app s3-app heist-app" data-alarm={alarm >= 75 ? 2 : alarm >= 40 ? 1 : 0}>
      <header className="top">
        <h1>El Atraco</h1>
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
                Apuesta y entra en la cámara acorazada. En cada planta eliges por dónde bajar: si sale bien, tu botín se
                multiplica; si os pillan, lo pierdes todo. Huye cuando quieras con <b>Huir</b> (o <kbd>C</kbd>).
              </p>
              <ul>
                {Object.entries(ROUTES).map(([id, r]) => (
                  <li key={id}>
                    {r.icon} <b>{r.name}:</b> {Math.round(routeChance(id) * 100)} % de salir bien, multiplica el botín ×{(r.den / r.num).toLocaleString('es-ES')}.
                  </li>
                ))}
              </ul>
              <p>
                <b>La banda:</b> sin banda solo llegas a la planta {BASE_FLOORS}. Cada carta tuya del gacha que metas (hasta {CREW_MAX}) abre
                más plantas según su rareza:{' '}
                {Object.entries(RARITY_FLOORS)
                  .map(([r, n]) => `${RARITY[r] ?? r} +${n}`)
                  .join(', ')}
                . Como mucho {MAX_FLOORS} plantas y un botín de {fmtMult(MAX_MULT)}.
              </p>
              <p>
                La banda no cambia la suerte: elijas las rutas que elijas y huyas donde huyas, de media se recupera el 96 %. Lo que
                da es poder bajar más hondo, donde están los botines enormes. Cada día hay una clasificación con el golpe más gordo.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="s3 fill">
        <section className={`s3__stage heist ${flash === 'caught' ? 'is-caught' : ''}`} aria-label="La cámara acorazada">
          <p className={`status ${last?.net > 0 && !run ? 'status--win' : ''}`} aria-live="polite">
            {status}
          </p>
          <div className="heist__crew" aria-label="Tu banda">
            {crewShown.length === 0 ? (
              <p className="s3__hint">Sin banda: hasta la planta {BASE_FLOORS}. Elige cartas a la derecha para bajar más.</p>
            ) : (
              crewShown.map((c) => (
                <div key={c.id} className="heist__member">
                  <GachaCard card={c} mini />
                  <span>
                    <b>{c.role}</b>
                    <small>{c.name}</small>
                  </span>
                </div>
              ))
            )}
            <div className="heist__alarm" style={{ '--alarm': alarm / 100 }} aria-label={`Alarma al ${alarm} %`}>
              <small>Alarma</small>
              <span />
              <b>{alarm} %</b>
            </div>
          </div>
          <ol className="heist__shaft">
            {levels.map((n) => {
              const locked = n > floors
              const done = n <= trail.length
              const current = run && n === depth + 1 && !locked
              const tried = path[n - 1]
              return (
                <li key={n} className={`heist__floor ${locked ? 'is-locked' : ''} ${done ? 'is-done' : ''} ${current ? 'is-current' : ''} ${tried && !tried.ok ? 'is-caught' : ''}`}>
                  <span className="heist__num">P{n}</span>
                  {current ? (
                    <span className="heist__routes">
                      {Object.entries(ROUTES).map(([id, r], i) => (
                        <button key={id} type="button" className={`heist__route heist__route--${id}`} disabled={busy} onClick={() => go(id)}>
                          <b>
                            {r.icon} {r.name}
                          </b>
                          <small>
                            {Math.round(routeChance(id) * 100)} % · {eur(payout(run.bet, [...routes, id]))}
                          </small>
                          <kbd>{i + 1}</kbd>
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className="heist__info">
                      {locked
                        ? '🔒 Necesitas más banda'
                        : done
                          ? `${ROUTES[trail[n - 1]].icon} ${ROUTES[trail[n - 1]].name} · ${fmtMult(multOf(trail.slice(0, n)))}`
                          : tried && !tried.ok
                            ? `🚨 Pillados (${ROUTES[tried.route].name})`
                            : n === floors
                              ? '💰 Cámara del tesoro'
                              : ''}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </section>

        <aside className="s3__panel">
          <div className="s3__group">
            <h2>Botín</h2>
            {run ? (
              <p className="s3__big">
                {depth ? `${fmtMult(mult)} · ${eur(worth)}` : 'Elige ruta'}
                <small>
                  Planta {depth} de {floors}
                </small>
              </p>
            ) : (
              <p className="s3__big">
                Hasta {floors} plantas
                <small>Botín máximo {fmtMult(MAX_MULT)}</small>
              </p>
            )}
          </div>

          {!run && (
            <div className="s3__group">
              <h2>
                Tu banda ({crew.length}/{CREW_MAX})
              </h2>
              {cards.length === 0 ? (
                <p className="s3__hint">No tienes cartas del gacha. Consigue alguna en la Colección para bajar más hondo.</p>
              ) : (
                <ul className="heist__picker">
                  {cards.map((c) => {
                    const on = crew.includes(c.id)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          disabled={!on && crew.length >= CREW_MAX}
                          onClick={() => toggle(c.id)}
                          title={`${c.name} · ${RARITY[c.rarity] ?? c.rarity} · +${RARITY_FLOORS[c.rarity] ?? 0} plantas`}
                        >
                          <GachaCard card={c} mini />
                          <small>+{RARITY_FLOORS[c.rarity] ?? 0}</small>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

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
                {asking ? 'Entrando…' : 'Dar el golpe'}
              </button>
            ) : (
              <button type="button" className="primary s3__cash" disabled={busy || !depth} onClick={cash}>
                {depth ? `Huir con ${eur(worth)}` : 'Baja al menos una planta'} <kbd>C</kbd>
              </button>
            )}
          </div>

          <div className="s3__group">
            <h2>Golpe del día</h2>
            {ranking.length === 0 ? (
              <p className="s3__hint">Hoy nadie ha salido con botín todavía.</p>
            ) : (
              <ol className="s3__rank">
                {ranking.map((r, i) => (
                  <li key={`${r.name}-${i}`} className={r.me ? 'is-me' : ''}>
                    <b>{i + 1}</b>
                    <Avatar name={r.name} src={r.avatar} size={24} />
                    <span>{r.name}</span>
                    <em>{fmtMult(r.mult)}</em>
                  </li>
                ))}
              </ol>
            )}
            {history.length > 0 && (
              <ol className="s3__chips" aria-label="Últimos golpes">
                {history.map((h) => (
                  <li key={h.id} className={h.mult > 0 ? 'is-win' : 'is-lose'}>
                    {h.mult > 0 ? fmtMult(h.mult) : '🚨'}
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
          caption={`${fmtMult(burst.mult)} desde la planta ${burst.floor}`}
          coins={Math.min(70, 20 + Math.round(burst.mult) * 3)}
          big={burst.mult >= 10}
          who={juegos.me?.name}
          tags={burst.extra > 0 ? [`Admin Abuse: +${eur(burst.extra)}`] : []}
        />
      )}
    </main>
  )
}

export default Heist
