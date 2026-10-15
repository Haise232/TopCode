import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
// Fuentes de juegos, servidas por la propia app.
import '@fontsource/abril-fatface/latin.css'
import '@fontsource-variable/instrument-sans/index.css'
import Roulette from './Roulette.jsx'
import Slots from './Slots.jsx'
import Blackjack from './Blackjack.jsx'
import PlayingCard from './PlayingCard.jsx'
import SlotSymbol from './SlotSymbol.jsx'
import Table from './table/Table.jsx'
import PokerTable from './poker/PokerTable.jsx'
import { useJuegos } from './useJuegos.js'
import Scoreboard from './Scoreboard.jsx'
import Avatar from './Avatar.jsx'
import { eur, until } from './money.js'
import './reset.css'
import './index.css'
import './App.css'
import './Lobby.css'
import './table/table.css'

const LIVE = {
  blackjack: {
    name: 'Blackjack',
    blurb: 'Mesa compartida contra el crupier. Apuesta, pide y dobla en tu turno.',
    art: (
      <span className="game__cards">
        <PlayingCard rank="A" suit="spades" />
        <PlayingCard rank="K" suit="hearts" />
      </span>
    ),
  },
  poker: {
    name: 'Póker',
    blurb: "Texas Hold'em sin límite, ciegas de 50 € y 100 €. La mano empieza con dos jugadores.",
    art: (
      <span className="game__poker">
        <span className="game__cards">
          <PlayingCard rank="A" suit="hearts" />
          <PlayingCard rank="A" suit="spades" />
        </span>
        <span className="game__pile">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ '--n': i }} />
          ))}
        </span>
      </span>
    ),
  },
}

const SOLO = [
  {
    id: 'roulette',
    name: 'Ruleta',
    blurb: 'En vivo: una tirada cada 25 s para todos, con relámpagos y pista.',
    art: <span className="game__wheel" />,
  },
  {
    id: 'slots',
    name: 'Tragamonedas',
    blurb: 'Cinco rodillos, diez líneas y giro automático.',
    art: (
      <span className="game__reels">
        <SlotSymbol name="seven" />
        <SlotSymbol name="seven" />
        <SlotSymbol name="seven" />
      </span>
    ),
  },
  {
    id: 'blackjack',
    name: 'Blackjack solo',
    blurb: 'Tú contra el crupier, seis barajas, paga 3 a 2.',
    art: (
      <span className="game__cards">
        <PlayingCard rank="Q" suit="diamonds" />
        <PlayingCard rank="J" suit="clubs" />
      </span>
    ),
  },
]

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const SCORES_MS = 30000

// Fotos de quien está sentado (las de TopCode; si no hay, iniciales).
function Faces({ people }) {
  if (people.length === 0) return null
  const shown = people.slice(0, 5)
  return (
    <span className="faces" aria-label={`En la mesa: ${people.map((p) => p.name).join(', ')}`}>
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} title={p.name}>
          <Avatar name={p.name} src={p.avatar} size={26} />
        </span>
      ))}
      {people.length > shown.length && <i className="faces__more">+{people.length - shown.length}</i>}
    </span>
  )
}

// Acceso al score desde el selector: tu puesto, tu saldo y cuánto falta para el reinicio.
function ScoreCard({ scores, me, resetAt, online, onOpen }) {
  const top = scores?.players.slice(0, 3) ?? []
  const mine = scores?.players.find((p) => p.me)
  return (
    <button type="button" className="score-card" disabled={!online} onClick={onOpen}>
      <span className="score-card__head">
        <span className="game__name">Score</span>
        {resetAt && <span className="score-card__reset">Reinicio en {until(resetAt)}</span>}
      </span>
      <span className="score-card__body">
        <span className="score-card__me">
          {mine ? (
            <>
              <b>#{mine.rank}</b> de {scores.players.length} · {eur(mine.balance)}
            </>
          ) : me ? (
            <>Juega una mano o una tirada para entrar en la clasificación.</>
          ) : (
            <>Conectando…</>
          )}
        </span>
        {top.length > 0 && (
          <span className="score-card__top">
            {top.map((p) => (
              <span key={p.rank} className="score-card__leader">
                <i>{p.rank}</i>
                <Avatar name={p.name} src={p.avatar} size={24} />
                <span>{p.name}</span>
                <b>{eur(p.balance)}</b>
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  )
}

// Tarjeta de un juego en vivo: cuántos juegan ahora y botones para sentarse o mirar, sin códigos.
function LiveGame({ game, tables, online, onJoin }) {
  const { name, blurb, art } = LIVE[game]
  const players = tables.reduce((sum, t) => sum + t.players, 0)
  const watching = tables.reduce((sum, t) => sum + t.spectators, 0)
  const people = tables.flatMap((t) => t.people)
  // En el póker la mano empieza con dos: si alguien espera solo, se dice quién para que se anime otro.
  const alone = game === 'poker' ? tables.find((t) => t.players === 1 && t.phase === 'waiting') : null
  let pulse = 'Conectando…'
  if (online) {
    if (alone) pulse = `${alone.people[0]?.name ?? 'Alguien'} espera rival${players > 1 ? ` · ${players} jugando` : ''}`
    else if (players > 0) pulse = `${players} jugando${watching ? ` · ${watching} mirando` : ''}`
    else pulse = 'Mesa libre: siéntate el primero'
  }
  return (
    <article className={`live ${players > 0 ? 'live--busy' : ''}`}>
      <span className="game__art live__art" aria-hidden="true">
        {art}
      </span>
      <div className="live__body">
        <p className="live__pulse">
          <span className={`dot ${online ? (players > 0 ? 'dot--on' : '') : 'dot--off'}`} aria-hidden="true" />
          {pulse}
          <Faces people={people} />
        </p>
        <h3 className="game__name">{name}</h3>
        <p className="game__blurb">{blurb}</p>
        {tables.length > 1 && (
          <ul className="live__tables">
            {tables.map((t) => (
              <li key={t.code}>
                <button type="button" disabled={!online || t.players >= t.seats} onClick={() => onJoin(game, 'player', t.code)}>
                  {t.label} <small>{t.players === 1 && game === 'poker' && t.phase === 'waiting' ? 'espera rival' : `${t.players}/${t.seats}`}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="actions live__actions">
          <button type="button" className="primary" disabled={!online} onClick={() => onJoin(game, 'player')}>
            Jugar
          </button>
          <button type="button" disabled={!online} onClick={() => onJoin(game, 'spectator')}>
            Mirar
          </button>
        </div>
      </div>
    </article>
  )
}

function GameSelector({ juegos, onPick, onJoin, onScore, onHome }) {
  const { me, lobby, conn, scores, send } = juegos
  const online = conn === 'open' && Boolean(me) && Boolean(lobby)

  // El resumen del score se refresca mientras se está en el selector.
  useEffect(() => {
    if (conn !== 'open' || !me) return
    send({ t: 'scores' })
    const timer = setInterval(() => send({ t: 'scores' }), SCORES_MS)
    return () => clearInterval(timer)
  }, [conn, me, send])
  const tablesOf = (game) => lobby?.tables.filter((t) => t.game === game) ?? []

  let status = 'Elige un juego.'
  if (!online) status = conn === 'connecting' ? 'Conectando con las mesas…' : 'Sin conexión con los juegos. Reintentando…'
  else if (juegos.error) status = juegos.error
  else status = `${plural(lobby.online, 'persona conectada', 'personas conectadas')}. Entra a una mesa en vivo sin código o juega solo: todo cuenta en el Score.`

  return (
    <main className="app app--lobby">
      <header className="top">
        <h1>Juegos</h1>
        <div className="hud">
          {me && (
            <div className="whoami">
              <Avatar name={me.name} src={me.avatar} size={44} />
              <dl className="money">
                <div>
                  <dt>{me.name} · esta semana</dt>
                  <dd>{eur(me.balance)}</dd>
                </div>
              </dl>
            </div>
          )}
          <div className="toggles">
            <button type="button" onClick={onHome}>
              TopCode
            </button>
          </div>
        </div>
      </header>

      <p className="status" aria-live="polite">
        {status}
      </p>

      <div className="picker fill">
        <section className="picker__live" aria-labelledby="live-title">
          <h2 id="live-title" className="picker__title">
            En vivo <small>con la gente de TopCode</small>
          </h2>
          <div className="picker__cards">
            {Object.keys(LIVE).map((game) => (
              <LiveGame key={game} game={game} tables={tablesOf(game)} online={online} onJoin={onJoin} />
            ))}
          </div>
        </section>

        <section className="picker__solo" aria-labelledby="solo-title">
          <h2 className="picker__title">
            Clasificación <small>se reinicia el domingo a las 23:59</small>
          </h2>
          <ScoreCard scores={scores} me={me} resetAt={lobby?.resetAt} online={online} onOpen={onScore} />
          <h2 id="solo-title" className="picker__title picker__title--gap">
            Solo <small>con tu saldo de la semana</small>
          </h2>
          <div className="picker__list">
            {SOLO.map(({ id, name, blurb, art }) => (
              <button key={id} type="button" className="game game--row" disabled={!online} onClick={() => onPick(id)}>
                <span className="game__art" aria-hidden="true">
                  {art}
                </span>
                <span className="game__text">
                  <span className="game__name">{name}</span>
                  <span className="game__blurb">{blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
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
  // screen: lobby | roulette | slots | blackjack | join | score
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
      />
    )
  }

  const { screen } = view
  if (screen === 'roulette') return <Roulette onExit={exit} juegos={juegos} />
  if (screen === 'slots') return <Slots onExit={exit} juegos={juegos} />
  if (screen === 'blackjack') return <Blackjack onExit={exit} juegos={juegos} />
  if (screen === 'join') return <Joining juegos={juegos} request={view} onExit={exit} />
  if (screen === 'score') return <Scoreboard juegos={juegos} onExit={exit} />
  return (
    <GameSelector
      juegos={juegos}
      onPick={(screen) => setView({ screen })}
      onJoin={(game, as, code) => setView({ screen: 'join', game, as, code })}
      onScore={() => setView({ screen: 'score' })}
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
