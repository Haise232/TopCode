import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import { BETS_MS, CAR_INFO, CHIPS, GRID_MS, HOUSE, MAX_TOTAL, PODIUM, ROUND_MS, fmtOdds, payout, phaseAt, totalOf } from './race.js'
import { delta, eur } from './money.js'
import { isMuted, playChip, playLose, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import Avatar from './Avatar.jsx'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import PowerButton from './PowerButton.jsx'
import RaceScene from './RaceScene.jsx'
import './Race.css'

const SEND_MS = 300 // las apuestas se mandan al servidor un momento después de dejar de tocar
const LAST_CALL_MS = 3000
const SHOW_BETS_SYNC_MS = 700 // tras cerrarse las apuestas el servidor suelta la carrera (a los 600 ms)
const END_SYNC_MS = 500 // al cruzar el último coche la meta, el servidor ya puede pagar
const HISTORY = 12
const PHASES = [
  ['betting', 'Apuestas'],
  ['grid', 'Parrilla'],
  ['race', 'Carrera'],
  ['result', 'Resultado'],
]
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const listOf = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : `${items[0] ?? ''}`)

// ---------- Apuestas del jugador: una por coche, [{ car, amount }] ordenadas por coche ----------
const norm = (list) => list.filter((b) => b.amount > 0).sort((a, b) => a.car - b.car)
const amountOn = (bets, car) => bets.find((b) => b.car === car)?.amount ?? 0
const withAmount = (bets, car, amount) => norm([...bets.filter((b) => b.car !== car), { car, amount }])
const keyOf = (bets) => bets.map((b) => `${b.car}:${b.amount}`).join()

const initialState = {
  chip: CHIPS[1],
  car: 0, // coche elegido (teclado y asiento)
  round: null, // ronda a la que pertenecen las apuestas
  placed: [], // lo que ves en pantalla
  confirmed: [], // lo que ya tiene el servidor (su importe ya salió del saldo)
  lastPlaced: [],
  synced: null, // ronda de la que ya se recogieron las apuestas guardadas en el servidor
}

// Lo que cuestan las apuestas que aún no ha confirmado el servidor (si se han reducido, es negativo: devolución).
const unconfirmed = (state) => totalOf(state.placed) - totalOf(state.confirmed)

// action.available: saldo libre (el del servidor menos lo que está por confirmar).
function reducer(state, action) {
  switch (action.type) {
    case 'ROUND': {
      if (state.round === action.round) return state
      const played = state.confirmed.length > 0 ? state.confirmed : state.lastPlaced
      return { ...state, round: action.round, placed: [], confirmed: [], lastPlaced: played }
    }
    // Apuestas que el servidor ya tenía para esta ronda (al entrar o tras recargar): solo la primera respuesta de cada ronda.
    case 'SERVER': {
      if (state.round !== action.round || state.synced === action.round) return state
      const next = { ...state, synced: action.round }
      if (state.placed.length === 0 && action.bets.length > 0) {
        const bets = norm(action.bets)
        return { ...next, placed: bets, confirmed: bets }
      }
      return next
    }
    case 'CONFIRMED':
      return state.round === action.round ? { ...state, confirmed: action.bets } : state
    // El servidor no aceptó el cambio: se vuelve a lo confirmado.
    case 'REJECTED':
      return state.round === action.round ? { ...state, placed: state.confirmed } : state
    case 'CHIP':
      return { ...state, chip: action.chip }
    case 'CAR':
      return { ...state, car: action.car }
    case 'ADD': {
      if (totalOf(state.placed) + state.chip > MAX_TOTAL || state.chip > action.available) return { ...state, car: action.car }
      return { ...state, car: action.car, placed: withAmount(state.placed, action.car, amountOn(state.placed, action.car) + state.chip) }
    }
    case 'SUB': {
      const next = amountOn(state.placed, state.car) - state.chip
      return { ...state, placed: withAmount(state.placed, state.car, Math.max(0, next)) }
    }
    case 'CLEAR':
      return { ...state, placed: [] }
    case 'DOUBLE': {
      const total = totalOf(state.placed)
      if (total === 0 || total * 2 > MAX_TOTAL || total > action.available) return state
      return { ...state, placed: state.placed.map((b) => ({ ...b, amount: b.amount * 2 })) }
    }
    case 'REPEAT': {
      const total = totalOf(action.bets)
      if (state.placed.length > 0 || total === 0 || total > MAX_TOTAL || total > action.available) return state
      return { ...state, placed: norm(action.bets) }
    }
    default:
      return state
  }
}

// Cuenta atrás: un aro que se vacía mientras se puede apostar (y la salida del semáforo).
function Countdown({ phase, count, fraction, last }) {
  return (
    <div className={`race-count race-count--${phase} ${last ? 'race-count--last' : ''}`} style={{ '--left': fraction }} aria-hidden="true">
      <span>{count}</span>
    </div>
  )
}

function Dot({ car, label }) {
  return <i className="race-dot" style={{ '--car': CAR_INFO[car].color }} title={label ?? CAR_INFO[car].name} />
}

// La carrera en vivo: una para todos cada 55 s. El servidor la sortea y paga con el saldo semanal; aquí se apuesta mientras
// las apuestas están abiertas y la escena anima la carrera con el reloj del servidor (todos ven lo mismo).
function Race({ onExit, juegos }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [sound, setSound] = useState(() => !isMuted())
  const [live, setLive] = useState(null) // última respuesta del servidor
  const [sending, setSending] = useState(false)
  const [seating, setSeating] = useState(false)
  const [seatMsg, setSeatMsg] = useState('')
  const [, setTick] = useState(0)
  const skew = useRef(null)
  const seq = useRef(0)
  const applied = useRef(0)
  const liveRef = useRef(null)
  const stateRef = useRef(state)
  const soundRound = useRef(null)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { request } = juegos
  const { chip, car: picked, placed, confirmed } = state
  liveRef.current = live
  stateRef.current = state

  // Reloj del servidor (con la diferencia medida en cada respuesta).
  const clock = useCallback(() => Date.now() + (skew.current ?? 0), [])
  const now = clock()
  const { round, offset, phase: basePhase } = phaseAt(now)
  const ready = skew.current !== null

  const ask = useCallback(
    async (message) => {
      const n = ++seq.current
      const sent = Date.now()
      const body = await request({ t: 'solo_race', ...message })
      const got = Date.now()
      const view = body?.solo
      if (view) {
        // La diferencia de reloj se mide en el punto medio del viaje; con un viaje lento se mantiene la anterior.
        if (skew.current === null || got - sent < 1500) skew.current = view.now - (sent + got) / 2
        // Una respuesta más vieja que otra ya recibida no la pisa.
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

  // Cuatro veces por segundo: cuenta atrás y cambio de fase.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (ready) dispatch({ type: 'ROUND', round })
  }, [ready, round])
  useEffect(() => setSeatMsg(''), [round, picked])

  // Al entrar, al volver a la pestaña y al empezar cada ronda (cuotas, asientos e historial nuevos).
  useEffect(() => {
    ask({ a: 'sync' })
  }, [ask])
  useEffect(() => {
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [sync])
  useEffect(() => {
    if (!ready || liveRef.current?.round === round) return
    const timer = setTimeout(sync, 150)
    return () => clearTimeout(timer)
  }, [ready, round, sync])

  const view = live?.round === round ? live : null
  const race = view?.race ?? null
  const endAt = race ? race.start + Math.max(...race.finish) : null

  // Cuando se cierran las apuestas el servidor suelta la carrera: se pide hasta tenerla.
  const needRace = ready && basePhase !== 'betting' && live !== null && !race
  useEffect(() => {
    if (!needRace) return
    const first = setTimeout(sync, Math.max(150, round * ROUND_MS + BETS_MS + SHOW_BETS_SYNC_MS - clock()))
    const poll = setInterval(sync, 1200)
    return () => {
      clearTimeout(first)
      clearInterval(poll)
    }
  }, [needRace, round, sync, clock])

  // Al cruzar el último coche la meta se paga: se pide el resultado (y otra vez si aún no ha llegado).
  const raceStart = race?.start ?? null
  useEffect(() => {
    if (endAt === null) return
    const wait = endAt + END_SYNC_MS - clock()
    if (wait < -2500) return
    const first = setTimeout(sync, Math.max(0, wait))
    const retry = setTimeout(() => {
      if (stateRef.current.confirmed.length > 0 && liveRef.current?.last?.round !== round) sync()
    }, Math.max(0, wait) + 2000)
    return () => {
      clearTimeout(first)
      clearTimeout(retry)
    }
    // endAt depende de la carrera de esta ronda: basta con que cambie su salida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceStart, round, sync, clock])

  // Apuestas que el servidor ya tenía para esta ronda (por ejemplo, tras recargar).
  useEffect(() => {
    if (live) dispatch({ type: 'SERVER', round: live.round, bets: live.bets })
  }, [live])

  const phase = basePhase === 'race' && endAt !== null && now >= endAt ? 'result' : basePhase
  const balance = live?.balance ?? juegos.me?.balance ?? 0
  const available = Math.max(0, balance - unconfirmed(state))
  const onTable = totalOf(placed)
  const left = Math.max(0, MAX_TOTAL - onTable)
  const broke = balance === 0 && onTable === 0
  const betting = ready && phase === 'betting' && state.round === round && view !== null
  const dirty = keyOf(placed) !== keyOf(confirmed)

  // Las apuestas se confirman con el servidor poco después de ponerlas (y al momento si se acaba el tiempo).
  // De una en una: dos peticiones a la vez pueden llegar en otro orden y dejar guardada la lista vieja.
  useEffect(() => {
    if (!dirty || sending || seating || state.round !== round) return
    // Lo que no llegó a enviarse antes de cerrar no juega: vuelve a lo confirmado.
    if (basePhase !== 'betting') {
      dispatch({ type: 'REJECTED', round })
      return
    }
    const bets = placed
    const wait = Math.max(0, Math.min(SEND_MS, BETS_MS - offset - 150))
    const timer = setTimeout(async () => {
      setSending(true)
      const body = await ask({ a: 'bet', round, bets })
      setSending(false)
      if (body?.solo) dispatch({ type: 'CONFIRMED', round, bets })
      else dispatch({ type: 'REJECTED', round })
    }, wait)
    return () => clearTimeout(timer)
    // offset cambia cuatro veces por segundo: solo se reprograma si cambian las apuestas o la ronda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, sending, seating, placed, basePhase, round, state.round, ask])

  // Resultado de tu última carrera liquidada; es de esta ronda si ya se pagó.
  const last = live?.last ?? null
  const fresh = last !== null && last.round === round && phase === 'result'
  const winnerShown = race !== null && now >= race.start + race.finish[race.winner]
  const won = fresh && last.net > 0
  const shownBank = useCountUp(available)

  // Sonido al conocer el resultado (una vez por ronda).
  useEffect(() => {
    if (!fresh || soundRound.current === last.round) return
    soundRound.current = last.round
    if (last.net > 0) playWin(last.payout >= last.stake * 5)
    else if (last.net < 0) playLose()
  }, [fresh, last])

  const seats = view?.seats ?? []
  const mySeat = view?.seat ?? null
  const pilotOf = (car) => {
    if (mySeat === car) return { name: juegos.me?.name ?? 'Tú', avatar: juegos.me?.avatar, me: true }
    const seat = seats.find((s) => s.car === car)
    return seat ? { name: seat.name, avatar: seat.avatar, me: false } : null
  }
  const players = view?.players ?? 0
  const history = (live?.history ?? []).slice(0, HISTORY)

  function add(car) {
    if (!betting) {
      dispatch({ type: 'CAR', car })
      return
    }
    if (chip <= available && onTable + chip <= MAX_TOTAL) playChip()
    dispatch({ type: 'ADD', car, available })
  }

  const repeatBets = state.lastPlaced.length > 0 ? state.lastPlaced : (live?.last?.bets ?? [])
  const repeatTotal = totalOf(repeatBets)
  const canRepeat = betting && placed.length === 0 && repeatTotal > 0 && repeatTotal <= available && repeatTotal <= MAX_TOTAL
  const canDouble = betting && onTable > 0 && onTable * 2 <= MAX_TOTAL && onTable <= available
  const canSub = betting && amountOn(placed, picked) > 0

  async function toggleSeat() {
    if (!betting || seating || sending) return
    const owner = pilotOf(picked)
    if (owner && !owner.me) {
      setSeatMsg(`${CAR_INFO[picked].name} ya lo pilota ${owner.name}. Elige otro coche.`)
      return
    }
    setSeatMsg('')
    setSeating(true)
    const body = await ask({ a: 'seat', round, car: owner?.me ? null : picked })
    setSeating(false)
    if (body?.solo) return
    if (body?.error?.code === 'SEAT_TAKEN') {
      setSeatMsg(`${CAR_INFO[picked].name} ya lo pilota otro jugador. Elige otro coche.`)
      sync()
    } else setSeatMsg('No se pudo cambiar de asiento. Inténtalo otra vez.')
  }

  // Teclado: 1-6 eligen coche, + / - cambian la ficha, Intro apuesta al coche elegido. El Espacio no hace nada.
  const onKeys = useEffectEvent((event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.matches('input, select, textarea, [contenteditable]')) return
    if (/^[1-6]$/.test(event.key)) {
      dispatch({ type: 'CAR', car: Number(event.key) - 1 })
    } else if (event.key === '+' || event.key === '-') {
      const at = CHIPS.indexOf(chip) + (event.key === '+' ? 1 : -1)
      if (at >= 0 && at < CHIPS.length) dispatch({ type: 'CHIP', chip: CHIPS[at] })
    } else if (event.key === 'Enter') {
      if (target?.matches('button, a, summary, dialog, dialog *')) return
      if (!betting) return
      event.preventDefault()
      add(picked)
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKeys)
    return () => window.removeEventListener('keydown', onKeys)
  }, [onKeys])

  // La escena avisa de los momentos clave; el panel va por reloj, así que solo se refresca al instante.
  const onEvent = useCallback((event) => {
    if (event?.type === 'winner' || event?.type === 'finish') setTick((n) => n + 1)
  }, [])

  // ---------- Textos ----------
  const secondsTo = (ms) => Math.max(0, Math.ceil(ms / 1000))
  const nextIn = secondsTo(ROUND_MS - offset)
  const winnerName = race ? CAR_INFO[race.winner].name : ''
  const lastCall = phase === 'betting' && BETS_MS - offset <= LAST_CALL_MS
  let call = 'Conectando con la pista…'
  let detail = ''
  if (ready) {
    if (phase === 'betting') {
      call = lastCall ? 'Últimas apuestas' : 'Hagan sus apuestas'
      if (broke) detail = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
      else if (onTable > 0) detail = sending || dirty ? `Enviando ${eur(onTable)}…` : `Apuesta aceptada: ${eur(onTable)}.`
      else detail = 'Toca un coche para apostar a que gana.'
    } else if (phase === 'grid') {
      call = 'Parrilla de salida'
      detail = onTable > 0 ? `Juegas ${eur(onTable)}. ¡Suerte!` : 'Apuestas cerradas: los coches se colocan.'
    } else if (phase === 'race') {
      if (winnerShown) {
        call = `Gana ${winnerName}`
        detail = onTable > 0 ? 'Los demás cruzan la meta. Calculando tu resultado…' : 'Los demás coches cruzan la meta.'
      } else {
        call = '¡Carrera en marcha!'
        detail = onTable > 0 ? `Juegas ${eur(onTable)}.` : 'Esta carrera la miras; en la siguiente puedes apostar.'
      }
    } else {
      call = `Ganó ${winnerName}`
      if (fresh) detail = last.net > 0 ? `¡Has ganado ${eur(last.net)}! Felicidades.` : last.net < 0 ? `Perdiste ${eur(-last.net)}.` : 'Recuperas lo apostado.'
      else if (onTable > 0) detail = 'Calculando tu resultado…'
      else detail = `Siguiente carrera en ${nextIn} s.`
    }
    if (juegos.error) detail = juegos.error
  }

  // Mensaje para lectores de pantalla: solo cambia con la fase, la apuesta o el resultado (nunca con la cuenta atrás).
  const betNames = placed.map((b) => `${CAR_INFO[b.car].name} ${eur(b.amount)}`)
  const announce = !ready
    ? ''
    : phase === 'betting'
      ? `Apuestas abiertas. ${onTable > 0 && !dirty ? `Apuesta aceptada: ${listOf(betNames)}.` : 'Sin apuestas.'}`
      : phase === 'grid'
        ? 'Apuestas cerradas. Parrilla de salida.'
        : phase === 'race'
          ? winnerShown
            ? `Gana ${winnerName}.`
            : 'Carrera en marcha.'
          : `Ganó ${winnerName}. ${fresh ? (last.net > 0 ? `Ganaste ${eur(last.net)}.` : last.net < 0 ? `Perdiste ${eur(-last.net)}.` : 'Recuperas lo apostado.') : ''}`

  let count = '•'
  let fraction = 0
  if (ready && phase === 'betting') {
    count = secondsTo(BETS_MS - offset)
    fraction = 1 - offset / BETS_MS
  } else if (ready && phase === 'grid') {
    count = secondsTo(BETS_MS + GRID_MS - offset)
    fraction = 1 - (offset - BETS_MS) / GRID_MS
  } else if (phase === 'result') count = '✓'

  // Tu última carrera (la de esta ronda si ya se pagó).
  let lastText = 'Todavía no has apostado en ninguna carrera.'
  let lastTone = ''
  if (onTable > 0 && !fresh && phase !== 'betting') lastText = `Tu apuesta: ${eur(onTable)} en ${listOf(placed.map((b) => CAR_INFO[b.car].name))}. El resultado llega al acabar.`
  else if (onTable > 0 && phase === 'betting') lastText = `Tu apuesta de esta carrera: ${eur(onTable)} en ${listOf(placed.map((b) => CAR_INFO[b.car].name))}.`
  else if (last) {
    lastTone = last.net > 0 ? 'is-win' : last.net < 0 ? 'is-loss' : ''
    lastText = `${fresh ? 'Esta carrera' : 'Tu carrera anterior'}: llegaron ${(last.order ?? [last.winner]).slice(0, 3).map((c, i) => `${i + 1}.º ${CAR_INFO[c].name}`).join(', ')}. Apostaste ${eur(last.stake)}, cobraste ${eur(last.payout)} (${delta(last.net)}).`
  }

  return (
    <main className="app race-app">
      <header className="top">
        <h1>Carrera</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd className={won ? 'money__up' : ''}>{eur(shownBank)}</dd>
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
            <PowerButton request={juegos.request} game="race" hit={juegos.powerHit} />
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
                Una carrera cada {ROUND_MS / 1000} segundos, la misma para todos. Seis coches igual de rápidos: el orden de llegada
                es al azar. Tienes {BETS_MS / 1000} segundos para apostar; después se cierran las apuestas, los coches salen de
                la parrilla y corren tres vueltas.
              </p>
              <p>
                Apuestas a un coche y <b>cobras si acaba en el podio</b>, según su puesto y por cada euro apostado: 1.º {fmtOdds(PODIUM[0])},
                2.º {fmtOdds(PODIUM[1])}, 3.º {fmtOdds(PODIUM[2])}. Del 4.º al 6.º no cobras nada. Con 100 € al coche que gana cobras
                340 €. El retorno de cualquier apuesta es de alrededor del {Math.round(HOUSE * 100)} %.
              </p>
              <p>
                Puedes apostar a varios coches a la vez (hasta {eur(MAX_TOTAL)} entre todos). Toca un coche para sumarle la ficha
                elegida; mientras las apuestas estén abiertas puedes quitar fichas, vaciar, repetir la apuesta anterior o doblar.
                Tus apuestas se envían solas al servidor.
              </p>
              <p>
                Los coches los pilotan jugadores si se sientan al volante (<b>Pilotar</b>, solo mientras hay apuestas abiertas); el
                resto de coches los lleva la IA. Pilotar es solo para presumir: no cambia las probabilidades ni el pago.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
              <p>
                Teclado: <kbd>1</kbd>–<kbd>6</kbd> eligen coche, <kbd>+</kbd> <kbd>-</kbd> cambian la ficha y <kbd>Intro</kbd> apuesta
                al coche elegido.
              </p>
            </Help>
          </div>
        </div>
      </header>

      <div className="race fill">
        <section className="race__status" aria-label="Estado de la carrera">
          <Countdown phase={ready ? phase : 'race'} count={count} fraction={fraction} last={lastCall} />
          <div className="race__call">
            <ol className="race__phases" aria-hidden="true">
              {PHASES.map(([id, label]) => (
                <li key={id} className={id === phase && ready ? 'is-now' : ''}>
                  {label}
                </li>
              ))}
            </ol>
            <strong className={won ? 'is-win' : ''}>{call}</strong>
            <span className={won ? 'is-win' : ''}>{detail}</span>
          </div>
          <p className="race__sr" role="status" aria-live="polite">
            {announce}
          </p>
        </section>

        <section className="race__scene" aria-label="Pista">
          <RaceScene
            getNow={clock}
            round={round}
            podium={PODIUM}
            race={race}
            seats={seats}
            bets={placed}
            mySeat={mySeat}
            muted={!sound}
            reduced={reduced}
            onEvent={onEvent}
          />
        </section>

        <aside className="race__panel" aria-label="Apuestas">
          <div className="race__head">
            <h2>Apuesta al ganador</h2>
            <span className="race__max">
              {eur(onTable)} de {eur(MAX_TOTAL)}
            </span>
          </div>

          <ol className="race__podium" aria-label="Premios por puesto, por euro apostado">
            {PODIUM.map((value, place) => (
              <li key={place}>
                <b>{place + 1}.º</b> {fmtOdds(value)}
              </li>
            ))}
            <li className="race__podium-none">4.º–6.º nada</li>
          </ol>

          <ul className="race__cars">
            {CAR_INFO.map((info, car) => {
              const bet = amountOn(placed, car)
              const pilot = pilotOf(car)
              const place = phase === 'result' && race?.order ? race.order.indexOf(car) : -1
              const prizes = PODIUM.map((_, p) => payout(bet, p))
              const label = [
                `Coche ${car + 1}, ${info.name}`,
                pilot ? `piloto ${pilot.me ? 'tú' : pilot.name}` : 'piloto IA',
                place >= 0 ? `acabó ${place + 1}.º` : null,
                bet > 0 ? `apostado ${eur(bet)}; si acaba 1.º cobras ${eur(prizes[0])}, 2.º ${eur(prizes[1])}, 3.º ${eur(prizes[2])}` : 'sin apuesta',
                betting ? `Añadir ficha de ${eur(chip)}` : null,
              ]
                .filter(Boolean)
                .join(', ')
              return (
                <li key={car}>
                  <button
                    type="button"
                    className={`race-car ${picked === car ? 'is-picked' : ''} ${bet > 0 ? 'has-bet' : ''} ${winnerShown && race?.winner === car ? 'is-winner' : ''}`}
                    style={{ '--car': info.color, '--accent': info.accent }}
                    disabled={!betting}
                    aria-pressed={picked === car}
                    aria-label={label}
                    onClick={() => add(car)}
                  >
                    <span className="race-car__top">
                      <span className="race-car__num" aria-hidden="true">
                        {car + 1}
                      </span>
                      <span className="race-car__name">{info.name}</span>
                      {place >= 0 && <b className={`race-car__place ${place < 3 ? 'is-podium' : ''}`}>{place + 1}.º</b>}
                    </span>
                    <span className="race-car__pilot">
                      {pilot ? (
                        <>
                          <Avatar name={pilot.name} src={pilot.avatar} size={20} />
                          <span>{pilot.me ? 'Tú pilotas' : pilot.name}</span>
                        </>
                      ) : (
                        <span className="race-car__ai">Piloto IA</span>
                      )}
                      {phase === 'race' && winnerShown && race?.winner === car && <b className="race-car__tag">Ganó</b>}
                    </span>
                    <span className="race-car__bet">
                      {bet > 0 ? (
                        <>
                          <b>{eur(bet)}</b>
                          <small>
                            {place >= 0 ? `cobras ${eur(payout(bet, place))}` : `${prizes[0]} / ${prizes[1]} / ${prizes[2]} €`}
                          </small>
                        </>
                      ) : (
                        <>
                          <small>Sin apuesta</small>
                          <small aria-hidden="true">&nbsp;</small>
                        </>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="race__chips" role="group" aria-label="Valor de la ficha">
            {CHIPS.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip chip--${value}`}
                aria-pressed={chip === value}
                aria-label={`Ficha de ${eur(value)}`}
                disabled={available < value || left < value}
                onClick={() => dispatch({ type: 'CHIP', chip: value })}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="race__actions">
            <button type="button" disabled={!canSub} onClick={() => dispatch({ type: 'SUB' })} aria-label={`Quitar una ficha de ${CAR_INFO[picked].name}`}>
              Quitar
            </button>
            <button type="button" disabled={!betting || placed.length === 0} onClick={() => dispatch({ type: 'CLEAR' })}>
              Vaciar
            </button>
            <button type="button" disabled={!canRepeat} onClick={() => dispatch({ type: 'REPEAT', bets: repeatBets, available })}>
              Repetir
            </button>
            <button type="button" disabled={!canDouble} onClick={() => dispatch({ type: 'DOUBLE', available })}>
              Doblar
            </button>
          </div>

          <div className="race__seat">
            <button type="button" className="race__drive" disabled={!betting || seating} aria-pressed={mySeat === picked} onClick={toggleSeat}>
              <span className="race__wheel" aria-hidden="true" />
              {mySeat === picked ? `Dejar el volante de ${CAR_INFO[picked].name}` : `Pilotar ${CAR_INFO[picked].name}`}
            </button>
            <p className={seatMsg ? 'is-warn' : ''}>
              {seatMsg ||
                (mySeat !== null
                  ? `Pilotas el ${CAR_INFO[mySeat].name} (solo para presumir).`
                  : 'Pilotar es opcional y no cambia el pago.')}
            </p>
          </div>
          <p className="race__keys">
            Teclas: <kbd>1</kbd>–<kbd>6</kbd> coche · <kbd>+</kbd> <kbd>-</kbd> ficha · <kbd>Intro</kbd> apostar
          </p>
        </aside>

        <section className="race__strip" aria-label="Resultados">
          <div className="race__history">
            <h2>Últimos ganadores</h2>
            {history.length === 0 ? (
              <span className="race__muted">Aún no hay carreras.</span>
            ) : (
              <ol aria-label={`Últimos ganadores: ${history.map((c) => CAR_INFO[c].name).join(', ')}`}>
                {history.map((c, i) => (
                  <li key={i}>
                    <Dot car={c} />
                  </li>
                ))}
              </ol>
            )}
            <span className="race__players">{players > 0 ? `${plural(players, 'jugador apuesta', 'jugadores apuestan')}` : 'Sin apuestas aún'}</span>
          </div>
          <p className={`race__last ${lastTone}`}>{lastText}</p>
        </section>
      </div>

      {won && (
        <WinBurst
          key={round}
          amount={last.net}
          caption={`Ganó el ${CAR_INFO[last.winner].name}`}
          coins={Math.min(70, Math.round(24 + (last.net / Math.max(last.stake, 1)) * 6))}
          big={last.payout >= last.stake * 5}
          who={juegos.me?.name}
        />
      )}
    </main>
  )
}

export default Race
