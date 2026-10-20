import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
// Fuentes de juegos, servidas por la propia app.
import '@fontsource/abril-fatface/latin.css'
import '@fontsource-variable/instrument-sans/index.css'
// Primero los estilos base y después los de cada juego, para que las reglas de un juego (por ejemplo, las de pantallas
// estrechas) puedan cambiar las comunes. Al revés, App.css las pisaba y algunas pantallas no se adaptaban al móvil.
import './reset.css'
import './index.css'
import './App.css'
import Roulette from './Roulette.jsx'
import Crash from './Crash.jsx'
import Slots from './Slots.jsx'
import Plinko from './Plinko.jsx'
import Gacha from './Gacha.jsx'
import GachaShowcase from './GachaShowcase.jsx'
import SlotSymbol from './SlotSymbol.jsx'
import Table from './table/Table.jsx'
import PokerTable from './poker/PokerTable.jsx'
import { useJuegos } from './useJuegos.js'
import Scoreboard from './Scoreboard.jsx'
import Avatar from './Avatar.jsx'
import { delta, eur, until } from './money.js'
import './Lobby.css'
import './table/table.css'
import './responsive.css'
import './hub.css'

const LIVE = {
  blackjack: { name: 'Blackjack' },
  poker: { name: 'Póker' },
}

const SOLO = [
  {
    id: 'roulette',
    name: 'Ruleta',
    blurb: 'Una tirada cada 25 s para todos.',
    live: true,
    art: <span className="game__wheel" />,
  },
  {
    id: 'crash',
    name: 'Cohete',
    blurb: 'Sube para todos cada 30 s. Retira a tiempo.',
    live: true,
    art: <span className="game__rocket" />,
  },
  {
    id: 'slots',
    name: 'Tragamonedas',
    blurb: 'Cinco rodillos y diez líneas.',
    art: (
      <span className="game__reels">
        <SlotSymbol name="seven" />
        <SlotSymbol name="seven" />
        <SlotSymbol name="seven" />
      </span>
    ),
  },
  {
    id: 'plinko',
    name: 'Plinko',
    blurb: 'Suelta bolas y que caigan en las orillas.',
    art: (
      <svg className="game__plinko" viewBox="0 0 40 40">
        {[
          [20, 9],
          [14, 17],
          [26, 17],
          [8, 25],
          [20, 25],
          [32, 25],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" className="game__plinko-peg" />
        ))}
        <circle cx="17" cy="4" r="3.6" className="game__plinko-ball" />
        <rect x="3" y="31" width="9" height="6" rx="1.5" className="game__plinko-hot" />
        <rect x="15.5" y="31" width="9" height="6" rx="1.5" className="game__plinko-cold" />
        <rect x="28" y="31" width="9" height="6" rx="1.5" className="game__plinko-hot" />
      </svg>
    ),
  },
]

const SCORES_MS = 30000
// Asientos de las mesas públicas (igual que en el servidor) para dibujar la mesa antes de que llegue el lobby.
const SEATS = { blackjack: 7, poker: 6 }
const CAPTION = { blackjack: 'Contra el crupier', poker: 'Ciegas de 50 y 100 €' }

// Posición de cada asiento en la mini mesa, en % del recuadro. Póker: óvalo completo. Blackjack: arco bajo el crupier.
function seatSpot(i, n, game) {
  const [from, span] = game === 'blackjack' ? [162, -144] : [90, 360]
  const deg = game === 'blackjack' ? from + (span * i) / (n - 1) : from + (span * i) / n
  const rad = (deg * Math.PI) / 180
  const cy = game === 'blackjack' ? 34 : 50
  const ry = game === 'blackjack' ? 54 : 46
  return { left: `${50 + 45 * Math.cos(rad)}%`, top: `${cy + ry * Math.sin(rad)}%` }
}

// Texto y tono del estado de una mesa.
function tableState(game, t) {
  if (!t || t.players === 0) return { tone: 'free', text: 'Mesa libre' }
  if (game === 'poker' && t.phase === 'waiting') {
    return t.players === 1 ? { tone: 'wait', text: `Espera rival ${t.players}/${t.seats}` } : { tone: 'on', text: `${t.players} jugando` }
  }
  if (t.phase !== 'waiting' && t.phase !== 'betting') return { tone: 'hand', text: 'Mano en curso' }
  return { tone: 'on', text: `${t.players} jugando` }
}

// La mesa que se dibuja: la elegida, o la que tiene gente y sitio (así quien llega se sienta con alguien).
function bestTable(tables, picked) {
  const chosen = tables.find((t) => t.code === picked)
  if (chosen) return chosen
  const open = tables.filter((t) => t.players < t.seats)
  return [...open].sort((a, b) => b.players - a.players)[0] ?? tables[0]
}

// Fotos de quien está en las mesas (las de TopCode; si no hay, iniciales), solapadas.
function Faces({ people }) {
  if (people.length === 0) return null
  const shown = people.slice(0, 5)
  return (
    <span className="hub-faces" role="img" aria-label={`En las mesas: ${people.map((p) => p.name).join(', ')}`}>
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} title={p.name}>
          <Avatar name={p.name} src={p.avatar} size={30} />
        </span>
      ))}
      {people.length > shown.length && <i>+{people.length - shown.length}</i>}
    </span>
  )
}

// Delta de hoy y distancia al siguiente puesto, solo con los datos del Score.
function standing(scores, me) {
  const list = scores?.players ?? []
  const mine = list.find((p) => p.me)
  if (!mine) return { mine: null, count: list.length, today: null, gap: null }
  const day = scores.week?.day ?? 0
  const known = mine.days.slice(0, day + 1).filter((v) => v !== null)
  const base = day > 0 ? (mine.days[day - 1] ?? scores.starting) : scores.starting
  const today = known.length ? mine.balance - base : 0
  const ahead = list[mine.rank - 2]
  const behind = list[mine.rank]
  let gap = null
  if (ahead) gap = { text: `A ${eur(ahead.balance - mine.balance)} del puesto ${ahead.rank}`, up: true }
  else if (behind) gap = { text: `Vas primero, ${eur(mine.balance - behind.balance)} por delante`, up: false }
  return { mine, count: list.length, today, gap }
}

// Acceso al score: una placa de latón con tu puesto, tu saldo, lo de hoy y lo que falta para subir.
function ScoreCard({ scores, me, resetAt, online, onOpen }) {
  const { mine, count, today, gap } = standing(scores, me)
  const top = scores?.players.slice(0, 3) ?? []
  const stale = !online && Boolean(scores)
  const usable = Boolean(scores) || online
  return (
    <button type="button" className={`hub-plaque ${stale ? 'hub-plaque--stale' : ''}`} disabled={!usable} onClick={onOpen}>
      <span className="hub-plaque__rank" aria-hidden={!mine}>
        {mine ? (
          <>
            <b>{mine.rank}</b>
            <small>de {count}</small>
          </>
        ) : scores ? (
          <b>–</b>
        ) : (
          <i className="hub-skel hub-skel--rank" />
        )}
      </span>
      <span className="hub-plaque__body">
        {mine ? (
          <>
            <span className="hub-plaque__line">
              <span className="hub-plaque__label">Puesto {mine.rank} · tu saldo</span>
              <span className="hub-plaque__money">{eur(mine.balance)}</span>
            </span>
            <span className="hub-plaque__facts">
              <span className={`hub-plaque__delta ${today > 0 ? 'is-up' : today < 0 ? 'is-down' : ''}`}>{delta(today)} hoy</span>
              {gap && <span>{gap.text}</span>}
            </span>
          </>
        ) : scores ? (
          <span className="hub-plaque__line">
            <span className="hub-plaque__label">Clasificación semanal</span>
            <span className="hub-plaque__hint">Juega una mano o una tirada para entrar.</span>
          </span>
        ) : (
          <>
            <i className="hub-skel hub-skel--line" />
            <i className="hub-skel hub-skel--short" />
          </>
        )}
        <span className="hub-plaque__foot">
          {top.length > 0 && (
            <span className="hub-plaque__top" aria-label={`Líderes: ${top.map((p) => p.name).join(', ')}`}>
              {top.map((p) => (
                <span key={p.rank} title={`${p.rank}. ${p.name}`}>
                  <Avatar name={p.name} src={p.avatar} size={24} />
                </span>
              ))}
            </span>
          )}
          <span className="hub-plaque__meta">
            {stale ? 'Último dato guardado' : resetAt ? `Reinicio en ${until(resetAt)}` : 'Ver clasificación'}
          </span>
          <span className="hub-plaque__go" aria-hidden="true">
            Ver →
          </span>
        </span>
      </span>
    </button>
  )
}

// Mini mesa: el tapete con un punto por asiento (cara = ocupado, anillo = libre, atenuado = ausente).
function MiniTable({ game, table, name }) {
  const n = table?.seats ?? SEATS[game]
  const present = table?.people ?? []
  const away = table?.away ?? 0
  const seats = Array.from({ length: n }, (_, i) => {
    if (i < present.length) return { kind: 'on', person: present[i] }
    if (i < present.length + away) return { kind: 'away' }
    return { kind: 'free' }
  })
  const free = seats.filter((s) => s.kind === 'free').length
  const label = `${name}: ${present.length} de ${n} asientos ocupados${present.length ? ` (${present.map((p) => p.name).join(', ')})` : ''}${away ? `, ${away} ausente${away > 1 ? 's' : ''}` : ''}, ${free} libre${free === 1 ? '' : 's'}`
  return (
    <div className={`hub-table hub-table--${game}`} role="img" aria-label={label}>
      <span className="hub-table__felt" aria-hidden="true">
        {game === 'blackjack' && <em className="hub-table__dealer">Crupier</em>}
        <span className="hub-table__caption">{CAPTION[game]}</span>
      </span>
      {seats.map((seat, i) => (
        <span key={i} className={`hub-seat hub-seat--${seat.kind}`} style={seatSpot(i, n, game)} title={seat.person?.name}>
          {seat.kind === 'on' && <Avatar name={seat.person.name} src={seat.person.avatar} size={36} />}
        </span>
      ))}
    </div>
  )
}

function LiveSkeleton({ name }) {
  return (
    <article className="hub-live hub-live--skel" aria-busy="true" aria-label={`${name}: cargando`}>
      <div className="hub-live__head">
        <h3>{name}</h3>
        <i className="hub-skel hub-skel--chip" />
      </div>
      <div className="hub-skel hub-skel--table" />
      <div className="hub-skel hub-skel--line" />
      <div className="hub-skel hub-skel--btn" />
    </article>
  )
}

// Tarjeta de un juego en vivo: la mesa en miniatura, su estado y un botón para sentarse (o mirar), sin códigos.
function LiveGame({ game, tables, loaded, online, onJoin }) {
  const { name } = LIVE[game]
  const [picked, setPicked] = useState(null)
  if (!loaded) return <LiveSkeleton name={name} />
  const featured = bestTable(tables, picked)
  const state = tableState(game, featured)
  const players = tables.reduce((sum, t) => sum + t.players, 0)
  const watching = tables.reduce((sum, t) => sum + t.spectators, 0)
  const people = tables.flatMap((t) => t.people)
  const full = featured ? featured.players >= featured.seats : false
  const code = picked && featured?.code === picked ? picked : undefined
  const meta = [players ? `${players} jugando` : 'Nadie jugando', watching ? `${watching} mirando` : null].filter(Boolean).join(' · ')
  return (
    <article className={`hub-live ${players > 0 ? 'is-busy' : ''} ${online ? '' : 'is-stale'}`}>
      <div className="hub-live__head">
        <h3>{name}</h3>
        <span className={`hub-chip hub-chip--${online ? state.tone : 'free'}`}>
          <i aria-hidden="true" />
          {online ? state.text : 'Sin conexión'}
        </span>
      </div>
      <MiniTable game={game} table={featured} name={name} />
      <div className="hub-live__meta">
        <span>{meta}</span>
        {tables.length > 1 && <Faces people={people} />}
      </div>
      {tables.length > 1 && (
        <div className="hub-segs" role="group" aria-label={`Mesas de ${name}`}>
          {tables.map((t) => (
            <button key={t.code} type="button" className="hub-seg" aria-pressed={featured?.code === t.code} onClick={() => setPicked(t.code)}>
              <span>{t.label}</span>
              <small>
                {t.players}/{t.seats}
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="hub-live__actions">
        <button type="button" className="hub-btn hub-btn--primary" disabled={!online || full} onClick={() => onJoin(game, 'player', code)}>
          {full ? 'Mesa llena' : 'Jugar'}
        </button>
        <button type="button" className="hub-btn" disabled={!online} onClick={() => onJoin(game, 'spectator', code)}>
          Mirar
        </button>
      </div>
    </article>
  )
}

function GameSelector({ juegos, onPick, onJoin, onScore, onGacha, onHome }) {
  const { me, lobby, conn, scores, send } = juegos
  const connected = conn === 'open' && Boolean(me)
  const online = connected && Boolean(lobby)

  // El resumen del score se refresca mientras se está en el selector.
  useEffect(() => {
    if (conn !== 'open' || !me) return
    send({ t: 'scores' })
    const timer = setInterval(() => send({ t: 'scores' }), SCORES_MS)
    return () => clearInterval(timer)
  }, [conn, me, send])
  const tablesOf = (game) => lobby?.tables.filter((t) => t.game === game) ?? []

  let status = { tone: 'off', text: 'Sin conexión · reintentando' }
  if (juegos.error) status = { tone: 'err', text: juegos.error }
  else if (online) status = { tone: 'on', text: `${lobby.online} ${lobby.online === 1 ? 'conectado' : 'conectados'}` }
  else if (conn === 'connecting' || (connected && !lobby)) status = { tone: 'wait', text: 'Conectando…' }

  return (
    <main className="app app--lobby hub">
      <header className="hub-top">
        <h1>Juegos</h1>
        <p className={`hub-status hub-status--${status.tone}`} role="status" aria-live="polite">
          <i aria-hidden="true" />
          {status.text}
        </p>
        <div className="hub-top__who">
          {me && (
            <div className="hub-me">
              <Avatar name={me.name} src={me.avatar} size={44} />
              <span className="hub-me__text">
                <small>{me.name}</small>
                <b>{eur(me.balance)}</b>
              </span>
            </div>
          )}
          <button type="button" className="hub-btn hub-btn--ghost" onClick={onHome}>
            TopCode
          </button>
        </div>
      </header>

      <div className="hub-grid">
        <section className="hub-live-sec" aria-labelledby="live-title">
          <h2 id="live-title" className="hub-title">
            Mesas en vivo <small>con la gente de TopCode</small>
          </h2>
          <div className="hub-cards">
            {Object.keys(LIVE).map((game) => (
              <LiveGame key={game} game={game} tables={tablesOf(game)} loaded={Boolean(lobby)} online={online} onJoin={onJoin} />
            ))}
          </div>
          <GachaShowcase juegos={juegos} online={connected} onOpen={onGacha} />
        </section>

        <div className="hub-side">
          <section aria-labelledby="score-title">
            <h2 id="score-title" className="hub-title">
              Clasificación <small>se reinicia el domingo a las 23:59</small>
            </h2>
            <ScoreCard scores={scores} me={me} resetAt={lobby?.resetAt} online={online} onOpen={onScore} />
          </section>

          <section aria-labelledby="solo-title">
            <h2 id="solo-title" className="hub-title">
              Para jugar solo <small>con tu saldo de la semana</small>
            </h2>
            <ul className="hub-solo">
              {SOLO.map(({ id, name, blurb, art, live }) => (
                <li key={id}>
                  <button type="button" className="hub-row" disabled={!connected} onClick={() => onPick(id)}>
                    <span className="hub-row__art" aria-hidden="true">
                      {art}
                    </span>
                    <span className="hub-row__text">
                      <span className="hub-row__name">
                        {name}
                        {live && <em className="hub-pill">En vivo</em>}
                      </span>
                      <span className="hub-row__blurb">{blurb}</span>
                    </span>
                    <span className="hub-row__go" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}

// Entra a una mesa pública en cuanto hay conexión; mientras tanto, una pantalla de espera.
function Joining({ juegos, request, onExit }) {
  const { conn, me, error, send } = juegos
  const sentFor = useRef(null)
  const [failed, setFailed] = useState('')

  useEffect(() => {
    if (conn !== 'open' || !me || sentFor.current === me.id) return
    if (send({ t: 'join_public', game: request.game, as: request.as, code: request.code })) sentFor.current = me.id
  }, [conn, me, request, send])

  useEffect(() => {
    if (error && sentFor.current) setFailed(error)
  }, [error])

  return (
    <main className="app">
      <header className="top">
        <h1>{LIVE[request.game].name}</h1>
        <div className="toggles">
          <button type="button" onClick={onExit}>
            Volver
          </button>
        </div>
      </header>
      <p className="status" aria-live="polite">
        {failed || (conn === 'open' ? 'Buscando sitio en la mesa…' : 'Conectando con las mesas…')}
      </p>
      {failed && (
        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={() => {
              setFailed('')
              send({ t: 'join_public', game: request.game, as: 'spectator' })
            }}
          >
            Entrar a mirar
          </button>
        </div>
      )}
    </main>
  )
}

function Notice({ title, children, actions }) {
  return (
    <main className="app">
      <header className="top">
        <h1>{title}</h1>
      </header>
      <div className="lobby-card notice">
        {children}
        <div className="actions">{actions}</div>
      </div>
    </main>
  )
}

function JuegosScreens() {
  const navigate = useNavigate()
  // screen: lobby | roulette | crash | slots | plinko | gacha | join | score
  const [params, setParams] = useSearchParams()
  // Enlace de invitación (/juegos?juego=poker&mesa=ABCD): entra directamente a esa mesa, o a la mejor si ya no existe.
  const [view, setView] = useState(() => {
    const game = params.get('juego')
    if (!Object.hasOwn(LIVE, game)) return { screen: 'lobby' }
    return { screen: 'join', game, as: 'player', code: params.get('mesa') ?? undefined }
  })
  const juegos = useJuegos()
  useEffect(() => {
    if (params.has('juego') || params.has('mesa')) setParams({}, { replace: true })
  }, [params, setParams])
  const exit = () => setView({ screen: 'lobby' })
  const home = () => navigate('/')

  if (juegos.conn === 'denied') {
    return (
      <Notice
        title="Juegos"
        actions={
          <>
            <button type="button" className="primary" onClick={juegos.reconnect}>
              Reintentar
            </button>
            <button type="button" onClick={home}>
              Volver a TopCode
            </button>
          </>
        }
      >
        <p>{juegos.denied}</p>
      </Notice>
    )
  }

  // Dentro de una mesa manda el servidor (también al volver tras recargar la página).
  if (juegos.room) {
    const Kind = juegos.room.state.game === 'poker' ? PokerTable : Table
    return (
      <Kind
        room={juegos.room}
        me={juegos.me}
        conn={juegos.conn}
        error={juegos.error}
        send={juegos.send}
        onLeave={() => {
          juegos.leave()
          exit()
        }}
        chat={juegos.chat}
        bubbles={juegos.bubbles}
        pending={juegos.pending}
      />
    )
  }

  const { screen } = view
  if (screen === 'roulette') return <Roulette onExit={exit} juegos={juegos} />
  if (screen === 'crash') return <Crash onExit={exit} juegos={juegos} />
  if (screen === 'slots') return <Slots onExit={exit} juegos={juegos} />
  if (screen === 'plinko') return <Plinko onExit={exit} juegos={juegos} />
  if (screen === 'gacha') return <Gacha onExit={exit} juegos={juegos} initialTab={view.tab} />
  if (screen === 'join') return <Joining juegos={juegos} request={view} onExit={exit} />
  if (screen === 'score') return <Scoreboard juegos={juegos} onExit={exit} />
  return (
    <GameSelector
      juegos={juegos}
      onPick={(screen) => setView({ screen })}
      onJoin={(game, as, code) => setView({ screen: 'join', game, as, code })}
      onScore={() => setView({ screen: 'score' })}
      onGacha={(tab) => setView({ screen: 'gacha', tab })}
      onHome={home}
    />
  )
}

// Página /juegos de TopCode: todo la sección de juegos vive dentro de .juegos-root para que sus estilos no toquen el resto.
export default function Juegos() {
  return (
    <div className="juegos-root">
      <JuegosScreens />
    </div>
  )
}
