import { useCallback, useEffect, useRef, useState } from 'react'
import { BETS, EXPIRE_MS, KINDS, KIND_IDS, cardLabel, isRed } from './duel.js'
import { eur } from './money.js'
import { supabase } from '../lib/supabase'
import { isMuted, playCard, playChip, playLose, playSpin, playWin, setMuted } from './sound.js'
import Avatar from './Avatar.jsx'
import Help from './Help.jsx'
import './Duel.css'

const TOPIC = 'juegos-duelos'
const POLL_MS = 20000
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
const left = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`
}

// Icono de cada tipo de duelo (dibujado: los emojis no se ven igual en todos los móviles).
function KindIcon({ kind, size = 34 }) {
  if (kind === 'moneda') {
    return (
      <svg className="duel-icon" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" fill="#f2c14e" stroke="#b97c0e" strokeWidth="3" />
        <circle cx="20" cy="20" r="11" fill="none" stroke="#b97c0e" strokeWidth="2" strokeDasharray="3 3" />
        <text x="20" y="25" textAnchor="middle" fontSize="14" fontWeight="900" fill="#5a3d06">€</text>
      </svg>
    )
  }
  if (kind === 'dados') {
    return (
      <svg className="duel-icon" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <rect x="4" y="4" width="32" height="32" rx="7" fill="#fff" stroke="#c9ced6" strokeWidth="2" />
        {[
          [12, 12],
          [28, 12],
          [20, 20],
          [12, 28],
          [28, 28],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="3.2" fill="#1b1405" />
        ))}
      </svg>
    )
  }
  return (
    <svg className="duel-icon" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="8" y="3" width="24" height="34" rx="4" fill="#fff" stroke="#c9ced6" strokeWidth="2" />
      <text x="20" y="25" textAnchor="middle" fontSize="16" fontWeight="900" fill="#c8102e">A♥</text>
    </svg>
  )
}

function Die({ value, rolling }) {
  return (
    <span className={`duel-die ${rolling ? 'is-rolling' : ''}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIPS[value].includes(i) ? 'on' : ''} />
      ))}
    </span>
  )
}

function Card({ card, flip }) {
  return (
    <span className={`duel-card ${flip ? 'is-up' : ''}`}>
      <span className="duel-card__back" />
      <span className={`duel-card__face ${isRed(card) ? 'is-red' : ''}`}>{cardLabel(card)}</span>
    </span>
  )
}

// La animación de un duelo jugado, en pantalla completa: los dos, el sorteo (moneda, dados o cartas) y quién gana.
function Showdown({ duel, me, onClose, onRematch }) {
  const [step, setStep] = useState(0) // 0: sorteo en marcha · 1, 2…: rondas de desempate · final: resultado
  const rounds = duel.detalle?.rounds ?? []
  const total = duel.tipo === 'moneda' ? 1 : rounds.length
  const done = step >= total
  useEffect(() => {
    const muted = isMuted()
    if (!muted) playSpin(1100)
    const timers = []
    for (let i = 1; i <= total; i++) {
      timers.push(
        setTimeout(() => {
          setStep(i)
          if (!muted) playCard()
        }, 1300 + (i - 1) * 1200),
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [total])
  const iWon = done && ((duel.ganador === 'reta' && duel.reta.id === me) || (duel.ganador === 'acepta' && duel.acepta?.id === me))
  const iLost = done && !iWon && (duel.reta.id === me || duel.acepta?.id === me)
  useEffect(() => {
    if (!done || isMuted()) return
    if (iWon) playWin(duel.apuesta >= 2500)
    else if (iLost) playLose()
  }, [done, iWon, iLost, duel.apuesta])
  const winner = duel.ganador === 'reta' ? duel.reta : duel.acepta
  const shown = Math.max(0, Math.min(step, total) - 1)
  const r = rounds[shown]
  return (
    <div className="duel-show" role="dialog" aria-modal="true" aria-label={`Duelo: ${duel.reta.name} contra ${duel.acepta?.name}`}>
      <div className="duel-show__vs">
        <div className={`duel-show__side ${done && duel.ganador === 'reta' ? 'is-win' : done ? 'is-lose' : ''}`}>
          <Avatar name={duel.reta.name} src={duel.reta.avatar} size={84} />
          <b>{duel.reta.name}</b>
          {duel.tipo === 'moneda' && <small>Cara</small>}
          {duel.tipo === 'dados' && <span className="duel-show__dice">{(r ?? { a: [1, 1] }).a.map((v, i) => <Die key={i} value={v} rolling={step === 0} />)}</span>}
          {duel.tipo === 'carta' && r && <Card card={r.a} flip={step > 0} />}
          {duel.tipo === 'dados' && r && step > 0 && <em>{r.a[0] + r.a[1]}</em>}
        </div>
        <div className="duel-show__mid">
          <span className="duel-show__bolt">VS</span>
          {duel.tipo === 'moneda' && (
            <span className={`duel-coin ${done ? `is-${duel.detalle.side}` : 'is-flipping'}`}>
              <span className="duel-coin__cara">CARA</span>
              <span className="duel-coin__cruz">CRUZ</span>
            </span>
          )}
          <span className="duel-show__pot">{eur(duel.apuesta * 2)}</span>
          {total > 1 && step > 0 && step < total && <small className="duel-show__tie">¡Empate! Otra vez…</small>}
        </div>
        <div className={`duel-show__side ${done && duel.ganador === 'acepta' ? 'is-win' : done ? 'is-lose' : ''}`}>
          <Avatar name={duel.acepta?.name ?? '?'} src={duel.acepta?.avatar} size={84} />
          <b>{duel.acepta?.name}</b>
          {duel.tipo === 'moneda' && <small>Cruz</small>}
          {duel.tipo === 'dados' && <span className="duel-show__dice">{(r ?? { b: [1, 1] }).b.map((v, i) => <Die key={i} value={v} rolling={step === 0} />)}</span>}
          {duel.tipo === 'carta' && r && <Card card={r.b} flip={step > 0} />}
          {duel.tipo === 'dados' && r && step > 0 && <em>{r.b[0] + r.b[1]}</em>}
        </div>
      </div>
      {done && (
        <div className="duel-show__result">
          <p className={iWon ? 'is-win' : iLost ? 'is-lose' : ''}>
            {iWon ? '¡Has ganado!' : iLost ? 'Has perdido' : `Gana ${winner?.name}`}
          </p>
          <span>
            {winner?.name} se lleva {eur(duel.apuesta)}
            {duel.extra ? ` (+${eur(duel.extra)} de la banca)` : ''}
          </span>
          <div className="duel-show__btns">
            {(iWon || iLost) && onRematch && (
              <button
                type="button"
                className="duel-rematch"
                onClick={() => onRematch({ para: duel.reta.id === me ? duel.acepta?.id : duel.reta.id, apuesta: duel.apuesta, tipo: duel.tipo })}
              >
                ⚔ Revancha · {eur(duel.apuesta)}
              </button>
            )}
            <button type="button" className="hub-btn hub-btn--primary" onClick={onClose} autoFocus>
              Seguir
            </button>
          </div>
        </div>
      )}
      {iWon && (
        <span className="duel-show__confetti" aria-hidden="true">
          {Array.from({ length: 36 }, (_, i) => (
            <i key={i} style={{ '--x': `${(i * 37) % 100}vw`, '--t': `${((i * 0.19) % 1.6).toFixed(2)}s`, '--c': ['#ffe08a', '#ff6b7d', '#6dffb4', '#7fb8ff'][i % 4] }} />
          ))}
        </span>
      )}
    </div>
  )
}

// Duelos 1 contra 1: retar (a alguien o a quien quiera), aceptar retos y ver los últimos duelos. Al jugarse uno tuyo, sale la
// animación (también a quien retó, por el aviso de Realtime).
export default function Duel({ onExit, juegos }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [bet, setBet] = useState(500)
  const [kind, setKind] = useState('moneda')
  const [rival, setRival] = useState(null) // null = abierto a todos
  const [show, setShow] = useState(null)
  const [error, setError] = useState('')
  const [sound, setSound] = useState(() => !isMuted())
  const [, setTick] = useState(0)
  const seen = useRef(null) // ids de duelos jugados ya conocidos (los nuevos y tuyos se animan)
  const me = juegos.me?.id
  const { request } = juegos

  const apply = useCallback(
    (body) => {
      const d = body?.duel
      if (!d) return
      setData(d)
      setError(body.error?.message ?? '')
      const ids = new Set(d.recientes.map((x) => x.id))
      if (seen.current) {
        const fresh = d.recientes.find((x) => !seen.current.has(x.id) && x.mio)
        if (fresh) setShow(fresh)
      }
      seen.current = ids
    },
    [],
  )
  const call = useCallback(
    async (msg) => {
      setBusy(true)
      const body = await request({ t: 'duel', ...msg })
      setBusy(false)
      apply(body)
      return body
    },
    [request, apply],
  )

  useEffect(() => {
    call({ a: 'lista' })
    const channel = supabase
      .channel(TOPIC)
      .on('broadcast', { event: 'cambio' }, () => request({ t: 'duel', a: 'lista' }).then(apply))
      .subscribe()
    const poll = setInterval(() => document.visibilityState === 'visible' && request({ t: 'duel', a: 'lista' }).then(apply), POLL_MS)
    const tick = setInterval(() => setTick((n) => n + 1), 1000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [call, request, apply])

  const balance = juegos.me?.balance ?? 0
  const open = data?.abiertos ?? []
  const mine = open.filter((d) => d.reta.id === me)
  const forMe = open.filter((d) => d.reta.id !== me)
  const skew = data ? data.now - Date.now() : 0

  return (
    <main className="app hub duel-app">
      <header className="duel-top">
        <button type="button" className="hub-btn hub-btn--ghost" onClick={onExit}>
          ← Juegos
        </button>
        <h1>Duelos</h1>
        <div className="duel-top__right">
          <span className="duel-top__bank">{eur(balance)}</span>
          <button
            type="button"
            className="hub-btn hub-btn--ghost"
            aria-pressed={sound}
            onClick={() => {
              setMuted(sound)
              setSound(!sound)
            }}
          >
            Sonido
          </button>
          <Help title="Cómo funcionan los duelos" className="hub-btn hub-btn--ghost">
            <p>Retas a alguien (o a quien quiera) y pones la apuesta. Quien acepta pone lo mismo y el servidor lo sortea al momento: el ganador se lleva lo del otro.</p>
            <p>Es 50 % contra 50 %: la banca no se queda nada. Si nadie acepta en {EXPIRE_MS / 60000} minutos, se cancela y te devuelven el dinero.</p>
            <p>Cara o cruz: quien reta es cara. Dados y carta alta: si empatáis, se repite.</p>
          </Help>
        </div>
      </header>

      {error && <p className="duel-error">{error}</p>}

      {data?.yo && (
        <section className="duel-stats" aria-label="Tus duelos de esta semana">
          <div>
            <small>Ganados</small>
            <b className="is-win">{data.yo.ganados}</b>
          </div>
          <div>
            <small>Perdidos</small>
            <b className="is-lose">{data.yo.perdidos}</b>
          </div>
          <div>
            <small>% de victorias</small>
            <b>{data.yo.ganados + data.yo.perdidos ? Math.round((100 * data.yo.ganados) / (data.yo.ganados + data.yo.perdidos)) : 0} %</b>
          </div>
          <div>
            <small>Balance en duelos</small>
            <b className={data.yo.neto > 0 ? 'is-win' : data.yo.neto < 0 ? 'is-lose' : ''}>
              {data.yo.neto > 0 ? '+' : data.yo.neto < 0 ? '−' : ''}
              {eur(Math.abs(data.yo.neto))}
            </b>
          </div>
        </section>
      )}

      <div className="duel-grid">
        <section className="duel-new" aria-labelledby="duel-new-title">
          <h2 id="duel-new-title" className="hub-title">
            Lanzar un reto
          </h2>
          <div className="duel-kinds" role="radiogroup" aria-label="Tipo de duelo">
            {KIND_IDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className="duel-kind" onClick={() => setKind(k)}>
                <KindIcon kind={k} />
                <b>{KINDS[k].name}</b>
                <small>{KINDS[k].text}</small>
              </button>
            ))}
          </div>
          <div className="duel-bets" role="radiogroup" aria-label="Apuesta">
            {BETS.map((b) => (
              <button key={b} type="button" role="radio" aria-checked={bet === b} disabled={b > balance} onClick={() => setBet(b)}>
                {eur(b)}
              </button>
            ))}
          </div>
          <label className="duel-rival">
            <span>Contra</span>
            <select value={rival ?? ''} onChange={(e) => setRival(e.target.value || null)}>
              <option value="">Cualquiera (reto abierto)</option>
              {(data?.gente ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="duel-go"
            disabled={busy || bet > balance}
            onClick={() => {
              playChip()
              call({ a: 'retar', para: rival, apuesta: bet, tipo: kind })
            }}
          >
            ⚔ Retar por {eur(bet)}
          </button>
          {mine.length > 0 && (
            <ul className="duel-list duel-list--mine">
              {mine.map((d) => (
                <li key={d.id}>
                  <span className="duel-list__icon">
                    <KindIcon kind={d.tipo} size={30} />
                  </span>
                  <span className="duel-list__who">
                    <b>{d.para ? `Para ${d.para.name}` : 'Reto abierto'}</b>
                    <small>
                      {eur(d.apuesta)} · caduca en {left(d.creado + EXPIRE_MS - (Date.now() + skew))}
                    </small>
                  </span>
                  <button type="button" className="hub-btn" disabled={busy} onClick={() => call({ a: 'cancelar', id: d.id })}>
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="duel-open" aria-labelledby="duel-open-title">
          <h2 id="duel-open-title" className="hub-title">
            Retos para ti <small>{forMe.length ? `${forMe.length} esperando` : 'ninguno ahora'}</small>
          </h2>
          {forMe.length === 0 ? (
            <p className="duel-empty">{data ? 'Nadie te ha retado. ¡Lanza tú uno!' : 'Cargando…'}</p>
          ) : (
            <ul className="duel-list">
              {forMe.map((d) => (
                <li key={d.id} className={d.para ? 'is-direct' : ''}>
                  <Avatar name={d.reta.name} src={d.reta.avatar} size={44} />
                  <span className="duel-list__who">
                    <b>
                      {d.reta.name} {d.para ? 'te reta' : 'reta a cualquiera'}
                    </b>
                    <small>
                      {KINDS[d.tipo].name} · {eur(d.apuesta)}
                    </small>
                  </span>
                  <button type="button" className="duel-accept" disabled={busy || d.apuesta > balance} onClick={() => call({ a: 'aceptar', id: d.id })}>
                    Aceptar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h2 className="hub-title duel-recent-title">Últimos duelos</h2>
          {(data?.recientes ?? []).length === 0 ? (
            <p className="duel-empty">Todavía no se ha jugado ninguno.</p>
          ) : (
            <ul className="duel-recent">
              {data.recientes.map((d) => {
                const win = d.ganador === 'reta' ? d.reta : d.acepta
                const lose = d.ganador === 'reta' ? d.acepta : d.reta
                return (
                  <li key={d.id}>
                    <button type="button" onClick={() => setShow(d)}>
                      <KindIcon kind={d.tipo} size={20} />
                      <b>{win?.name}</b> le gana {eur(d.apuesta)} a <b>{lose?.name}</b>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {show && (
        <Showdown
          key={show.id}
          duel={show}
          me={me}
          onClose={() => setShow(null)}
          onRematch={(msg) => {
            setShow(null)
            playChip()
            call({ a: 'retar', ...msg })
          }}
        />
      )}
    </main>
  )
}
