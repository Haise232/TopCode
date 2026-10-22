import { useEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import {
  DEPTH,
  MIN_BET,
  OFFICES,
  STEP,
  clampBet,
  gainLabel,
  grow,
  loses,
  maxBetFor,
  safeChance,
  toneOf,
} from './bribe.js'
import { eur } from './money.js'
import {
  buzz,
  isMuted,
  playCash,
  playChip,
  playRegister,
  playRustle,
  playSiren,
  playStall,
  playStamp,
  playWin,
  setMuted,
} from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import PowerButton from './PowerButton.jsx'
import { Briefcase, CAST, ContractStamp, Envelope, Official, Siren } from './BribeArt.jsx'
import OfficeScene from './BribeScene.jsx'
import './Bribe.css'

const SLIDE_MS = 750 // el sobre cruza la mesa
const REST_MS = 450 // después reaccionan los otros dos
const NEXT_MS = 1500 // y, si sigues libre, subes al despacho siguiente
const HISTORY = 40

// Textos de ambiente (solo de adorno: el resultado lo decide el servidor).
const AMBIENCE = [
  [
    'El ayuntamiento huele a café y a recalificación. Elige a quién entregar el sobre.',
    'Concejalía de urbanismo: tres mesas, un sobre y mucha fe en la burocracia.',
    'Un reloj sin pilas y tres funcionarios con mucha prisa por ayudarte.',
  ],
  [
    'La diputación: carpetas por todas partes y ninguna con el sello correcto.',
    'Área de obras. Aquí las rotondas se adjudican solas.',
    'Se oye una fotocopiadora y, al fondo, una licitación a medida.',
  ],
  [
    'La consejería: moqueta nueva y subvenciones de siempre.',
    'Dirección general. Al fondo, un gráfico que solo sube. Cuidado con el que no.',
    'Una planta de plástico, un café de máquina y tres decisiones de peso.',
  ],
  [
    'El juzgado. Aquí un sobre sale caro: dos de cada tres te denuncian.',
    'Instrucción. Se oye el eco de un mazo. La balanza no está para bromas.',
    'Togas, sumarios y una puerta que parece demasiado pesada para salir.',
  ],
  [
    'El ministerio: mármol, silencio y un pinganillo que escucha demasiado.',
    'Secretaría de Estado. Aquí hasta los sobres llevan registro de entrada.',
    'Lámparas de araña y moqueta gruesa. Nadie oye tus pasos, pero sí tu maletín.',
  ],
  [
    'La presidencia. Alfombra roja y un gabinete que lo ve todo. Dos de cada tres te denuncian.',
    'El último despacho. Un paso más y lo blanqueas todo.',
    'Cuadros enormes, relojes de pie y mucha gente que no recuerda nada.',
  ],
]

// Lo que dice cada cargo según su reacción: frases comunes y frases de cada despacho.
const QUOTES = {
  deal: [
    'Qué casualidad, justo tenía un contrato sin adjudicar.',
    'Esto no es un sobre, es un donativo para las fiestas del patrón.',
    'Adjudicado. Sin concurso, que es más ágil.',
    'Un detalle muy generoso. Cuente con mi discreción.',
    'Dónde hay que firmar. Mejor, firmo yo por usted.',
    'Qué sobre más bonito. Pase, pase, que le adjudico lo que quiera.',
  ],
  stall: [
    'Vuelva usted mañana.',
    'Lo estudiaremos con la máxima celeridad: tres años.',
    '¿Sobre? ¿Qué sobre? Yo aquí no he visto nada.',
    'Me parece muy bien. Ya le llamaremos.',
    'Falta un sello. Y yo me quedo esto por si acaso.',
    'Eso no es de mi departamento, pero el sobre sí.',
  ],
  report: [
    '¡Esto es un escándalo! ¡Llamo a la policía!',
    '¡Seguridad! ¡Este individuo me ofrece un sobre!',
    '¡Aquí hay un delito y un maletín!',
    '¡Yo soy un servidor público intachable!',
    '¡Agentes, aquí! ¡Que no salga nadie!',
    '¿Con quién cree que está hablando? ¡Voy a denunciarle ahora mismo!',
  ],
  wire: [
    'Gracias por el sobre. Sonría, que esto se está grabando.',
    '¿Puede repetir lo del sobre, más cerca del micrófono?',
    'Qué bien se le oye desde la furgoneta de abajo.',
    'Tenga su recibo. Y mi micrófono, que no lo había visto.',
  ],
}
const OFFICE_QUOTES = [
  {
    deal: ['Esa parcela se recalifica sola, no se preocupe.'],
    stall: ['Hay que pedir cita previa. Para pedir la cita, cita previa.'],
    report: ['¡En este ayuntamiento esto no se hace! ¡Ni de día!'],
  },
  {
    deal: ['Obra pública, cobro privado: lo de siempre.'],
    stall: ['El pliego está en revisión desde la legislatura pasada.'],
    report: ['¡Una rotonda no se compra!'],
  },
  {
    deal: ['Una subvención, y de las gordas.'],
    stall: ['Primero hay que rellenar el anexo 14-B.'],
    report: ['¡Yo aquí solo reparto ayudas legales!'],
  },
  {
    deal: ['Digamos que el sumario se extravía.'],
    stall: ['Me reservo el sobre como prueba. De momento.'],
    report: ['¡Esto es un delito de cohecho, y lo digo con la toga puesta!'],
  },
  {
    deal: ['Esto pasa por mi mesa con carácter reservado.'],
    stall: ['Se lo pasaré a la subsecretaría, que lo pasará a la dirección.'],
    report: ['¡Protocolo de seguridad! ¡Cierren las puertas!'],
  },
  {
    deal: ['Esto queda entre usted, yo y el cuñado de alguien.'],
    stall: ['El presidente le recibirá cuando quiera. O sea, nunca.'],
    report: ['¡Atrévase a repetirlo delante de las cámaras!'],
  },
]
// Lo que dices tú cuando te pillan.
const CAUGHT = [
  'Tú: «Esto no es lo que parece.»',
  'Tú: «¿Sobre? ¿Qué sobre?»',
  'Tú: «Me acojo a mi derecho a no declarar.»',
  'Tú: «Era para la fiesta del barrio, lo juro.»',
  'Tú: «Yo solo pasaba por aquí con un maletín.»',
]
// Lo que dicen los demás cargos tras una reacción, solo la etiqueta de la mesa.
const TAGS = { deal: 'Adjudicado', stall: 'Largas', report: '¡Denuncia!', wire: '¡Micrófono!' }
const TAGS_OTHER = { deal: 'Aceptaba', stall: 'Daba largas', report: 'Denunciaba', wire: 'Micrófono' }
const SHORT = ['Ayto.', 'Dipu.', 'Cons.', 'Juzg.', 'Mini.', 'Pres.']
const REACT_NAME = { deal: 'acepta el sobre', stall: 'da largas', report: 'denuncia', wire: 'llevaba un micrófono' }

const any = (list) => list[Math.floor(Math.random() * list.length)]
const pickBy = (list, n) => list[Math.abs(n) % list.length]

function flavorOf(react, office, who, pot) {
  const pool = [...QUOTES[react], ...(OFFICE_QUOTES[office][react] ?? [])]
  const quote = `${who.name}: «${any(pool)}»`
  if (react === 'deal') return `${quote} Contrato adjudicado: ${gainLabel(office)}.`
  if (react === 'stall') return `${quote} Se queda el sobre y no ganas nada.`
  return `${quote} ${any(CAUGHT)} Pierdes ${eur(pot)}.`
}

// Resumen del despacho: «1 acepta ×2 · 1 da largas · 1 denuncia».
function contents(office) {
  const { reacts, wirePct } = OFFICES[office]
  const n = (k) => reacts.filter((r) => r === k).length
  const parts = []
  if (n('deal')) parts.push(`${n('deal')} ${n('deal') > 1 ? 'aceptan' : 'acepta'} ${gainLabel(office)}`)
  if (n('stall')) parts.push('1 da largas')
  if (n('report')) parts.push(`${n('report')} ${n('report') > 1 ? 'denuncian' : 'denuncia'}`)
  return parts.join(' · ') + (wirePct ? ` (el que da largas lleva micrófono ${wirePct} de cada 100 veces)` : '')
}

const ratioText = (r) => `×${String(Math.round(r * 10) / 10).replace('.', ',')}`

// Luces de la redada: sirenas, destellos y cinta policial sobre el despacho.
function Raid() {
  return (
    <div className="bb__raid" aria-hidden="true">
      <span className="bb__raid-blob bb__raid-blob--red" />
      <span className="bb__raid-blob bb__raid-blob--blue" />
      <div className="bb__raid-siren bb__raid-siren--l">
        <Siren tone="red" />
      </div>
      <div className="bb__raid-siren bb__raid-siren--r">
        <Siren tone="blue" />
      </div>
      <p className="bb__raid-shout">¡Policía! ¡Todos quietos!</p>
    </div>
  )
}

// La trama la sortea el servidor con el saldo semanal (cuenta en el Score): cada soborno lo pide el jugador y aquí solo
// se anima.
function Bribe({ onExit, juegos }) {
  const [bet, setBet] = useState(50)
  const [sound, setSound] = useState(() => !isMuted())
  const [run, setRun] = useState(null) // { bet, pot, office } mientras hay una trama en marcha
  const [reveal, setReveal] = useState(null) // mesas reveladas: { office, reacts, pick, react, text, all, id }
  const [asking, setAsking] = useState(false)
  const [last, setLast] = useState(null) // última trama liquidada
  const [history, setHistory] = useState([]) // { id, ratio, stake, end }
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
        { id: result.round, ratio: result.payout / result.stake, stake: result.stake, end: result.end },
        ...list,
      ].slice(0, HISTORY)
    })
  }

  const resync = useEffectEvent(async () => {
    const body = await request({ t: 'solo_bribe', a: 'sync' })
    const view = body?.solo
    if (!view) return false
    if (view.bet > 0) {
      setRun({ bet: view.bet, pot: view.pot, office: view.office })
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

  const office = run ? run.office : reveal ? reveal.office : 0
  const top = !run && last?.end === 'top' && Boolean(reveal?.all)
  const maxBet = maxBetFor(balance)
  const shownBet = run ? run.bet : clampBet(bet, maxBet)
  const broke = !run && !animating && balance < MIN_BET
  const busy = asking || animating || !ready
  const canPick = Boolean(run) && !busy && !reveal

  async function act(message) {
    if (busy || lock.current) return null
    lock.current = true
    setAsking(true)
    const body = await request({ t: 'solo_bribe', ...message })
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
    setRun({ bet: view.bet, pot: view.pot, office: view.office })
  }

  async function offer(pick) {
    if (!canPick) return
    const before = run.pot
    const view = await act({ a: 'bribe', pick })
    if (!view) return
    const react = view.reacts[view.pick]
    playRustle()
    setReveal({
      id: Date.now(),
      office: view.at,
      reacts: view.reacts,
      pick: view.pick,
      react,
      text: flavorOf(react, view.at, CAST[view.at][view.pick], before),
      all: false,
      moving: true,
      view,
    })
  }

  // Línea de tiempo de un soborno: el sobre cruza la mesa, reacciona el elegido, reaccionan los demás y se sube (o se acaba).
  const afterSlide = useEffectEvent(() => {
    const { react, view } = reveal
    setReveal((r) => ({ ...r, shown: true }))
    if (react === 'deal') {
      playStamp()
      playCash(2)
      buzz(40)
    } else if (react === 'stall') playStall()
    else playSiren()
    if (loses(react)) {
      setHurt((n) => n + 1)
      buzz([60, 40, 160])
      setRun(null)
      record(view.last)
      setBalance(view.balance)
    } else {
      setRun({ bet: view.bet || run.bet, pot: view.bet > 0 ? view.pot : view.last.payout, office: run.office })
    }
  })
  const afterAll = useEffectEvent(() => {
    const { react, view } = reveal
    if (loses(react)) {
      setReveal((r) => ({ ...r, all: true, moving: false }))
    } else if (view.bet > 0) {
      setReveal((r) => ({ ...r, all: true }))
    } else {
      // Llegaste a la presidencia: cobra solo.
      setRun(null)
      record(view.last)
      setBalance(view.balance)
      setReveal((r) => ({ ...r, all: true, moving: false }))
      celebrate(view.last)
    }
  })
  const nextOffice = useEffectEvent(() => {
    const { view } = reveal
    setRun({ bet: view.bet, pot: view.pot, office: view.office })
    setReveal(null)
  })
  useEffect(() => {
    if (!reveal?.moving) return
    const k = reduced ? 0.3 : 1
    const timers = [setTimeout(afterSlide, SLIDE_MS * k), setTimeout(afterAll, (SLIDE_MS + REST_MS) * k)]
    if (!loses(reveal.react) && reveal.view.bet > 0)
      timers.push(setTimeout(nextOffice, (SLIDE_MS + REST_MS + NEXT_MS) * k))
    return () => timers.forEach(clearTimeout)
  }, [reveal?.id, reduced])

  async function cash() {
    if (busy || !run || reveal) return
    const view = await act({ a: 'cash' })
    if (!view) return
    setRun(null)
    record(view.last)
    setBalance(view.balance)
    playRegister()
    celebrate(view.last)
  }

  function celebrate(result) {
    if (result.net <= 0) return
    const ratio = result.payout / result.stake
    playCash(Math.min(10, ratio))
    playWin(ratio >= 10)
    buzz(ratio >= 10 ? [60, 40, 60, 40, 160] : [60, 40, 80])
    setBurst({ id: result.round, amount: result.net, ratio, stake: result.stake, top: result.end === 'top' })
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
      offer(digit % 3)
    } else if (event.code === 'Space') {
      if (target?.matches('button:focus-visible')) return
      event.preventDefault()
      if (!run) start()
    } else if (event.code === 'KeyC' || event.code === 'Enter') {
      if (target?.matches('button, a') || !run) return
      event.preventDefault()
      cash()
    } else if ((event.code === 'ArrowUp' || event.code === 'ArrowDown') && canBet) {
      event.preventDefault()
      nudge((event.code === 'ArrowDown' ? -1 : 1) * (event.shiftKey ? 10 : 1) * STEP)
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKeys)
    return () => window.removeEventListener('keydown', onKeys)
  }, [])

  let status = 'Elige tu apuesta: será el maletín con el que subes por la trama.'
  if (juegos.error) status = juegos.error
  else if (!ready) status = 'Convocando a los funcionarios…'
  else if (reveal && (reveal.moving || !run)) status = reveal.shown ? reveal.text : 'Deslizas el sobre por la mesa…'
  else if (broke) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
  else if (asking && run) status = 'Deslizas el sobre por la mesa…'
  else if (run) status = pickBy(AMBIENCE[run.office], run.office + run.bet / STEP)
  else if (last?.end === 'cash' && last.net > 0)
    status = `Maletín blanqueado: sales con ${eur(last.payout)}. Ganaste ${eur(last.net)}.`
  else if (last?.end === 'cash') status = 'Sales por la puerta de atrás con tu maletín intacto. Aquí no ha pasado nada.'
  else if (last && last.end !== 'top')
    status = `Te pillaron en ${OFFICES[Math.min(last.office, DEPTH - 1)].name.toLowerCase()}. Perdiste ${eur(last.stake)}.`
  if (top)
    status = `¡La cúpula! Subiste los ${DEPTH} despachos y blanqueas ${eur(last.payout)} sin que nadie recuerde nada.`

  const lastWon = !run && last?.net > 0
  const tension = run ? (run.office >= DEPTH - 1 ? 2 : run.office >= 3 ? 1 : 0) : 0
  const dead = Boolean(reveal && loses(reveal.react) && reveal.all)
  const raid = Boolean(reveal && loses(reveal.react) && reveal.shown)
  const best = history.reduce((max, h) => Math.max(max, h.ratio), 0)
  const climbing = Boolean(reveal?.all && !loses(reveal.react) && reveal.view.bet > 0)
  const officeName = top ? 'La cúpula' : OFFICES[office].name
  const potNow = run ? run.pot : null
  const caseLevel = potNow === null ? 1 : potNow >= run.bet * 12 ? 3 : potNow >= run.bet * 3 ? 2 : 1

  return (
    <main className="app bb-app" data-tension={tension}>
      <header className="top">
        <h1>Sobornos</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd className={lastWon ? 'money__up' : ''}>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>{run ? 'Maletín' : 'Apuesta'}</dt>
              <dd>{eur(run ? shownPot : shownBet)}</dd>
            </div>
          </dl>
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
            <PowerButton request={juegos.request} game="bribe" hit={juegos.powerHit} />
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
                <b>Sobornos es una sátira: todo es ficción.</b> Los personajes, los nombres y los despachos son
                inventados y no se parecen a nadie real. Es una comedia de sobres, maletines y mariscadas.
              </p>
              <p>
                Pon tu apuesta: es tu <b>maletín</b>. Subes por {DEPTH} despachos (ayuntamiento, diputación, consejería,
                juzgado, ministerio y presidencia). En cada uno hay <b>tres cargos</b> y eliges a quién deslizarle el
                sobre:
              </p>
              <ul>
                <li>
                  <b>Acepta</b>: te adjudica un contrato y el maletín se multiplica (×2, ×1,5, ×3…). Subes de despacho.
                </li>
                <li>
                  <b>Da largas</b>: se queda el sobre, pero no ganas ni pierdes nada. Subes de despacho.
                </li>
                <li>
                  <b>Denuncia</b>: llega la policía y pierdes todo el maletín. En el ayuntamiento, el que da largas a
                  veces lleva un <b>micrófono oculto</b>, y entonces también lo pierdes todo.
                </li>
              </ul>
              <p>
                Cada despacho dice qué hay en él (por ejemplo, «1 acepta ×2 · 1 da largas · 1 denuncia»). Quién es cada
                cargo se baraja al elegir, así que ninguna mesa es mejor que otra. Entre despacho y despacho puedes{' '}
                <b>blanquear y salir</b> con lo que llevas. Si superas la presidencia, cobras solo. Aceptando siempre,
                el maletín llega a ×108.
              </p>
              <p>
                El retorno es del <b>96 %</b> salgas cuando salgas: la ventaja de la casa no depende de cuándo
                blanquees.
              </p>
              <p>
                Teclado: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> eligen cargo, <kbd>Espacio</kbd> empieza, <kbd>C</kbd> o{' '}
                <kbd>Intro</kbd> blanquea y sale, <kbd>↑</kbd> <kbd>↓</kbd> cambian la apuesta.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="bb fill">
        <section className="bb__machine" aria-label="Sobornos">
          <p className={`status ${lastWon ? 'status--win' : ''} ${dead ? 'status--lose' : ''}`} aria-live="polite">
            {status}
          </p>
          <div
            className={`bb__hall ${hurt ? 'is-hurt' : ''} ${dead ? 'is-dead' : ''} ${top ? 'is-top' : ''}`}
            data-office={office}
          >
            <OfficeScene key={`${office}-${top ? 't' : ''}`} office={office} top={top} />
            <div className="bb__light" />
            <div className="bb__banner">
              <span className="bb__depth">
                {top ? (
                  '★'
                ) : (
                  <>
                    Despacho {office + 1} de {DEPTH}
                    <span className="bb__role"> · {OFFICES[office].role}</span>
                  </>
                )}
              </span>
              <h2 key={officeName}>{officeName}</h2>
            </div>
            <div className={`bb__case-chip ${dead ? 'is-lost' : ''} ${lastWon ? 'is-won' : ''}`}>
              <Briefcase level={top ? 3 : caseLevel} shut={dead} />
              <span>{eur(run ? shownPot : top && last ? last.payout : shownBet)}</span>
            </div>
            {top ? (
              <div className="bb__vault">
                <div className="bb__haul">
                  <Briefcase level={3} />
                  <span className="bb__haul-stamp">
                    <ContractStamp label={ratioText(last.payout / last.stake)} />
                  </span>
                </div>
              </div>
            ) : (
              <div className={`bb__desks ${climbing ? 'is-climbing' : ''}`} key={reveal?.office ?? office}>
                {CAST[office].map((spec, i) => {
                  const react = reveal?.reacts[i]
                  const isPick = reveal && i === reveal.pick
                  const opened = reveal && (isPick ? reveal.shown : reveal.all)
                  const mood = opened ? react : 'idle'
                  const cls = [
                    'bb__slot',
                    isPick ? 'is-pick' : '',
                    reveal && !isPick ? 'is-other' : '',
                    opened ? `has-${react}` : '',
                  ].join(' ')
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cls}
                      disabled={!canPick}
                      onClick={() => offer(i)}
                      aria-label={
                        opened
                          ? `Mesa ${i + 1}: ${spec.name} ${REACT_NAME[react]}`
                          : `Mesa ${i + 1}: sobornar a ${spec.name}, ${spec.role}`
                      }
                    >
                      <span className="bb__figure">
                        <Official spec={spec} office={office} slot={i} mood={mood} />
                      </span>
                      {isPick && !reveal.shown && (
                        <span className="bb__env">
                          <Envelope />
                        </span>
                      )}
                      {isPick && opened && react === 'deal' && (
                        <span className="bb__stamp">
                          <ContractStamp label={gainLabel(reveal.office)} />
                        </span>
                      )}
                      {opened && (
                        <span className={`bb__tag bb__tag--${react}`}>{isPick ? TAGS[react] : TAGS_OTHER[react]}</span>
                      )}
                      <span className="bb__num">{i + 1}</span>
                      <span className="bb__plaque">
                        <b>{spec.name}</b>
                        <i>{spec.role}</i>
                      </span>
                    </button>
                  )
                })}
                {raid && <div className="bb__tape">{'NO PASAR · INVESTIGACIÓN EN CURSO · '.repeat(6)}</div>}
              </div>
            )}
            {raid && <Raid key={reveal.id} />}
            <ol className="bb__board" aria-label="Organigrama de despachos">
              {OFFICES.map((o, i) => {
                const lostHere = dead && i === reveal.office
                const state = lostHere
                  ? 'is-lost'
                  : top || i < office || (reveal && !loses(reveal.react) && i === reveal.office)
                    ? 'is-past'
                    : i === office && (run || reveal)
                      ? 'is-here'
                      : ''
                return (
                  <li
                    key={o.name}
                    className={`bb__step ${state}`}
                    title={o.name}
                    aria-current={state === 'is-here' ? 'step' : undefined}
                    style={{ '--tilt': `${[-2.4, 1.8, -1.2, 2.2, -2, 1.4][i]}deg` }}
                  >
                    <span className="bb__pin" />
                    <span className="bb__photo">{lostHere ? '✕' : i + 1}</span>
                    <span className="bb__abbr">{SHORT[i]}</span>
                  </li>
                )
              })}
              <li className={`bb__step bb__step--gold ${top ? 'is-past' : ''}`} title="La cúpula">
                <span className="bb__pin" />
                <span className="bb__photo">★</span>
                <span className="bb__abbr">Cobro</span>
              </li>
            </ol>
          </div>
        </section>

        <aside className="bb__panel">
          <div className="bb__group bb__now">
            <h2>Ahora</h2>
            {run ? (
              <>
                <span className="bb__amount" aria-hidden="true">
                  {eur(shownPot)}
                </span>
                <p className="bb__odds">
                  {contents(run.office)}
                  <br />
                  Si aceptan, contrato <b>{gainLabel(run.office)}</b>: <b>{eur(grow(run.pot, run.office))}</b> · sin
                  denuncia <b>{safeChance(run.office)} %</b>
                  <span className="bb__odds-bar" style={{ '--p': safeChance(run.office) / 100 }} />
                </p>
              </>
            ) : (
              <p className="bb__hint">Sin trama en marcha. Elige la apuesta y entra por la puerta del ayuntamiento.</p>
            )}
          </div>

          <div className="bb__group">
            <h2>Apuesta</h2>
            <label className="bb__slider">
              <span className="bb__amount">{eur(shownBet)}</span>
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
            <div className="bb__quick">
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

          <div className="actions bb__actions">
            {!run && !broke && (
              <button type="button" className="primary" disabled={busy || shownBet > balance} onClick={start}>
                {asking ? 'Entrando…' : 'Entrar en la trama'} <kbd>Espacio</kbd>
              </button>
            )}
            {run && (
              <>
                <p className="bb__hint bb__pick">{reveal ? 'Subiendo…' : 'Elige a quién dar el sobre'}</p>
                <button type="button" className="bb__cash" disabled={busy || Boolean(reveal)} onClick={cash}>
                  Blanquear y salir con {eur(run.pot)} <kbd>C</kbd>
                </button>
              </>
            )}
          </div>

          <div className="bb__group">
            <h2>Últimas tramas</h2>
            {history.length === 0 ? (
              <p className="bb__hint">Todavía no has intentado ninguna.</p>
            ) : (
              <>
                <ol className="bb__history" aria-label="Últimas tramas">
                  {history.slice(0, 10).map((h) => (
                    <li key={h.id} className={`bb__chip bb__chip--${toneOf(h.ratio)}`}>
                      {h.end === 'top' ? '★' : h.ratio > 0 ? ratioText(h.ratio) : '✕'}
                    </li>
                  ))}
                </ol>
                <p className="bb__hint">Mejor: {best ? ratioText(best) : '–'}</p>
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
            burst.top
              ? `¡La cúpula! ${ratioText(burst.ratio)}`
              : `Maletín blanqueado: ${eur(burst.amount + burst.stake)} con ${eur(burst.stake)}`
          }
          coins={Math.min(70, 20 + Math.round(burst.ratio * 3))}
          big={burst.top || burst.ratio >= 10}
          who={juegos.me?.name}
        />
      )}
    </main>
  )
}

export default Bribe
