import { useEffect } from 'react'
import Avatar from '../Avatar.jsx'
import { eur } from '../money.js'
import FeltPrint from '../FeltPrint.jsx'
import PlayingCard from '../PlayingCard.jsx'
import { playCard, playChip, playLose, playTurn, playWin } from '../sound.js'
import { useCountdown } from './useCountdown.js'
import Help from '../Help.jsx'
import Chat from './Chat.jsx'
import Invite from './Invite.jsx'
import '../Blackjack.css'

// Fichas de la mesa (las mismas que valida el servidor en server/room.js).
const CHIPS = [50, 100, 500, 1000]

const OUTCOMES = {
  blackjack: 'Blackjack',
  win: 'Gana',
  push: 'Empate',
  lose: 'Pierde',
  bust: 'Se pasa',
}

const STATUS = { playing: 'Jugando', stand: 'Plantado', bust: 'Se pasa', blackjack: 'Blackjack' }

// Fichas que representan una apuesta, de mayor a menor valor.
function chipsFor(amount) {
  const chips = []
  for (const value of [...CHIPS].reverse()) {
    while (amount >= value && chips.length < 9) {
      chips.push(value)
      amount -= value
    }
  }
  return chips
}

function ChipStack({ amount }) {
  return (
    <span className="stack" aria-hidden="true">
      {chipsFor(amount).map((value, i) => (
        <span key={i} className={`stack__chip chip--bj${value}`} style={{ '--n': i }} />
      ))}
    </span>
  )
}

// Asientos en arco a lo largo del borde curvo. El primero queda a la izquierda del crupier
// (a la derecha de quien mira), como en la sección de juegos, y el juego avanza hacia la izquierda.
function placement(index, count) {
  const angle = count === 1 ? 90 : 16 + (148 * index) / (count - 1)
  const rad = (angle * Math.PI) / 180
  // El radio del arco lo pone el CSS, que lo cambia en pantallas estrechas.
  return { '--cos': Math.cos(rad), '--sin': Math.sin(rad) }
}

function Seat({ seat, index, count, mine, active, fraction, round, canSit, canKick, onSit, onKick }) {
  const style = placement(index, count)
  if (!seat) {
    return (
      <div className="pseat pseat--empty" style={style}>
        <div className="pseat__cards" />
        <span className="pseat__spot">
          <span className="pseat__number">{index + 1}</span>
        </span>
        {canSit ? (
          <button type="button" className="pseat__sit" onClick={onSit}>
            Sentarme
          </button>
        ) : (
          <span className="pseat__plate pseat__plate--free">Libre</span>
        )}
      </div>
    )
  }
  const label = seat.outcome ? null : seat.cards.length ? STATUS[seat.status] : seat.locked ? 'Lista' : 'Apostando'
  return (
    <div
      className={`pseat ${mine ? 'pseat--me' : ''} ${active ? 'pseat--turn' : ''} ${seat.connected ? '' : 'pseat--away'} ${seat.outcome ? `pseat--${seat.outcome}` : ''}`}
      style={{ ...style, '--p': active ? fraction : 0 }}
    >
      <div className="pseat__cards">
        {seat.cards.map((card, i) => (
          <PlayingCard key={`${round}-${card.id}`} {...card} index={i} />
        ))}
        {seat.total !== null && <span className="total pseat__total">{seat.total}</span>}
      </div>
      <span className="pseat__spot">
        {seat.bet > 0 ? <ChipStack amount={seat.bet} /> : <span className="pseat__number">{index + 1}</span>}
        {seat.outcome && <b className="pseat__outcome">{OUTCOMES[seat.outcome]}</b>}
      </span>
      <div className="pseat__plate">
        <span className="pseat__name">
          <Avatar name={seat.name} src={seat.avatar} size={22} className="pseat__avatar" />
          {seat.name}
          {mine && <small> (tú)</small>}
        </span>
        <span className="pseat__money">
          {eur(seat.balance)}
          {seat.bet > 0 && <small> · apuesta {eur(seat.bet)}</small>}
        </span>
        <span className="pseat__state">
          {!seat.connected ? 'Sin conexión' : seat.paid > 0 ? `Cobra ${eur(seat.paid)}` : label}
        </span>
        {canKick && (
          <button type="button" className="pseat__kick" onClick={onKick}>
            Echar
          </button>
        )}
      </div>
    </div>
  )
}

function Table({ room, me, conn, error, send, onLeave, chat }) {
  const { state, at } = room
  const mySeat = state.seats.findIndex((seat) => seat?.id === me?.id)
  const mine = mySeat >= 0 ? state.seats[mySeat] : null
  const clock = useCountdown(state.deadlineIn, state.deadlineTotal, at)
  const cards = state.dealer.length + state.seats.reduce((sum, seat) => sum + (seat?.cards.length ?? 0), 0)
  const myTurn = state.phase === 'playing' && state.turn === mySeat && mySeat >= 0
  const betting = state.phase === 'betting'
  const broke = mine && !mine.locked && mine.balance < CHIPS[0]
  const isHost = state.hostId === me?.id
  const myOutcome = mine?.outcome

  useEffect(() => {
    if (cards > 0) playCard()
  }, [cards])

  // Tu turno se oye, vibra (en el móvil) y se ve en la pestaña aunque estés en otra, igual que en el póker.
  useEffect(() => {
    if (!myTurn) return
    playTurn()
    navigator.vibrate?.(150)
    const title = document.title
    document.title = '● Tu turno · Blackjack'
    return () => {
      document.title = title
    }
  }, [myTurn])

  useEffect(() => {
    if (!myOutcome) return
    if (myOutcome === 'win' || myOutcome === 'blackjack') playWin(myOutcome === 'blackjack')
    else if (myOutcome !== 'push') playLose()
  }, [myOutcome, state.round])

  const players = state.seats.filter(Boolean).length
  let status = 'Esperando jugadores…'
  if (conn !== 'open') status = 'Conexión perdida. Reconectando…'
  else if (error) status = error
  else if (betting) {
    if (!mine) status = 'Estás mirando. Elige un asiento libre para jugar.'
    else if (broke) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
    else if (mine.locked) status = 'Apuesta lista. Esperando al resto de la mesa…'
    else status = `Pon tus fichas y confirma la apuesta.${players === 1 ? ' Juegas solo contra el crupier: invita a alguien con «Invitar».' : ''}`
  } else if (state.phase === 'playing') {
    const who = state.seats[state.turn]
    status = myTurn ? `Tu turno: tienes ${mine.total}. ¿Pides o te plantas?` : `Juega ${who?.name ?? '…'}.`
  } else if (state.phase === 'dealer') status = 'Juega el crupier…'
  else if (state.phase === 'settle') {
    if (mine?.outcome) {
      const net = mine.paid - mine.bet
      status = net > 0 ? `Ganas ${eur(net)}.` : net < 0 ? `Pierdes ${eur(-net)}.` : 'Empate: recuperas tu apuesta.'
    } else status = 'Ronda terminada.'
  }

  const showClock = clock && (betting || state.phase === 'playing')

  return (
    <main className="app">
      <header className="top">
        <h1>Blackjack</h1>
        <div className="hud">
          {mine && (
            <dl className="money">
              <div>
                <dt>Saldo</dt>
                <dd>{eur(mine.balance)}</dd>
              </div>
              <div>
                <dt>Apuesta</dt>
                <dd>{eur(mine.bet)}</dd>
              </div>
            </dl>
          )}
          <div className="toggles">
            <button type="button" onClick={onLeave}>
              Salir de la sala
            </button>
            <Invite game="blackjack" code={state.code} name="Blackjack" />
            <Help title="Mesa online">
              {state.label ? (
                <p>Es una mesa pública: cualquiera con cuenta puede sentarse desde el selector de juegos, sin código.</p>
              ) : (
                <p>
                  Para invitar a alguien, pásale el código <b>{state.code}</b> y la dirección <b>{location.origin}</b>.
                </p>
              )}
              <p>
                Cada jugador empieza la semana con 10.000 € (se reinicia el domingo a las 23:59). Pon tus fichas y confirma la apuesta: la ronda
                empieza cuando todos están listos o se acaba el tiempo. En tu turno puedes pedir, plantarte y doblar.
              </p>
            </Help>
          </div>
        </div>
      </header>

      <p className={`status ${myOutcome === 'win' || myOutcome === 'blackjack' ? 'status--win' : ''}`} aria-live="polite">
        {status}
        {showClock && <span className="countdown"> {clock.seconds} s</span>}
      </p>

      <section className="table ptable fill" aria-label="Mesa">
        <div className="placard">
          <span className="placard__label">{state.label ? 'Pública' : 'Sala'}</span>
          <span className="placard__code">{state.label ?? state.code}</span>
          <span className="placard__limits">Mínimo {eur(CHIPS[0])}</span>
        </div>

        <div className="shoe" aria-hidden="true">
          <span className="shoe__stack" style={{ '--left': state.shoe / 312 }} />
          <span className="shoe__label">{state.spectators === 1 ? '1 mirando' : `${state.spectators} mirando`}</span>
        </div>

        <div className="seat seat--dealer ptable__dealer">
          <h2>
            Crupier
            {state.dealerTotal !== null && <span className="total">{state.dealerTotal}</span>}
          </h2>
          <div className="hand">
            {state.dealer.map((card, i) => (
              <PlayingCard
                key={`${state.round}-${i}`}
                rank={card?.rank ?? 'A'}
                suit={card?.suit ?? 'spades'}
                down={card === null}
                index={i}
              />
            ))}
          </div>
        </div>

        <FeltPrint note="El crupier pide hasta 16 y se planta en 17" />

        <div className="ptable__seats">
          {state.seats.map((seat, i) => (
            <Seat
              key={i}
              seat={seat}
              index={i}
              count={state.seats.length}
              mine={i === mySeat}
              active={state.phase === 'playing' && state.turn === i}
              fraction={clock?.fraction ?? 0}
              round={state.round}
              canSit={mySeat < 0 && conn === 'open'}
              canKick={isHost && seat && i !== mySeat && betting}
              onSit={() => send({ t: 'sit', seat: i })}
              onKick={() => send({ t: 'kick', seat: i })}
            />
          ))}
        </div>
      </section>

      <div className="controls">
        {myTurn && (
          <div className="actions">
            <button type="button" className="primary" onClick={() => send({ t: 'action', kind: 'hit' })}>
              Pedir
            </button>
            <button type="button" onClick={() => send({ t: 'action', kind: 'stand' })}>
              Me planto
            </button>
            <button
              type="button"
              disabled={mine.cards.length !== 2 || mine.balance < mine.bet}
              onClick={() => send({ t: 'action', kind: 'double' })}
            >
              Doblar
            </button>
          </div>
        )}
        {mine && betting && !mine.locked && (
          <>
            <div className="chips" role="group" aria-label="Añadir fichas a la apuesta">
              {CHIPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`chip chip--bj${value}`}
                  disabled={mine.bet + value > mine.balance}
                  onClick={() => {
                    playChip()
                    send({ t: 'bet', amount: mine.bet + value })
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="actions">
              <button type="button" disabled={mine.bet === 0} onClick={() => send({ t: 'bet', amount: 0 })}>
                Borrar
              </button>
              {!broke && (
                <button type="button" className="primary" disabled={mine.bet <= 0} onClick={() => send({ t: 'ready' })}>
                  Apostar {eur(mine.bet)}
                </button>
              )}
              <button type="button" onClick={() => send({ t: 'stand_up' })}>
                Dejar el asiento
              </button>
            </div>
          </>
        )}
      </div>

      <Chat messages={chat ?? []} me={me} send={send} />
    </main>
  )
}

export default Table
