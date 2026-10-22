import { useEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import {
  MAX_BET,
  MIN_BET,
  MISS_ODDS,
  PRIZES,
  STEP,
  chanceLabel,
  clampBet,
  maxBetFor,
  multLabel,
  toneOf,
} from './claw.js'
import { eur } from './money.js'
import {
  buzz,
  isMuted,
  playCash,
  playChip,
  playGrab,
  playLose,
  playMotor,
  playPop,
  playPrizeDrop,
  playSlip,
  playWin,
  setMuted,
} from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import PowerButton from './PowerButton.jsx'
import {
  AIM_MAX,
  AIM_MIN,
  Cabinet,
  Cable,
  Carriage,
  ClawDefs,
  ClawHead,
  CHUTE_X,
  FLOOR,
  GRAB_Y,
  GlassFront,
  H,
  HELD_DY,
  HOME_Y,
  ITEM_Y,
  PILE,
  PIVOT_Y,
  PRIZE_S,
  PrizeItem,
  TRAY_Y,
  W,
} from './ClawArt.jsx'
import './Claw.css'

const SPEED = 330 // unidades del dibujo por segundo con una flecha pulsada
const DOWN_MS = 1000
const LIFT_MS = 900
const HISTORY = 40
const SLIP_Y = GRAB_Y - 96 // altura a la que se escurre el premio que no era

// Textos de ambiente (solo de adorno: el premio lo decide el servidor).
const WINS = {
  jackpot: [
    '¡Las luces se vuelven locas! El gancho ha pescado el premio gordo.',
    '¡Increíble! Esto no se ve todos los días.',
    '¡Jackpot! Al dueño de la máquina le tiembla el pulso.',
  ],
  big: [
    '¡Qué agarre! Las pinzas no lo sueltan ni a tiros.',
    '¡Menudo pez! Directo a la bandeja.',
    'Pinzas de oro: te llevas un premiazo.',
  ],
  mid: [
    'Buen agarre: el premio cae a la bandeja.',
    'El gancho cumple y las monedas tintinean.',
    'Firme y sin soltar. Así se pesca.',
  ],
  even: ['Lo justo: vuelve lo que pusiste.', 'Ni ganas ni pierdes. Otra vez será.', 'La moneda regresa a casa.'],
  low: [
    'Algo es algo: calderilla de consuelo.',
    'Unas monedillas para el café.',
    'Casi nada, pero no sales con las manos vacías.',
  ],
}
const MISSES = [
  'El peluche era más resbaladizo de lo que parecía.',
  'Las pinzas flojean y el premio vuelve al montón.',
  'El gancho agarra, duda y suelta. Mala suerte.',
  '¡Ay! Se te cayó a medio camino.',
  'Casi... pero la máquina cuida mucho sus premios.',
]
const any = (list) => list[Math.floor(Math.random() * list.length)]
const tierOf = (mult) => (mult >= 50 ? 'jackpot' : mult >= 10 ? 'big' : mult >= 2 ? 'mid' : mult >= 1 ? 'even' : 'low')

// Texto del resultado de un intento (prize: índice en PRIZES o -1).
function resultText(prize, bet, payout) {
  if (prize < 0) return `¡Se escapó! Pierdes ${eur(bet)}. ${any(MISSES)}`
  const { name, mult } = PRIZES[prize]
  const flavor = any(WINS[tierOf(mult)])
  if (payout > bet) return `¡${name}, ${multLabel(mult)}! Ganaste ${eur(payout - bet)}. ${flavor}`
  if (payout === bet) return `${name}, ${multLabel(mult)}: recuperas tu apuesta. ${flavor}`
  return `${name}, ${multLabel(mult)}: recuperas ${eur(payout)} de ${eur(bet)}. ${flavor}`
}

const moveTo = (x) => `translate(${x}px, 0px)`
const headAt = (y) => `translate(0px, ${y - PIVOT_Y}px)`
const cableAt = (y) => `scale(1, ${y - PIVOT_Y})`
const itemAt = (x, y, scale = PRIZE_S, rot = 0) => `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`
const MID_X = (AIM_MIN + AIM_MAX) / 2
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// La pesca la sortea el servidor con el saldo semanal (cuenta en el Score): la posición del gancho es de adorno y aquí
// solo se anima hasta el premio que ya salió.
function Claw({ onExit, juegos }) {
  const [bet, setBet] = useState(50)
  const [sound, setSound] = useState(() => !isMuted())
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('') // down | grab | lift | slip: qué hace el gancho ahora
  const [item, setItem] = useState(null) // premio bajo el gancho: { id, tone }
  const [held, setHeld] = useState(false) // el premio cuelga de las pinzas
  const [last, setLast] = useState(null) // último intento: { id, prize, bet, payout, text }
  const [history, setHistory] = useState([]) // { id, ratio, prize }
  const [burst, setBurst] = useState(null)
  const [fx, setFx] = useState(0) // 0 nada, 1 premio grande, 2 premio gordo
  const svgRef = useRef(null)
  const railRef = useRef(null)
  const swingRef = useRef(null)
  const headRef = useRef(null)
  const cableRef = useRef(null)
  const itemRef = useRef(null)
  const pileRefs = useRef(new Map())
  const aim = useRef({ cur: MID_X, target: MID_X, lean: 0 })
  const dirs = useRef({ left: false, right: false })
  const busyRef = useRef(false)
  const alive = useRef(true)
  const live = useRef({ anims: new Set(), timers: new Set(), pile: [] })
  const nextId = useRef(1)
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { request } = juegos
  const serverBalance = juegos.me?.balance ?? 0
  const latest = useRef(serverBalance)
  useEffect(() => {
    latest.current = serverBalance
  }, [serverBalance])
  // Saldo que enseña la pantalla: la apuesta sale al soltar y el premio entra cuando cae a la bandeja.
  const [balance, setBalance] = useState(serverBalance)
  useEffect(() => {
    if (!busy) setBalance(serverBalance)
  }, [serverBalance, busy])
  const shownBank = useCountUp(balance)

  const maxBet = maxBetFor(balance)
  const shownBet = clampBet(bet, maxBet)
  const broke = !busy && balance < MIN_BET
  const canBet = !busy && maxBet > MIN_BET
  const canDrop = !busy && !broke && shownBet <= balance

  // ---------- Animación con la API del navegador ----------
  // Todo lo que espera (animaciones y pausas) deja de resolverse al salir de la pantalla: así nada toca el dibujo después.
  useEffect(() => {
    alive.current = true
    const { anims, timers } = live.current
    return () => {
      alive.current = false
      anims.forEach((a) => a.cancel())
      timers.forEach(clearTimeout)
    }
  }, [])

  const k = reduced ? 0.25 : 1
  const wait = (ms) =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        live.current.timers.delete(timer)
        resolve()
      }, ms * k)
      live.current.timers.add(timer)
    })

  // Anima un elemento y deja puesto el último fotograma.
  const glide = (el, frames, ms, easing = 'ease-in-out') =>
    new Promise((resolve) => {
      const a = el.animate(frames, { duration: Math.max(1, ms * k), easing, fill: 'forwards' })
      live.current.anims.add(a)
      a.onfinish = () => {
        const end = frames[frames.length - 1]
        for (const key of Object.keys(end)) if (key !== 'offset' && key !== 'easing') el.style[key] = end[key]
        a.cancel()
        live.current.anims.delete(a)
        resolve()
      }
    })

  // El cable y el gancho suben o bajan a la vez (el cable es un trazo estirado).
  const glideHead = (from, to, ms, easing) =>
    Promise.all([
      glide(headRef.current, [{ transform: headAt(from) }, { transform: headAt(to) }], ms, easing),
      glide(cableRef.current, [{ transform: cableAt(from) }, { transform: cableAt(to) }], ms, easing),
    ])
  const glideX = (from, to, ms, easing) =>
    glide(railRef.current, [{ transform: moveTo(from) }, { transform: moveTo(to) }], ms, easing)

  const grip = (mode) => {
    if (headRef.current) headRef.current.dataset.grip = mode
  }
  const lean = (deg) => swingRef.current?.style.setProperty('--lean', String(reduced ? 0 : deg))
  const press = (on) => {
    if (svgRef.current) svgRef.current.dataset.press = on ? '1' : ''
  }

  // El montón se aparta un poco del hueco por el que sale el premio.
  const shiftPile = (x) => {
    PILE.forEach((p) => {
      const dx = p.x - x
      if (Math.abs(dx) > 78) return
      const el = pileRefs.current.get(p.id)
      if (!el) return
      const push = Math.sign(dx || 1) * (78 - Math.abs(dx)) * 0.3
      const a = el.animate(
        [
          { transform: itemAt(p.x, p.y, p.scale, p.rot) },
          { transform: itemAt(p.x + push, p.y + 7, p.scale, p.rot + push * 0.5) },
        ],
        { duration: 320 * k, easing: 'ease-out', fill: 'forwards' },
      )
      live.current.anims.add(a)
      live.current.pile.push(a)
    })
  }
  const unshiftPile = () => {
    live.current.pile.forEach((a) => {
      a.cancel()
      live.current.anims.delete(a)
    })
    live.current.pile = []
  }

  // ---------- Un intento ----------
  async function drop() {
    if (!canDrop || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    const before = balance
    const stake = shownBet
    const x = aim.current.cur
    aim.current.target = x
    dirs.current = { left: false, right: false }
    setBurst(null)
    setFx(0)
    unshiftPile()
    if (item) {
      await glide(itemRef.current, [{ opacity: 1 }, { opacity: 0 }], 160)
      setItem(null)
    }
    setHeld(false)
    lean(0)
    press(true)
    playChip()
    playMotor(DOWN_MS)
    setStage('down')
    grip('open')
    const pending = request({ t: 'solo_claw', bet: stake }).catch(() => null)
    await glideHead(HOME_Y, GRAB_Y, DOWN_MS, 'cubic-bezier(.45, 0, .35, 1)')
    const body = await pending
    press(false)
    const reply = body?.solo
    if (!reply) {
      // Sin respuesta (saldo, error de red…): el gancho sube vacío y el aviso lo da juegos.error.
      setStage('')
      playMotor(LIFT_MS * 0.7)
      grip('idle')
      await glideHead(GRAB_Y, HOME_Y, LIFT_MS * 0.7)
      busyRef.current = false
      setBusy(false)
      return
    }
    const { prize, payout } = reply
    setBalance(before - stake)
    const won = prize >= 0
    const id = nextId.current++

    // El premio asoma del montón justo bajo las pinzas.
    setItem(won ? { id: PRIZES[prize].id } : { id: 'plush', tone: Math.floor(Math.random() * 4) })
    await wait(30)
    playPop()
    shiftPile(x)
    await glide(
      itemRef.current,
      [
        { transform: itemAt(x, ITEM_Y + 44, PRIZE_S * 0.5), opacity: 0 },
        { transform: itemAt(x, ITEM_Y - 10, PRIZE_S * 1.12), opacity: 1, offset: 0.65 },
        { transform: itemAt(x, ITEM_Y), opacity: 1 },
      ],
      340,
      'ease-out',
    )

    // Las pinzas se cierran y el premio queda colgado de ellas.
    setStage('grab')
    grip('hold')
    await wait(130)
    playGrab()
    buzz(30)
    await wait(300)
    setHeld(true)
    await wait(40)

    if (won) {
      setStage('lift')
      playMotor(LIFT_MS)
      await glideHead(GRAB_Y, HOME_Y, LIFT_MS)
      const dir = Math.sign(CHUTE_X - x) || -1
      const carry = 520 + Math.abs(x - CHUTE_X) * 1.1
      lean(dir * 9)
      playMotor(carry)
      await glideX(x, CHUTE_X, carry, 'cubic-bezier(.5, 0, .4, 1)')
      lean(0)
      await wait(420)

      // Suelta sobre el conducto: el premio cae por el tubo hasta la bandeja.
      grip('open')
      playGrab()
      itemRef.current.style.transform = itemAt(CHUTE_X, HOME_Y + HELD_DY)
      itemRef.current.style.opacity = '1'
      setHeld(false)
      await wait(120)
      const back = glide(
        railRef.current,
        [{ transform: moveTo(CHUTE_X) }, { transform: moveTo(x) }],
        760 + Math.abs(x - CHUTE_X) * 0.6,
        'cubic-bezier(.5, 0, .4, 1)',
      )
      setTimeout(() => grip('idle'), 500 * k)
      lean(-dir * 6)
      const fall = glide(
        itemRef.current,
        [
          { transform: itemAt(CHUTE_X, HOME_Y + HELD_DY), easing: 'ease-in' },
          { transform: itemAt(CHUTE_X, FLOOR + 4, 0.9), offset: 0.5, easing: 'ease-in' },
          { transform: itemAt(CHUTE_X, TRAY_Y, 0.72), offset: 0.84, easing: 'ease-out' },
          { transform: itemAt(CHUTE_X, TRAY_Y - 12, 0.72), offset: 0.92, easing: 'ease-in' },
          { transform: itemAt(CHUTE_X, TRAY_Y, 0.72) },
        ],
        1000,
        'linear',
      )
      await wait(760)
      playPrizeDrop()
      await fall
      lean(0)
      land({ id, prize, stake, payout })
      await back
    } else {
      // El premio se escurre a media subida y vuelve al montón.
      setStage('lift')
      playMotor(LIFT_MS * 0.7)
      await glideHead(GRAB_Y, SLIP_Y, LIFT_MS * 0.7, 'ease-in')
      setStage('slip')
      grip('loose')
      playSlip()
      lean(7)
      itemRef.current.style.transform = itemAt(x, SLIP_Y + HELD_DY)
      setHeld(false)
      const spin = x < MID_X ? 1 : -1
      const fall = glide(
        itemRef.current,
        [
          { transform: itemAt(x, SLIP_Y + HELD_DY, PRIZE_S, 0), easing: 'ease-in' },
          { transform: itemAt(x + spin * 6, ITEM_Y + 8, PRIZE_S, spin * 22), offset: 0.62, easing: 'ease-out' },
          { transform: itemAt(x + spin * 9, ITEM_Y - 10, PRIZE_S, spin * 28), offset: 0.8, easing: 'ease-in' },
          { transform: itemAt(x + spin * 10, ITEM_Y + 4, PRIZE_S, spin * 24) },
        ],
        640,
        'linear',
      )
      await wait(80)
      lean(-5)
      await wait(180)
      lean(0)
      await fall
      playLose()
      buzz([40, 40, 100])
      land({ id, prize, stake, payout })
      await wait(260)
      playMotor(LIFT_MS * 0.6)
      grip('idle')
      await glideHead(SLIP_Y, HOME_Y, LIFT_MS * 0.6)
    }
    setStage('')
    grip('idle')
    aim.current.cur = x
    aim.current.target = x
    busyRef.current = false
    setBusy(false)
  }
  const onDrop = useEffectEvent(drop)

  // El premio ya está en la bandeja (o se perdió): saldo, historial, celebración.
  function land({ id, prize, stake, payout }) {
    const text = resultText(prize, stake, payout)
    setBalance(latest.current)
    setLast({ id, prize, bet: stake, payout, text })
    setHistory((list) => [{ id, ratio: payout / stake, prize }, ...list].slice(0, HISTORY))
    if (prize < 0 || payout <= stake) return
    const { mult } = PRIZES[prize]
    playCash(Math.min(10, mult))
    playWin(mult >= 10)
    buzz(mult >= 25 ? [60, 40, 60, 40, 160] : [60, 40, 80])
    setFx(mult >= 100 ? 2 : mult >= 25 ? 1 : 0)
    setBurst({ id, amount: payout - stake, prize, bet: stake })
  }

  // ---------- Movimiento del gancho antes de soltarlo ----------
  // Un solo bucle: la posición «real» persigue a la que piden las flechas o el dedo, y el cable se balancea según la prisa.
  useEffect(() => {
    let frame
    let before = performance.now()
    let shown = { x: null, lean: null, stick: null }
    const tick = (now) => {
      const dt = Math.min(0.05, (now - before) / 1000)
      before = now
      const a = aim.current
      const rail = railRef.current
      if (rail && !busyRef.current) {
        const dir = (dirs.current.right ? 1 : 0) - (dirs.current.left ? 1 : 0)
        if (dir) a.target = clamp(a.target + dir * SPEED * dt, AIM_MIN, AIM_MAX)
        a.cur = reduced ? a.target : a.cur + (a.target - a.cur) * (1 - Math.exp(-dt * 7))
        if (Math.abs(a.target - a.cur) < 0.05) a.cur = a.target
        if (shown.x !== a.cur) {
          shown.x = a.cur
          rail.style.transform = moveTo(a.cur)
        }
        const deg = reduced ? 0 : clamp((a.target - a.cur) * 0.32, -10, 10)
        if (shown.lean !== deg) {
          shown.lean = deg
          swingRef.current?.style.setProperty('--lean', deg.toFixed(2))
        }
        if (shown.stick !== dir) {
          shown.stick = dir
          svgRef.current?.style.setProperty('--stick', String(dir * 16))
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduced])

  // Tocar o arrastrar sobre el cristal también mueve el gancho.
  const aimAt = (event) => {
    if (busyRef.current) return
    const box = svgRef.current.getBoundingClientRect()
    aim.current.target = clamp(((event.clientX - box.left) / box.width) * W, AIM_MIN, AIM_MAX)
  }
  const onGlassDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    aimAt(event)
  }
  const onGlassMove = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) aimAt(event)
  }

  const hold = (side, on) => () => {
    dirs.current[side] = on
  }
  const step = (dir) => (event) => {
    // Con teclado (clic sin puntero) el botón da un paso corto.
    if (event.detail === 0 && !busyRef.current) {
      aim.current.target = clamp(aim.current.target + dir * 48, AIM_MIN, AIM_MAX)
    }
  }

  const nudge = (delta) => setBet(clampBet(shownBet + delta, maxBet))

  const onKeys = useEffectEvent((event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.matches('input, select, textarea')) return
    const down = event.type === 'keydown'
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault()
      dirs.current[event.code === 'ArrowLeft' ? 'left' : 'right'] = down
    } else if (!down) {
      return
    } else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      event.preventDefault()
      if (canBet) nudge((event.code === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1) * STEP)
    } else if (event.code === 'Space' || event.code === 'Enter') {
      if (event.repeat || target?.matches('button:focus-visible, a')) return
      event.preventDefault()
      drop()
    }
  })
  useEffect(() => {
    const release = () => {
      dirs.current = { left: false, right: false }
    }
    window.addEventListener('keydown', onKeys)
    window.addEventListener('keyup', onKeys)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onKeys)
      window.removeEventListener('keyup', onKeys)
      window.removeEventListener('blur', release)
    }
  }, [])

  // Si se acaba el tiempo de un aviso o se termina la celebración, el letrero vuelve a su sitio.
  const marquee = fx === 2 ? '¡JACKPOT!' : fx === 1 ? '¡PREMIO!' : 'GANCHO'

  let status = 'Mueve el gancho con ← →, elige la apuesta y suéltalo.'
  if (juegos.error) status = juegos.error
  else if (stage === 'down') status = 'El gancho baja…'
  else if (stage === 'grab') status = 'Las pinzas se cierran…'
  else if (stage === 'lift') status = 'Sube con algo entre las pinzas…'
  else if (stage === 'slip') status = '¡Se resbala!'
  else if (busy) status = 'El premio va hacia la bandeja…'
  else if (broke) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
  else if (last) status = last.text
  else if (balance < shownBet) status = 'No te alcanza para esta apuesta: elige una menor.'
  const lastWon = !busy && last && last.payout > last.bet
  const best = history.reduce((top, h) => Math.max(top, h.ratio), 0)
  const [tableOpen, setTableOpen] = useState(() => window.innerWidth > 900 && window.innerHeight >= 900)

  return (
    <main className="app claw-app">
      <header className="top">
        <h1>Gancho</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd className={lastWon ? 'money__up' : ''}>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>Apuesta</dt>
              <dd>{eur(shownBet)}</dd>
            </div>
          </dl>
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
            <PowerButton request={juegos.request} game="claw" hit={juegos.powerHit} />
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
                Elige tu apuesta, mueve el gancho sobre el cristal y suéltalo. Las pinzas bajan, agarran un premio y lo
                llevan al conducto. Si se escurre, pierdes la apuesta.
              </p>
              <p>
                <b>Dónde sueltes el gancho no cambia las probabilidades.</b> El premio se sortea en el servidor al
                soltar, igual de justo en cualquier punto: el gancho solo baja a recogerlo.
              </p>
              <ul className="claw__help-list">
                {PRIZES.map((p) => (
                  <li key={p.id}>
                    <b>{p.name}</b>: {multLabel(p.mult)} ({chanceLabel(p.odds)})
                  </li>
                ))}
                <li>
                  <b>Se escapa</b>: pierdes la apuesta ({chanceLabel(MISS_ODDS)})
                </li>
              </ul>
              <p>
                Apuesta de {eur(MIN_BET)} a {eur(MAX_BET)} en pasos de {eur(STEP)}. Con el premio gordo, ×200, 50 € se
                convierten en 10.000 €.
              </p>
              <p>
                Teclado: <kbd>←</kbd> <kbd>→</kbd> mueven el gancho (o arrastra sobre el cristal), <kbd>Espacio</kbd> o{' '}
                <kbd>Intro</kbd> lo sueltan, <kbd>↑</kbd> <kbd>↓</kbd> cambian la apuesta.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="claw fill">
        <section className="claw__machine" aria-label="Máquina de gancho">
          <p
            className={`status ${lastWon ? 'status--win' : ''} ${!busy && last && last.prize < 0 ? 'status--lose' : ''}`}
            aria-live="polite"
          >
            {status}
          </p>
          <div className={`claw__cab ${busy ? 'is-busy' : ''} ${fx ? `is-fx${fx}` : ''}`}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label="Máquina de gancho con un montón de premios tras el cristal"
            >
              <ClawDefs />
              <Cabinet marquee={marquee} bet={shownBet} />
              <g className="claw__pile">
                {PILE.map((p) => (
                  <g
                    key={p.id}
                    ref={(el) => {
                      if (el) pileRefs.current.set(p.id, el)
                      else pileRefs.current.delete(p.id)
                    }}
                    style={{ transform: itemAt(p.x, p.y, p.scale, p.rot) }}
                  >
                    <PrizeItem id={typeof p.kind === 'number' ? PRIZES[p.kind].id : 'plush'} tone={p.tone} />
                  </g>
                ))}
              </g>
              {fx > 0 && !busy && (
                <circle key={last?.id} className="claw__halo" cx={CHUTE_X} cy={TRAY_Y} r="96" fill="url(#cw-halo)" />
              )}

              {/* Premio que se está pescando (suelto, no colgado de las pinzas) */}
              <g ref={itemRef} className={`claw__item ${held ? 'is-held' : ''}`} style={{ opacity: 0 }}>
                {item && <PrizeItem id={item.id} tone={item.tone} />}
              </g>

              {/* Gancho: el carro corre por el riel y de él cuelga el cable, que se balancea */}
              <g ref={railRef} className="claw__rail" style={{ transform: moveTo(MID_X) }}>
                <line className="claw__guide" x1="0" y1={HOME_Y + 70} x2="0" y2={FLOOR} />
                <g transform={`translate(0 ${PIVOT_Y})`}>
                  <g ref={swingRef} className="claw__swing">
                    <g className="claw__idle">
                      <g ref={cableRef} style={{ transform: cableAt(HOME_Y) }}>
                        <Cable />
                      </g>
                      <g ref={headRef} className="claw__head" data-grip="idle" style={{ transform: headAt(HOME_Y) }}>
                        <ClawHead>
                          {held && item && (
                            <g transform={`translate(0 ${HELD_DY}) scale(${PRIZE_S})`}>
                              <PrizeItem id={item.id} tone={item.tone} />
                            </g>
                          )}
                        </ClawHead>
                      </g>
                    </g>
                  </g>
                </g>
                <Carriage />
              </g>

              <rect
                className="claw__hit"
                x="44"
                y="92"
                width="712"
                height="390"
                fill="transparent"
                onPointerDown={onGlassDown}
                onPointerMove={onGlassMove}
              />
              <GlassFront />
              {fx === 2 && <rect key={last?.id} className="claw__flash" x="0" y="0" width={W} height={H} rx="30" />}
            </svg>
          </div>
        </section>

        <aside className="claw__panel">
          <div className="claw__group">
            <h2>Apuesta</h2>
            <label className="claw__slider">
              <span className="claw__amount">{eur(shownBet)}</span>
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
              <span className="claw__scale">
                <span>{eur(MIN_BET)}</span>
                <span>{eur(Math.max(maxBet, MIN_BET))}</span>
              </span>
            </label>
            <div className="claw__quick">
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

          <div className="claw__group claw__control">
            <h2>Gancho</h2>
            <div className="claw__move">
              <button
                type="button"
                disabled={busy}
                aria-label="Mover el gancho a la izquierda"
                onPointerDown={hold('left', true)}
                onPointerUp={hold('left', false)}
                onPointerLeave={hold('left', false)}
                onPointerCancel={hold('left', false)}
                onContextMenu={(event) => event.preventDefault()}
                onClick={step(-1)}
              >
                ◀ <kbd>←</kbd>
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label="Mover el gancho a la derecha"
                onPointerDown={hold('right', true)}
                onPointerUp={hold('right', false)}
                onPointerLeave={hold('right', false)}
                onPointerCancel={hold('right', false)}
                onContextMenu={(event) => event.preventDefault()}
                onClick={step(1)}
              >
                <kbd>→</kbd> ▶
              </button>
            </div>
            <div className="actions claw__actions">
              {!broke && (
                <button type="button" className="primary" disabled={!canDrop} onClick={drop}>
                  {busy ? 'Pescando…' : 'Soltar gancho'} <kbd>Espacio</kbd>
                </button>
              )}
            </div>
            <p className="claw__note">
              La posición del gancho no cambia las probabilidades: el premio sale por sorteo.
            </p>
          </div>

          <div className="claw__group">
            <h2>Últimos intentos</h2>
            {history.length === 0 ? (
              <p className="claw__hint">Todavía no has pescado nada.</p>
            ) : (
              <>
                <ol className="claw__history" aria-label="Últimos intentos">
                  {history.slice(0, 10).map((h) => (
                    <li key={h.id} className={`claw__chip claw__chip--${toneOf(h.ratio)}`}>
                      {h.prize < 0 ? '✕' : multLabel(PRIZES[h.prize].mult)}
                    </li>
                  ))}
                </ol>
                <p className="claw__hint">Mejor: {best ? multLabel(Math.round(best * 10) / 10) : '–'}</p>
              </>
            )}
          </div>

          <details
            className="claw__group claw__table"
            open={tableOpen}
            onToggle={(event) => setTableOpen(event.currentTarget.open)}
          >
            <summary>Premios y probabilidades</summary>
            <table>
              <tbody>
                {PRIZES.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <svg viewBox="-42 -42 84 84" aria-hidden="true">
                        <PrizeItem id={p.id} />
                      </svg>
                    </td>
                    <th scope="row">{p.name}</th>
                    <td className="claw__mult">{multLabel(p.mult)}</td>
                    <td>{chanceLabel(p.odds)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <svg viewBox="-42 -42 84 84" aria-hidden="true">
                      <PrizeItem id="plush" tone={2} />
                    </svg>
                  </td>
                  <th scope="row">Se escapa</th>
                  <td className="claw__mult">✕</td>
                  <td>{chanceLabel(MISS_ODDS)}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </aside>
      </div>

      {burst && (
        <WinBurst
          key={burst.id}
          amount={burst.amount}
          caption={`${burst.prize === 0 ? '¡Premio gordo! ' : ''}${PRIZES[burst.prize].name} ${multLabel(PRIZES[burst.prize].mult)} con ${eur(burst.bet)}`}
          coins={Math.min(70, Math.round(20 + PRIZES[burst.prize].mult * 1.5))}
          big={PRIZES[burst.prize].mult >= 25}
          who={juegos.me?.name}
        />
      )}
    </main>
  )
}

export default Claw
