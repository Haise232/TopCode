import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import { delta, eur, until } from './money.js'
import './Scoreboard.css'

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const SHORT = ['Inicio', 'L', 'M', 'X', 'J', 'V', 'S', 'D']
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 })
const REFRESH_MS = 10000

// Serie de la semana: el saldo inicial y cómo cerró cada día (null = día que aún no llegó).
const seriesOf = (player, starting) => [starting, ...player.days]

// Ticks redondos para el eje: 3 o 4 valores «bonitos» que cubren el rango.
function ticks(min, max) {
  const span = Math.max(max - min, 1000)
  const raw = span / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)
  const out = []
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(v)
  if (out.at(-1) < max) out.push(out.at(-1) + step)
  return out
}

function Sparkline({ values }) {
  const known = values.filter((v) => v !== null)
  const lo = Math.min(...known)
  const hi = Math.max(...known)
  const x = (i) => 2 + (i * 92) / (values.length - 1)
  const y = (v) => (hi === lo ? 14 : 26 - ((v - lo) / (hi - lo)) * 24)
  const points = values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean)
  const lastIndex = values.findLastIndex((v) => v !== null)
  return (
    <svg className="spark" viewBox="0 0 96 28" aria-hidden="true">
      <polyline points={points.join(' ')} />
      <circle cx={x(lastIndex)} cy={y(values[lastIndex])} r="2.5" />
    </svg>
  )
}

// Evolución de un jugador en la semana: una sola serie, con la línea de los 10.000 € de salida como referencia.
function WeekChart({ player, starting }) {
  const [hover, setHover] = useState(null)
  const values = seriesOf(player, starting)
  const known = values.filter((v) => v !== null)
  const scale = ticks(Math.min(...known, starting), Math.max(...known, starting))
  const lo = scale[0]
  const hi = scale.at(-1)
  const W = 560
  const H = 220
  const left = 56
  const right = 16
  const top = 14
  const bottom = 30
  const x = (i) => left + (i * (W - left - right)) / (values.length - 1)
  const y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom)
  const line = values
    .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
    .filter(Boolean)
    .join(' ')
  const lastIndex = values.findLastIndex((v) => v !== null)
  const shown = hover ?? lastIndex
  const value = values[shown]

  return (
    <figure className="week-chart">
      <figcaption className="week-chart__head">
        <span>
          {shown === 0 ? 'Saldo de salida' : DAYS[shown - 1]}
          {hover === null && shown > 0 ? ' (hoy)' : ''}
        </span>
        {value !== null && (
          <b>
            {eur(value)} <small className={value >= starting ? 'up' : 'down'}>{delta(value - starting)}</small>
          </b>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución de ${player.name} esta semana`}>
        {scale.map((t) => (
          <g key={t} className="week-chart__grid">
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} />
            <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {compact.format(t)}
            </text>
          </g>
        ))}
        <line className="week-chart__base" x1={left} x2={W - right} y1={y(starting)} y2={y(starting)} />
        {SHORT.map((label, i) => (
          <text key={label} className="week-chart__day" x={x(i)} y={H - 8} textAnchor="middle">
            {label}
          </text>
        ))}
        {hover !== null && values[hover] !== null && (
          <line className="week-chart__cross" x1={x(hover)} x2={x(hover)} y1={top} y2={H - bottom} />
        )}
        <polyline className="week-chart__line" points={line} />
        {values.map((v, i) =>
          v === null ? null : (
            <circle key={i} className={`week-chart__dot ${i === shown ? 'is-on' : ''}`} cx={x(i)} cy={y(v)} r={i === shown ? 6 : 4} />
          ),
        )}
        {/* Zonas de hover más anchas que los puntos. */}
        {values.map((v, i) => (
          <rect
            key={i}
            className="week-chart__hit"
            x={x(i) - (W - left - right) / 14}
            width={(W - left - right) / 7}
            y={0}
            height={H}
            onPointerEnter={() => v !== null && setHover(i)}
            onPointerLeave={() => setHover(null)}
          />
        ))}
      </svg>
    </figure>
  )
}

function Scoreboard({ juegos, onExit }) {
  const { scores, send, conn, me } = juegos
  const [selected, setSelected] = useState(null)
  const [, tick] = useState(0)

  // Se pide al entrar y se refresca mientras la pantalla está abierta.
  useEffect(() => {
    if (conn !== 'open' || !me) return
    send({ t: 'scores' })
    const timer = setInterval(() => {
      send({ t: 'scores' })
      tick((n) => n + 1)
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [conn, me, send])

  const players = scores?.players ?? []
  const starting = scores?.starting ?? 10000
  const mine = players.find((p) => p.me)
  const focus = players.find((p) => p.rank === selected) ?? mine ?? players[0]
  const last = scores?.lastWeek

  let status = 'Cargando la clasificación…'
  if (scores) {
    status = players.length
      ? `${players.length} ${players.length === 1 ? 'jugador' : 'jugadores'} esta semana. Todos empiezan con ${eur(starting)}.`
      : `Nadie ha jugado todavía esta semana. Todos empiezan con ${eur(starting)}.`
    if (!mine && players.length) status += ' Juega una mano en una mesa para entrar en el score.'
  }

  return (
    <main className="app score">
      <header className="top">
        <h1>Score</h1>
        <div className="hud">
          {scores && (
            <dl className="money">
              {mine && (
                <div>
                  <dt>Tu puesto</dt>
                  <dd>#{mine.rank}</dd>
                </div>
              )}
              <div>
                <dt>Reinicio</dt>
                <dd className="score__reset">{until(scores.week.resetAt)}</dd>
              </div>
            </dl>
          )}
          <div className="toggles">
            <button type="button" onClick={onExit}>
              Juegos
            </button>
          </div>
        </div>
      </header>

      <p className="status" aria-live="polite">
        {status}
      </p>

      <div className="score__grid fill">
        <section className="score__board" aria-label="Clasificación de la semana">
          <ol className="score__list">
            {players.map((p) => (
              <li key={p.rank}>
                <button
                  type="button"
                  className={`score__row ${p.me ? 'score__row--me' : ''} ${focus === p ? 'is-selected' : ''}`}
                  aria-pressed={focus === p}
                  onClick={() => setSelected(p.rank)}
                >
                  <span className={`score__rank score__rank--${p.rank}`}>{p.rank}</span>
                  <Avatar name={p.name} src={p.avatar} size={36} />
                  <span className="score__name">
                    {p.name}
                    {p.me && <small> · tú</small>}
                  </span>
                  <Sparkline values={seriesOf(p, starting)} />
                  <span className="score__money">
                    <b>{eur(p.balance)}</b>
                    <small className={p.balance >= starting ? 'up' : 'down'}>{delta(p.balance - starting)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <aside className="score__side">
          {focus && (
            <section className="score__card">
              <h2>
                <Avatar name={focus.name} src={focus.avatar} size={28} />
                {focus.me ? 'Tu semana' : `La semana de ${focus.name}`}
              </h2>
              <WeekChart player={focus} starting={starting} />
            </section>
          )}
          <section className="score__card">
            <h2>Semana pasada</h2>
            {last?.podium?.length ? (
              <ol className="podium">
                {last.podium.map((p, i) => (
                  <li key={i} className={`podium__step podium__step--${i + 1}`}>
                    <Avatar name={p.name} src={p.avatar} size={i === 0 ? 52 : 40} />
                    <span className="podium__name">{p.name}</span>
                    <b>{eur(p.balance)}</b>
                    <span className="podium__place">{i + 1}º</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="score__empty">Aún no hay podio: el primero se decide este domingo a las 23:59.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}

export default Scoreboard
