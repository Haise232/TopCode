import { useEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import {
  DEPTH,
  DOORS,
  MIN_BET,
  ROOMS,
  STEP,
  clampBet,
  gainLabel,
  grow,
  loses,
  maxBetFor,
  safeChance,
  toneOf,
} from './dungeon.js'
import { eur } from './money.js'
import {
  buzz,
  isMuted,
  playCash,
  playChip,
  playClank,
  playCreak,
  playGrowl,
  playSteps,
  playWin,
  setMuted,
} from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import PowerButton from './PowerButton.jsx'
import { Behind, DoorLeaf, Fall, Frame, Hoard, Torch } from './DungeonArt.jsx'
import HallScene from './DungeonScene.jsx'
import './Dungeon.css'

const OPEN_MS = 750 // la puerta elegida se abre
const REST_MS = 450 // después se abren las otras dos
const NEXT_MS = 1500 // y, si sigues vivo, se pasa a la sala siguiente
const HISTORY = 40

// Textos de ambiente (solo de adorno: el resultado lo decide el servidor).
const AMBIENCE = [
  'Antorchas que parpadean y olor a humedad. Tres puertas te esperan.',
  'Lápidas rotas y un frío que cala los huesos. Algo araña la piedra.',
  'Cada paso resuena tres veces. Algo respira detrás de una de las puertas.',
  'Libros que susurran solos. Una de las puertas está trucada.',
  'Hilos de seda por todas partes. Algo se mueve en el techo.',
  'Huele a azufre y el suelo quema. El dragón vigila su último cofre.',
]
// Un monstruo por sala, como el que se dibuja detrás de la puerta.
const MONSTERS = {
  0: ['Un trol de las cavernas', 'Un trol con garrote'],
  1: ['Un esqueleto con hacha', 'Un guerrero esquelético'],
  2: ['Un espectro helado', 'Un alma en pena'],
  4: ['Una araña gigante', 'La reina de las arañas'],
}
const TRAPS = [
  'Una lluvia de pinchos',
  'Un foso sin fondo',
  'Una nube de gas venenoso',
  'Una guillotina oxidada',
  'Una losa que se hunde',
]
const CHESTS = [
  'Un cofre rebosante de doblones',
  'Un saco de rubíes',
  'Una corona olvidada',
  'Un cofre de monedas de plata',
  'Un cáliz de oro macizo',
]
const CORRIDORS = [
  'Un pasillo húmedo y vacío. Solo se oye el goteo.',
  'Telarañas y polvo, nada más.',
  'Un pasillo largo y silencioso. Sigues adelante.',
  'Huesos viejos de otro aventurero. Nada de valor.',
]
const any = (list) => list[Math.floor(Math.random() * list.length)]

function flavorOf(kind, room) {
  if (kind === 'chest') return `${any(CHESTS)}: el botín se multiplica ${gainLabel(room)}.`
  if (kind === 'empty') return any(CORRIDORS)
  if (kind === 'trap') return `¡${any(TRAPS)}! Pierdes el botín.`
  if (room === DEPTH - 1) return '¡El dragón Ignaroth despierta! Pierdes el botín.'
  return `¡${any(MONSTERS[room] ?? MONSTERS[0])}! Pierdes el botín.`
}

// Resumen de lo que hay en la sala: «1 cofre ×2 · 1 pasillo · 1 monstruo».
function contents(room) {
  const { doors, trapPct } = ROOMS[room]
  const count = (k) => doors.filter((d) => d === k).length
  const parts = []
  const n = (k, one, many) => (count(k) ? parts.push(`${count(k)} ${count(k) > 1 ? many : one}`) : null)
  n('chest', `cofre ${gainLabel(room)}`, `cofres ${gainLabel(room)}`)
  n('empty', 'pasillo', 'pasillos')
  n('monster', 'monstruo', 'monstruos')
  n('trap', 'trampa', 'trampas')
  return parts.join(' · ') + (trapPct ? ` (el pasillo es trampa ${trapPct} de cada 100 veces)` : '')
}

// El laberinto lo sortea el servidor con el saldo semanal (cuenta en el Score): cada puerta la pide el jugador y aquí
// solo se anima.
function Dungeon({ onExit, juegos }) {
  const [bet, setBet] = useState(50)
  const [sound, setSound] = useState(() => !isMuted())
  const [run, setRun] = useState(null) // { bet, pot, room } mientras hay una partida en marcha
  const [reveal, setReveal] = useState(null) // puertas abiertas: { room, doors, pick, kind, text, all, id }
  const [asking, setAsking] = useState(false)
  const [last, setLast] = useState(null) // última partida liquidada
  const [history, setHistory] = useState([]) // { id, ratio, stake }
  const [burst, setBurst] = useState(null)
  const [hurt, setHurt] = useState(0) // sacudida al perder
  const [ready, setReady] = useState(false)
  const lock = useRef(false)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { request } = juegos
  const serverBalance = juegos.me?.balance ?? 0
  const [balance, setBalance] = useState(serverBalance)
  const animating = reveal !== null && reveal.moving
  useEffect(() => {
    if (!animating && !asking) setBalance(serverBalance)
  }, [serverBalance, animating, asking])
  const shownBank = useCountUp(balance)
  const shownPot = useCountUp(run?.pot ?? 0, 500, 0)

  const record = (result) => {
    setLast(result)
    setHistory((list) => {
      if (list.some((h) => h.id === result.round)) return list
      return [
        {
          id: result.round,
          ratio: result.payout / result.stake,
          stake: result.stake,
          end: result.end,
        },
        ...list,
      ].slice(0, HISTORY)
    })
  }

  const resync = useEffectEvent(async () => {
    const body = await request({ t: 'solo_dungeon', a: 'sync' })
    const view = body?.solo
    if (!view) return false
    if (view.bet > 0) {
      setRun({ bet: view.bet, pot: view.pot, room: view.room })
      setBet(view.bet)
    } else setRun(null)
    setReveal(null)
    if (view.last) record(view.last)
    setBalance(view.balance)
    return true
  })
  useEffect(() => {
    let alive = true
    resync().then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  const room = run ? run.room : reveal ? reveal.room : 0
  const treasure = !run && last?.end === 'treasure' && reveal?.all
  const maxBet = maxBetFor(balance)
  const shownBet = run ? run.bet : clampBet(bet, maxBet)
  const broke = !run && !animating && balance < MIN_BET
  const busy = asking || animating || !ready
  const canPick = Boolean(run) && !busy && !reveal

  async function act(message) {
    if (busy || lock.current) return null
    lock.current = true
    setAsking(true)
    const body = await request({ t: 'solo_dungeon', ...message })
    const view = body?.solo ?? null
    if (!view) await resync()
    lock.current = false
    setAsking(false)
    return view
  }

  async function start() {
    if (busy || run || shownBet < MIN_BET || shownBet > balance) return
    playChip()
    setBurst(null)
    setLast(null)
    setReveal(null)
    const view = await act({ a: 'start', bet: shownBet })
    if (!view) return
    setBalance(view.balance)
    setRun({ bet: view.bet, pot: view.pot, room: view.room })
  }

  async function open(door) {
    if (!canPick) return
    const view = await act({ a: 'open', door })
    if (!view) return
    const kind = view.doors[view.pick]
    playCreak()
    setReveal({
      id: Date.now(),
      room: view.at,
      doors: view.doors,
      pick: view.pick,
      kind,
      text: flavorOf(kind, view.at),
      all: false,
      moving: true,
      view,
    })
  }

  // Línea de tiempo de una puerta: se abre la elegida, suena lo que hay, se abren las demás y se sigue (o se acaba).
  const afterOpen = useEffectEvent(() => {
    const { kind, view } = reveal
    setReveal((r) => ({ ...r, shown: true }))
    if (kind === 'chest') {
      playCash(3)
      buzz(40)
    } else if (kind === 'empty') playSteps()
    else if (kind === 'trap') playClank()
    else playGrowl()
    if (loses(kind)) {
      setHurt((n) => n + 1)
      buzz([60, 40, 160])
      setRun(null)
      record(view.last)
      setBalance(view.balance)
    } else if (view.bet > 0) {
      setRun({ bet: view.bet, pot: view.pot, room: run.room })
    }
  })
  const afterAll = useEffectEvent(() => {
    const { kind, view } = reveal
    if (loses(kind)) {
      setReveal((r) => ({ ...r, all: true, moving: false }))
    } else if (view.bet > 0) {
      setReveal((r) => ({ ...r, all: true }))
    } else {
      // Sala del tesoro: cobra solo.
      setRun(null)
      record(view.last)
      setBalance(view.balance)
      setReveal((r) => ({ ...r, all: true, moving: false }))
      celebrate(view.last)
    }
  })
  const nextRoom = useEffectEvent(() => {
    const { view } = reveal
    setRun({ bet: view.bet, pot: view.pot, room: view.room })
    setReveal(null)
  })
  useEffect(() => {
    if (!reveal?.moving) return
    const k = reduced ? 0.3 : 1
    const timers = [setTimeout(afterOpen, OPEN_MS * k), setTimeout(afterAll, (OPEN_MS + REST_MS) * k)]
    if (!loses(reveal.kind) && reveal.view.bet > 0) timers.push(setTimeout(nextRoom, (OPEN_MS + REST_MS + NEXT_MS) * k))
    return () => timers.forEach(clearTimeout)
  }, [reveal?.id, reduced])

  async function cash() {
    if (busy || !run || reveal) return
    const view = await act({ a: 'cash' })
    if (!view) return
    setRun(null)
    record(view.last)
    setBalance(view.balance)
    celebrate(view.last)
  }

  function celebrate(result) {
    if (result.net <= 0) return
    const ratio = result.payout / result.stake
    playCash(Math.min(10, ratio))
    playWin(ratio >= 10)
    buzz(ratio >= 10 ? [60, 40, 60, 40, 160] : [60, 40, 80])
    setBurst({
      id: result.round,
      amount: result.net,
      ratio,
      stake: result.stake,
      treasure: result.end === 'treasure',
    })
  }

  // Sacudida al perder (dura lo que la animación).
  useEffect(() => {
    if (!hurt) return
    const timer = setTimeout(() => setHurt(0), 600)
    return () => clearTimeout(timer)
  }, [hurt])

  const nudge = (delta) => setBet(clampBet(shownBet + delta, maxBet))
  const canBet = !run && !busy && maxBet > MIN_BET

  const onKeys = useEffectEvent((event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.matches('input, select')) return
    const digit = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(event.code)
    if (digit >= 0) {
      event.preventDefault()
      open(digit % 3)
    } else if (event.code === 'Space') {
      if (target?.matches('button:focus-visible')) return
      event.preventDefault()
      if (!run) start()
    } else if (event.code === 'KeyC' || event.code === 'Enter') {
      if (target?.matches('button, a') || !run) return
      event.preventDefault()
      cash()
    } else if ((event.code === 'ArrowLeft' || event.code === 'ArrowRight') && canBet) {
      event.preventDefault()
      nudge((event.code === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 10 : 1) * STEP)
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKeys)
    return () => window.removeEventListener('keydown', onKeys)
  }, [])

  let status = 'Elige tu apuesta y entra en el laberinto.'
  if (juegos.error) status = juegos.error
  else if (!ready) status = 'Encendiendo las antorchas…'
  else if (reveal && (reveal.moving || !run)) status = reveal.shown ? reveal.text : 'La puerta cruje al abrirse…'
  else if (broke) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
  else if (asking && run) status = 'Empujas la puerta…'
  else if (run) status = AMBIENCE[run.room]
  else if (last?.end === 'cash' && last.net > 0) status = `Sales con ${eur(last.payout)}. Ganaste ${eur(last.net)}.`
  else if (last?.end === 'cash') status = 'Sales por donde entraste y recuperas tu apuesta.'
  else if (last && last.end !== 'treasure')
    status = `Caíste en ${ROOMS[last.room].name.toLowerCase()}. Perdiste ${eur(last.stake)}.`

  if (treasure) status = `¡La sala del tesoro! Cruzaste las ${DEPTH} salas y te llevas ${eur(last.payout)}.`
  const lastWon = !run && last?.net > 0
  const tension = run ? (run.room >= DEPTH - 1 ? 2 : run.room >= 3 ? 1 : 0) : 0
  const dead = reveal && loses(reveal.kind) && reveal.all
  const best = history.reduce((top, h) => Math.max(top, h.ratio), 0)
  const walking = Boolean(reveal?.all && !loses(reveal.kind) && reveal.view.bet > 0)
  const roomName = treasure ? 'La sala del tesoro' : ROOMS[room].name

  return (
    <main className="app dg-app" data-tension={tension}>
      <header className="top">
        <h1>Laberinto</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd className={lastWon ? 'money__up' : ''}>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>{run ? 'Botín' : 'Apuesta'}</dt>
              <dd>{eur(run ? shownPot : shownBet)}</dd>
            </div>
          </dl>
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
            <PowerButton request={juegos.request} game="dungeon" hit={juegos.powerHit} />
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
                Pon tu apuesta y entra: es tu <b>botín</b>. Cada sala tiene {DOORS} puertas y eliges una. Detrás puede
                haber un <b>cofre</b> (el botín se multiplica y pasas a la siguiente sala), un <b>pasillo vacío</b>{' '}
                (pasas sin premio) o un <b>monstruo</b> o una <b>trampa</b> (pierdes el botín).
              </p>
              <p>
                Entre sala y sala puedes <b>salir con el botín</b>. Si cruzas las {DEPTH} salas llegas a la{' '}
                <b>sala del tesoro</b> y cobras solo. Con todo cofres, el botín llega a ×54.
              </p>
              <p>
                Cada sala avisa de lo que esconde (por ejemplo, «1 cofre ×2 · 1 pasillo · 1 monstruo»); lo que hay
                detrás de cada puerta se baraja al abrirla, así que ninguna puerta es mejor que otra.
              </p>
              <p>
                Teclado: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> abren las puertas, <kbd>Espacio</kbd> entra,{' '}
                <kbd>C</kbd> o <kbd>Intro</kbd> sale con el botín, <kbd>←</kbd> <kbd>→</kbd> cambian la apuesta.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="dg fill">
        <section className="dg__machine" aria-label="Laberinto">
          <p className={`status ${lastWon ? 'status--win' : ''} ${dead ? 'status--lose' : ''}`} aria-live="polite">
            {status}
          </p>
          <div
            className={`dg__hall ${hurt ? 'is-hurt' : ''} ${dead ? 'is-dead' : ''} ${treasure ? 'is-treasure' : ''} ${walking ? 'is-walking' : ''}`}
            data-room={room}
          >
            <HallScene key={`${room}-${treasure ? 't' : ''}`} room={room} treasure={Boolean(treasure)} />
            <div className="dg__light" />
            <div className="dg__banner">
              <span className="dg__depth">{treasure ? '★' : `Sala ${room + 1} de ${DEPTH}`}</span>
              <h2 key={roomName}>{roomName}</h2>
            </div>
            {treasure ? (
              <div className="dg__vault">
                <Torch />
                <Hoard />
                <Torch />
              </div>
            ) : (
              <div className={`dg__doors ${walking ? 'is-walking' : ''}`} key={reveal?.room ?? room}>
                <Torch />
                {Array.from({ length: DOORS }, (_, i) => {
                  const kind = reveal?.doors[i]
                  const opened = reveal && (i === reveal.pick || reveal.all)
                  const cls = [
                    'dg__door',
                    opened ? 'is-open' : '',
                    reveal && i === reveal.pick ? 'is-pick' : '',
                    reveal && i !== reveal.pick ? 'is-other' : '',
                    kind ? `has-${kind}` : '',
                  ].join(' ')
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cls}
                      disabled={!canPick}
                      onClick={() => open(i)}
                      aria-label={
                        opened
                          ? `Puerta ${i + 1}: ${{ chest: 'cofre', empty: 'pasillo vacío', monster: 'monstruo', trap: 'trampa' }[kind]}`
                          : `Abrir la puerta ${i + 1}`
                      }
                    >
                      <Frame />
                      <span className="dg__behind">{kind && <Behind kind={kind} room={reveal.room} />}</span>
                      <span className="dg__leaf">
                        <DoorLeaf n={i + 1} />
                      </span>
                      <Fall />
                    </button>
                  )
                })}
                <Torch />
              </div>
            )}
            <ol className="dg__map" aria-label="Salas del laberinto">
              {ROOMS.map((r, i) => {
                const lostHere = dead && i === reveal.room
                const state = lostHere
                  ? 'is-lost'
                  : treasure || i < room || (reveal && !loses(reveal.kind) && i === reveal.room)
                    ? 'is-past'
                    : i === room && (run || reveal)
                      ? 'is-here'
                      : ''
                return (
                  <li
                    key={r.name}
                    className={`dg__step ${state}`}
                    title={r.name}
                    aria-current={state === 'is-here' ? 'step' : undefined}
                  >
                    {lostHere ? '✕' : i + 1}
                  </li>
                )
              })}
              <li className={`dg__step dg__step--gold ${treasure ? 'is-past' : ''}`} title="La sala del tesoro">
                ★
              </li>
            </ol>
          </div>
        </section>

        <aside className="dg__panel">
          <div className="dg__group dg__now">
            <h2>Ahora</h2>
            {run ? (
              <>
                <span className="dg__amount" aria-hidden="true">
                  {eur(shownPot)}
                </span>
                <p className="dg__odds">
                  {contents(run.room)}
                  <br />
                  Con un cofre: <b>{eur(grow(run.pot, run.room))}</b> · sales vivo <b>{safeChance(run.room)} %</b>
                  <span className="dg__odds-bar" style={{ '--p': safeChance(run.room) / 100 }} />
                </p>
              </>
            ) : (
              <p className="dg__hint">Sin partida en marcha. Elige la apuesta y entra.</p>
            )}
          </div>

          <div className="dg__group">
            <h2>Apuesta</h2>
            <label className="dg__slider">
              <span className="dg__amount">{eur(shownBet)}</span>
              <input
                type="range"
                min={MIN_BET}
                max={Math.max(maxBet, MIN_BET)}
                step={STEP}
                value={shownBet}
                disabled={!canBet}
                aria-label="Apuesta"
                onChange={(event) => setBet(Number(event.target.value))}
              />
            </label>
            <div className="dg__quick">
              <button type="button" disabled={!canBet} onClick={() => setBet(MIN_BET)} aria-label="Apuesta mínima">
                Mín
              </button>
              <button
                type="button"
                disabled={!canBet}
                onClick={() => setBet(clampBet(shownBet / 2, maxBet))}
                aria-label="Mitad de la apuesta"
              >
                ½
              </button>
              <button
                type="button"
                disabled={!canBet}
                onClick={() => setBet(clampBet(shownBet * 2, maxBet))}
                aria-label="Doblar la apuesta"
              >
                ×2
              </button>
              <button type="button" disabled={!canBet} onClick={() => setBet(maxBet)} aria-label="Apuesta máxima">
                Máx
              </button>
            </div>
          </div>

          <div className="actions dg__actions">
            {!run && !broke && (
              <button type="button" className="primary" disabled={busy || shownBet > balance} onClick={start}>
                {asking ? 'Entrando…' : 'Entrar al laberinto'} <kbd>Espacio</kbd>
              </button>
            )}
            {run && (
              <>
                <p className="dg__hint dg__pick">{reveal ? 'Avanzando…' : 'Elige una puerta'}</p>
                <button type="button" className="dg__cash" disabled={busy || Boolean(reveal)} onClick={cash}>
                  Salir con {eur(run.pot)} <kbd>C</kbd>
                </button>
              </>
            )}
          </div>

          <div className="dg__group">
            <h2>Últimas partidas</h2>
            {history.length === 0 ? (
              <p className="dg__hint">Todavía no has jugado ninguna.</p>
            ) : (
              <>
                <ol className="dg__history" aria-label="Últimas partidas">
                  {history.slice(0, 10).map((h) => (
                    <li key={h.id} className={`dg__chip dg__chip--${toneOf(h.ratio)}`}>
                      {h.end === 'treasure'
                        ? '★'
                        : h.ratio > 0
                          ? `×${String(Math.round(h.ratio * 10) / 10).replace('.', ',')}`
                          : '✕'}
                    </li>
                  ))}
                </ol>
                <p className="dg__hint">
                  Mejor: {best ? `×${String(Math.round(best * 10) / 10).replace('.', ',')}` : '–'}
                </p>
              </>
            )}
          </div>
        </aside>
      </div>

      {burst && (
        <WinBurst
          key={burst.id}
          amount={burst.amount}
          caption={
            burst.treasure
              ? `¡Sala del tesoro! ×${String(Math.round(burst.ratio * 10) / 10).replace('.', ',')}`
              : `Botín de ${eur(burst.amount + burst.stake)} con ${eur(burst.stake)}`
          }
          coins={Math.min(70, 20 + Math.round(burst.ratio * 3))}
          big={burst.treasure || burst.ratio >= 10}
          who={juegos.me?.name}
        />
      )}
    </main>
  )
}

export default Dungeon
