import { useCallback, useEffect, useRef, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import {
  CUT,
  JOIN_MS,
  MAX_STAKE,
  MIN_PLAYERS,
  MIN_STAKE,
  PICK_MS,
  ROUND_MS,
  STAKE_STEP,
  STEPS,
  crossEnd,
  phaseAt,
  revealOf,
  stepStart,
} from './bridge.js'
import { eur } from './money.js'
import { buzz, isMuted, playCash, playChip, playLose, playSplash, playStamp, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import Avatar from './Avatar.jsx'
import './season3.css'

const JOIN_POLL_MS = 3000
const SHOW_WAIT_MS = 700 // tras cerrar cada elección, lo que se espera para pedir el cristal (el servidor lo suelta a los 600 ms)
const SIDE_NAMES = { L: 'Izquierda', R: 'Derecha' }

// Puente de Cristal en vivo: el servidor guarda quién entra y qué elige, rompe los cristales y reparte el bote.
function Bridge({ onExit, juegos }) {
  const [live, setLive] = useState(null)
  const [stake, setStake] = useState(500)
  const [sending, setSending] = useState(false)
  const [sound, setSound] = useState(() => !isMuted())
  const [burst, setBurst] = useState(null)
  const [, setTick] = useState(0)
  const skew = useRef(null)
  const heard = useRef({ round: null, shown: 0, paid: null }) // para que cada sonido suene una vez
  const { request } = juegos
  const balance = juegos.me?.balance ?? 0
  const shownBank = useCountUp(balance)

  const clock = useCallback(() => Date.now() + (skew.current ?? 0), [])
  const ask = useCallback(
    async (message) => {
      const sent = Date.now()
      const body = await request({ t: 'bridge', ...message })
      const got = Date.now()
      if (body?.bridge) {
        if (skew.current === null || got - sent < 1500) skew.current = body.bridge.now - (sent + got) / 2
        setLive(body.bridge)
      }
      return body
    },
    [request],
  )

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 200)
    return () => clearInterval(timer)
  }, [])

  const ready = skew.current !== null && live !== null
  const t = clock()
  const { round, phase, step, pick: picking, offset } = phaseAt(t)
  const view = live?.round === round ? live : null

  useEffect(() => {
    ask({ a: 'sync' })
  }, [ask])
  // Peticiones en los momentos justos: al empezar cada paso, al enseñarse cada cristal y al acabar de cruzar.
  useEffect(() => {
    if (!ready) return
    const sync = () => document.visibilityState === 'visible' && ask({ a: 'sync' })
    const at = [stepStart(round, 0) + 200]
    for (let k = 0; k < STEPS; k++) at.push(revealOf(round, k) + SHOW_WAIT_MS)
    at.push(crossEnd(round) + SHOW_WAIT_MS + 300, (round + 1) * ROUND_MS + 200)
    const timers = at.map((when) => when - clock()).filter((wait) => wait > 0).map((wait) => setTimeout(sync, wait))
    const poll = setInterval(() => phaseAt(clock()).phase === 'join' && sync(), JOIN_POLL_MS)
    return () => {
      timers.forEach(clearTimeout)
      clearInterval(poll)
    }
  }, [ready, round, ask, clock])

  const players = view?.players ?? []
  const me = players.find((p) => p.me) ?? null
  const joined = Boolean(view?.joined)
  const shown = view?.shown ?? 0
  const safe = view?.safe ?? []
  const myPick = view?.picks?.[step] ?? null
  const alive = me && !me.fell
  const canPick = ready && joined && alive && phase === 'cross' && picking && step >= shown
  const canJoin = ready && phase === 'join' && !joined && stake <= balance
  const result = view?.result ?? null
  const myLast = live?.last?.round === round ? live.last : null

  // Sonidos: cristal que se rompe (y si caíste tú) y el reparto final.
  useEffect(() => {
    if (!view) return
    const h = heard.current
    if (h.round !== round) heard.current = { round, shown: view.shown, paid: null }
    else if (view.shown > h.shown) {
      h.shown = view.shown
      if (joined && me?.fell && me.reached === view.shown - 1) {
        playSplash()
        buzz([60, 40, 200])
      } else playStamp()
    }
    if (result && heard.current.paid !== round) {
      heard.current.paid = round
      if (myLast?.won && myLast.net > 0) {
        playCash(5)
        playWin(true)
        setBurst({
          id: round,
          amount: myLast.net,
          caption: `Cruzaste ${myLast.reached} de ${STEPS} paneles`,
          tags: myLast.abuse > 0 ? [`Admin Abuse: +${eur(myLast.abuse)}`] : [],
        })
      } else if (myLast && myLast.net < 0) playLose()
    }
  }, [view, round, joined, me, result, myLast])

  async function join() {
    if (!canJoin || sending) return
    setSending(true)
    playChip()
    await ask({ a: 'join', stake })
    setSending(false)
  }
  async function choose(side) {
    if (!canPick || sending) return
    setSending(true)
    playChip()
    await ask({ a: 'pick', step, side })
    setSending(false)
  }

  const onKeys = useEffectEvent((event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.code === 'ArrowLeft' || event.code === 'ArrowUp') {
      event.preventDefault()
      choose('L')
    } else if (event.code === 'ArrowRight' || event.code === 'ArrowDown') {
      event.preventDefault()
      choose('R')
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKeys)
    return () => window.removeEventListener('keydown', onKeys)
  }, [])

  const pickLeft = phase === 'cross' && picking ? Math.ceil((revealOf(round, step) - t) / 1000) : 0
  const joinLeft = Math.ceil((JOIN_MS - offset) / 1000)
  let status = 'Conectando con el puente…'
  if (juegos.error) status = juegos.error
  else if (ready && phase === 'join')
    status = joined ? `Estás dentro con ${eur(me?.stake ?? 0)}. El puente se abre en ${joinLeft} s.` : `Paga la entrada y cruza con los demás. Se cierra en ${joinLeft} s.`
  else if (ready && phase === 'cross') {
    if (!joined) status = `Paso ${step + 1} de ${STEPS}. Mira quién cae… y entra en la siguiente partida.`
    else if (!alive) status = `Caíste en el paso ${(me?.reached ?? 0) + 1}. Mira hasta dónde llegan los demás.`
    else if (picking) status = myPick ? `Paso ${step + 1}: vas por la ${SIDE_NAMES[myPick].toLowerCase()}. Puedes cambiar durante ${pickLeft} s.` : `Paso ${step + 1}: ¿izquierda o derecha? Tienes ${pickLeft} s (si no, elige el puente).`
    else status = `Paso ${step + 1}: ¿aguanta el cristal…?`
  } else if (ready && phase === 'done') {
    if (!result) status = players.length ? 'Repartiendo el bote…' : 'Nadie cruzó esta vez. La siguiente partida empieza enseguida.'
    else if (result.refund) status = `Hacían falta al menos ${MIN_PLAYERS} jugadores: se devuelven las entradas.`
    else {
      const names = result.winners.map((w) => w.name).join(', ')
      status = `${names} ${result.winners.length > 1 ? 'llegan' : 'llega'} más lejos (${result.best} de ${STEPS}) y se ${result.winners.length > 1 ? 'reparten' : 'lleva'} ${eur(result.pot * (1 - CUT))}.`
    }
  }

  // Dónde está cada uno: de pie en el último cristal que aguantó (o en la salida o la meta), o en el roto si cayó.
  const onGlass = (k, side) =>
    players.filter((p) => p.picks[k] === side && ((p.fell && p.reached === k) || (!p.fell && p.reached === k + 1 && p.reached < STEPS)))
  const atStart = players.filter((p) => !p.fell && p.reached === 0)
  const atGoal = players.filter((p) => !p.fell && p.reached === STEPS)
  const pawns = (list) => (
    <span className="bridge__who">
      {list.slice(0, 4).map((p) => (
        <span key={p.name} className={`bridge__pawn ${p.fell ? 'is-fallen' : ''} ${p.me ? 'is-me' : ''}`} title={p.name}>
          <Avatar name={p.name} src={p.avatar} size={22} />
        </span>
      ))}
      {list.length > 4 && <small>+{list.length - 4}</small>}
    </span>
  )

  return (
    <main className="app s3-app bridge-app">
      <header className="top">
        <h1>El Puente de Cristal</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>Bote</dt>
              <dd>{eur(view?.pot ?? 0)}</dd>
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
                Cada {ROUND_MS / 1000} s hay una partida para todos. Durante {JOIN_MS / 1000} s pagas la entrada que quieras (de {eur(MIN_STAKE)} a{' '}
                {eur(MAX_STAKE)}). Luego todos cruzáis a la vez un puente de {STEPS} paneles.
              </p>
              <p>
                En cada paso tienes {PICK_MS / 1000} s para elegir <b>izquierda</b> o <b>derecha</b> (flechas del teclado o los botones). Un cristal
                aguanta y el otro se rompe: si eliges el roto, caes. Si no eliges a tiempo, el puente elige por ti. Lo que eligen los demás no se ve
                hasta que se rompe el cristal.
              </p>
              <p>
                Los que llegan más lejos se reparten el bote: todo lo que se ha pagado menos un {Math.round(CUT * 100)} % para la casa, cada uno en
                proporción a su entrada. Si todos caen en el mismo paso, se reparte entre todos. Con menos de {MIN_PLAYERS} jugadores se devuelven
                las entradas.
              </p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
            </Help>
          </div>
        </div>
      </header>

      <div className="s3 fill">
        <section className="s3__stage bridge" aria-label="El puente">
          <p className={`status ${myLast?.won && myLast.net > 0 ? 'status--win' : ''}`} aria-live="polite">
            {status}
          </p>
          <div className="bridge__deck" style={{ '--steps': STEPS }}>
            <div className="bridge__end bridge__end--start">
              Salida
              {pawns(atStart)}
            </div>
            {Array.from({ length: STEPS }, (_, k) => {
              const revealed = k < shown
              const current = phase === 'cross' && k === step && k >= shown
              return (
                <div key={k} className={`bridge__col ${current ? 'is-current' : ''}`}>
                  {['L', 'R'].map((side) => {
                    const broken = revealed && safe[k] !== side
                    const mine = joined && view?.picks?.[k] === side && !revealed
                    return (
                      <div key={side} className={`bridge__glass ${revealed ? (broken ? 'is-broken' : 'is-safe') : ''} ${mine ? 'is-mine' : ''}`}>
                        {pawns(onGlass(k, side))}
                      </div>
                    )
                  })}
                  <span className="bridge__num">{k + 1}</span>
                </div>
              )
            })}
            <div className="bridge__end bridge__end--goal">
              Meta
              {pawns(atGoal)}
            </div>
          </div>
          {phase === 'cross' && joined && alive && (
            <div className="bridge__choose">
              {['L', 'R'].map((side) => (
                <button key={side} type="button" className={`bridge__side ${myPick === side ? 'is-on' : ''}`} disabled={!canPick || sending} onClick={() => choose(side)}>
                  {side === 'L' ? '← ' : ''}
                  {SIDE_NAMES[side]}
                  {side === 'R' ? ' →' : ''}
                </button>
              ))}
              <span className="bridge__timer" style={{ '--left': picking ? Math.max(0, (revealOf(round, step) - t) / PICK_MS) : 0 }}>
                {picking ? pickLeft : '…'}
              </span>
            </div>
          )}
          <ul className="bridge__players" aria-label="Quién cruza">
            {players.map((p) => (
              <li key={p.name} className={`${p.fell ? 'is-fallen' : ''} ${p.me ? 'is-me' : ''}`}>
                <Avatar name={p.name} src={p.avatar} size={26} />
                <span>{p.name}</span>
                <small>
                  {eur(p.stake)} · {p.fell ? `cayó en el ${p.reached + 1}` : phase === 'join' ? 'listo' : `${p.reached}/${STEPS}`}
                  {p.ready ? ' · ✓' : ''}
                </small>
              </li>
            ))}
          </ul>
          {players.length === 0 && <p className="s3__hint">Nadie en el puente todavía.</p>}
        </section>

        <aside className="s3__panel">
          <div className="s3__group">
            <h2>{phase === 'join' ? 'Entrada' : 'Partida'}</h2>
            {phase === 'join' && !joined ? (
              <>
                <label className="s3__slider">
                  <span className="s3__amount">{eur(stake)}</span>
                  <input
                    type="range"
                    min={MIN_STAKE}
                    max={MAX_STAKE}
                    step={STAKE_STEP}
                    value={stake}
                    aria-label="Entrada"
                    onChange={(e) => setStake(Number(e.target.value))}
                  />
                </label>
                <p className="s3__hint">Cuanto más pagas, más parte del bote te llevas si ganas.</p>
              </>
            ) : (
              <p className="s3__big">
                {joined ? eur(me?.stake ?? 0) : 'Mirando'}
                <small>
                  {players.length} {players.length === 1 ? 'jugador' : 'jugadores'} · bote {eur(view?.pot ?? 0)}
                </small>
              </p>
            )}
          </div>
          <div className="actions s3__actions">
            <button type="button" className="primary" disabled={!canJoin || sending} onClick={join}>
              {phase !== 'join' ? 'Entra en la siguiente' : joined ? '¡Dentro!' : stake > balance ? 'No te llega el saldo' : sending ? 'Entrando…' : `Entrar por ${eur(stake)}`}
            </button>
          </div>
          {myLast && (
            <p className={`s3__hint ${myLast.net > 0 ? 'is-win' : ''}`}>
              {myLast.refund
                ? 'Te devolvieron la entrada.'
                : myLast.won
                  ? `Ganaste ${eur(myLast.payout)} (llegaste a ${myLast.reached}).`
                  : `Llegaste a ${myLast.reached} de ${STEPS}: perdiste ${eur(myLast.stake)}.`}
              {myLast.abuse > 0 && ` Admin Abuse: +${eur(myLast.abuse)}.`}
            </p>
          )}
          <div className="s3__group">
            <h2>Últimos puentes</h2>
            {(live?.history ?? []).length === 0 ? (
              <p className="s3__hint">Todavía no ha cruzado nadie esta semana.</p>
            ) : (
              <ul className="auction__history">
                {live.history.map((h) => (
                  <li key={h.round}>
                    <span>{h.refund ? '↩' : h.best === STEPS ? '🏁' : '🪟'}</span>
                    <span>
                      {h.refund ? (
                        'Sin rivales: entrada devuelta'
                      ) : (
                        <>
                          <b>{h.winners.map((w) => w.name).join(', ')}</b> · {h.best}/{STEPS}
                        </>
                      )}
                      <small>
                        {h.players} {h.players === 1 ? 'jugador' : 'jugadores'} · bote {eur(h.pot)}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {burst && <WinBurst key={burst.id} amount={burst.amount} caption={burst.caption} coins={60} big who={juegos.me?.name} tags={burst.tags} />}
    </main>
  )
}

export default Bridge
