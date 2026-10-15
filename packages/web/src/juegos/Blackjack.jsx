import { useEffect, useState } from 'react'
import { useEffectEvent } from './useEffectEvent.js'
import { CHIPS, canDouble, canSplit, handValue, isNatural } from './blackjack.js'
import { eur } from './money.js'
import { isMuted, playCard, playChip, playLose, playWin, setMuted } from './sound.js'
import { useCountUp } from './useCountUp.js'
import PlayingCard from './PlayingCard.jsx'
import WinBurst from './WinBurst.jsx'
import Help from './Help.jsx'
import './Blackjack.css'

const OUTCOMES = {
  blackjack: '¡Blackjack!',
  win: 'Ganas',
  push: 'Empate',
  lose: 'Pierdes',
  bust: 'Te pasas',
}

const totalLabel = (cards) => {
  const { total, soft } = handValue(cards)
  return soft && total < 21 ? `${total - 10} / ${total}` : `${total}`
}

const EMPTY = { phase: 'idle', dealer: [], hands: [], active: 0, payout: 0, wagered: 0, round: 0, shoeLeft: 312, shuffled: false }

// La mano la guarda y la resuelve el servidor con el saldo semanal (cuenta en el Score): aquí se apuesta, se juega
// y se anima al crupier carta a carta con lo que devuelve (step: 0 tapada, 1 destapada, 2… cartas que roba).
function BlackjackSolo({ onExit, juegos }) {
  const { request } = juegos
  const [view, setView] = useState(null)
  const [step, setStep] = useState(Infinity)
  const [waiting, setWaiting] = useState(false)
  const [bet, setBet] = useState(50)
  const [sound, setSound] = useState(() => !isMuted())
  const v = view ?? EMPTY
  const { hands: serverHands, active, payout, wagered, round, shoeLeft, shuffled } = v

  const lastStep = Math.max(1, v.dealer.length - 1)
  const animating = v.phase === 'idle' && round > 0 && step < lastStep
  const phase = v.phase === 'player' ? 'player' : animating ? 'dealer' : 'idle'
  const revealed = v.phase !== 'player' && (!animating || step >= 1)
  const dealer = animating ? v.dealer.slice(0, Math.max(2, step + 1)) : v.dealer
  const hands = animating ? serverHands.map((hand) => ({ ...hand, outcome: null })) : serverHands
  // El cobro se ve en el saldo cuando el crupier termina.
  const bank = (juegos.me?.balance ?? 0) - (animating ? payout : 0)
  const state = { phase, hands, active, bank }

  const playing = phase !== 'idle' || waiting
  const settled = phase === 'idle' && round > 0
  const broke = !playing && bank < CHIPS[0]
  const net = payout - wagered
  const won = settled && net > 0
  const big = won && net >= wagered * 1.5
  const shownBank = useCountUp(bank)
  const cardsOut = dealer.length + hands.reduce((sum, hand) => sum + hand.cards.length, 0)
  // La carta tapada del crupier no cuenta hasta que se descubre.
  const dealerShown = revealed ? dealer : dealer.slice(0, 1)

  useEffect(() => {
    if (cardsOut > 0) playCard()
  }, [cardsOut])

  // Al entrar se retoma la mano que hubiera a medias (sin animar la última que terminó).
  useEffect(() => {
    request({ t: 'solo_state' }).then((body) => {
      if (body?.soloState?.blackjack) {
        setView(body.soloState.blackjack)
        if (body.soloState.blackjack.bet > 0) setBet(body.soloState.blackjack.bet)
      }
    })
  }, [request])

  // El crupier destapa y roba a su ritmo, una carta cada vez.
  useEffect(() => {
    if (!animating) return
    const timer = setTimeout(() => setStep((n) => n + 1), step === 0 ? 900 : 650)
    return () => clearTimeout(timer)
  }, [animating, step])

  useEffect(() => {
    if (!settled) return
    if (net > 0) playWin(big)
    else if (net < 0) playLose()
  }, [settled, round, net, big])

  async function play(msg) {
    if (waiting) return
    setWaiting(true)
    const body = await request({ t: 'solo_blackjack', ...msg })
    setWaiting(false)
    if (!body?.solo) return
    // Una mano que termina en esta jugada se anima desde la carta tapada.
    if (body.solo.phase === 'idle' && (msg.a === 'deal' || v.phase === 'player')) setStep(0)
    setView(body.solo)
  }

  function deal() {
    if (playing || bet <= 0 || bank < bet) return
    playChip()
    play({ a: 'deal', bet })
  }

  const ACTIONS = { HIT: 'hit', STAND: 'stand', DOUBLE: 'double', SPLIT: 'split' }
  function act(type) {
    if (phase !== 'player') return
    if (type === 'DOUBLE' && !canDouble(state)) return
    if (type === 'SPLIT' && !canSplit(state)) return
    play({ a: ACTIONS[type] })
  }

  const onKey = useEffectEvent((event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.code === 'Space') {
      // Si el foco está en un botón por teclado, se respeta su acción.
      if (event.target instanceof Element && event.target.matches('button:focus-visible')) return
      event.preventDefault()
      deal()
      return
    }
    const type = { KeyP: 'HIT', KeyM: 'STAND', KeyD: 'DOUBLE', KeyS: 'SPLIT' }[event.code]
    if (type) act(type)
  })

  useEffect(() => {
    const listener = (event) => onKey(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  let status = 'Pon tus fichas y reparte.'
  if (phase === 'player') {
    const label = totalLabel(hands[active].cards)
    status = hands.length > 1 ? `Mano ${active + 1} de 2: ${label}. ¿Pides o te plantas?` : `Tienes ${label}. ¿Pides o te plantas?`
  } else if (phase === 'dealer') status = 'Juega el crupier…'
  else if (juegos.error) status = juegos.error
  else if (broke) status = 'Te quedaste sin saldo esta semana. El domingo a las 23:59 vuelves a tener 10.000 €.'
  else if (settled) {
    if (hands.length > 1) {
      const parts = hands.map((hand, i) => `mano ${i + 1}: ${OUTCOMES[hand.outcome].toLowerCase()}`)
      const balance = net > 0 ? `ganas ${eur(net)}` : net < 0 ? `pierdes ${eur(-net)}` : 'quedas igual'
      status = `${parts.join(', ')}. En total ${balance}.`
      status = status[0].toUpperCase() + status.slice(1)
    } else {
      const { outcome } = hands[0]
      if (outcome === 'blackjack') status = `¡Blackjack! Ganas ${eur(net)}.`
      else if (outcome === 'win') status = `Ganas ${eur(net)}.`
      else if (outcome === 'push') status = 'Empate: recuperas tu apuesta.'
      else if (outcome === 'bust') status = 'Te pasaste de 21.'
      else status = isNatural(dealer) ? 'El crupier tiene blackjack.' : 'Gana la casa.'
    }
  } else if (bet === 0) status = 'Pon fichas para apostar.'
  if (!playing && !broke && bet > bank) status = 'No te alcanza para esta apuesta: bórrala y elige otra.'

  return (
    <main className="app">
      <header className="top">
        <h1>Blackjack</h1>
        <div className="hud">
          <dl className="money">
            <div>
              <dt>Saldo de la semana</dt>
              <dd className={won ? 'money__up' : ''}>{eur(shownBank)}</dd>
            </div>
            <div>
              <dt>Apuesta</dt>
              <dd>{eur(playing ? wagered : bet)}</dd>
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
                Acércate a 21 sin pasarte. Las figuras valen 10 y el as 1 u 11. El blackjack (as y carta de 10 de entrada)
                paga 3 a 2; el resto de manos ganadas, 1 a 1.
              </p>
              <p>Puedes doblar con dos cartas y separar una pareja una vez. El crupier se planta en 17.</p>
              <p>Juegas con tu saldo de la semana: lo que ganes o pierdas cuenta en el Score.</p>
              <p className="hint">
                Teclas: <kbd>Espacio</kbd> repartir · <kbd>P</kbd> pedir · <kbd>M</kbd> me planto · <kbd>D</kbd> doblar ·{' '}
                <kbd>S</kbd> separar.
              </p>
            </Help>
          </div>
        </div>
      </header>

      <p className={`status ${won ? 'status--win' : ''}`} aria-live="polite">
        {status}
      </p>

      <section className={`table fill ${big ? 'floor--shake' : ''}`} aria-label="Mesa">
        <div className="shoe" aria-hidden="true">
          <span className="shoe__stack" style={{ '--left': shoeLeft / 312 }} />
          <span className="shoe__label">{shuffled && playing ? 'Barajado' : `${shoeLeft} cartas`}</span>
        </div>

        <div className="seat seat--dealer">
          <h2>
            Crupier
            {dealer.length > 0 && <span className="total">{totalLabel(dealerShown)}</span>}
          </h2>
          <div className="hand">
            {dealer.map((card, i) =>
              card ? (
                <PlayingCard key={`${round}-${card.id}`} {...card} down={i === 1 && !revealed} index={i < 2 ? i * 2 + 1 : 0} />
              ) : (
                // Carta tapada: el servidor no la manda hasta que se destapa.
                <PlayingCard key={`${round}-tapada`} rank="A" suit="spades" down index={3} />
              ),
            )}
          </div>
        </div>

        <p className="table__rules" aria-hidden="true">
          Blackjack paga 3 a 2 · El crupier se planta en 17
        </p>

        <div className="seat seat--player">
          {hands.length === 0 ? (
            <div className="hand hand--empty">
              <span className="spot">{bet > 0 ? eur(bet) : 'Apuesta'}</span>
            </div>
          ) : (
            <div className="hands">
              {hands.map((hand, h) => {
                const current = phase === 'player' && h === active
                return (
                  <div
                    key={h}
                    className={`hand ${current ? 'hand--active' : ''} ${hand.outcome ? `hand--${hand.outcome}` : ''}`}
                  >
                    <div className="hand__cards">
                      {hand.cards.map((card, i) => (
                        <PlayingCard
                          key={`${round}-${card.id}`}
                          {...card}
                          index={hands.length === 1 && i < 2 ? i * 2 : 0}
                        />
                      ))}
                    </div>
                    <p className="hand__info">
                      <span className="total">{totalLabel(hand.cards)}</span>
                      <span className="hand__bet">
                        {eur(hand.bet)}
                        {hand.doubled && ' (doblada)'}
                      </span>
                      {hand.outcome && <b className="hand__outcome">{OUTCOMES[hand.outcome]}</b>}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <div className="controls">
        {playing ? (
          <div className="actions">
            <button type="button" className="primary" disabled={phase !== 'player' || waiting} onClick={() => act('HIT')}>
              Pedir <kbd>P</kbd>
            </button>
            <button type="button" disabled={phase !== 'player' || waiting} onClick={() => act('STAND')}>
              Me planto <kbd>M</kbd>
            </button>
            <button type="button" disabled={!canDouble(state) || waiting} onClick={() => act('DOUBLE')}>
              Doblar <kbd>D</kbd>
            </button>
            <button type="button" disabled={!canSplit(state) || waiting} onClick={() => act('SPLIT')}>
              Separar <kbd>S</kbd>
            </button>
          </div>
        ) : (
          <>
            <div className="chips" role="group" aria-label="Añadir fichas a la apuesta">
              {CHIPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`chip chip--bj${value}`}
                  disabled={bet + value > bank}
                  onClick={() => {
                    playChip()
                    setBet(bet + value)
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="actions">
              <button type="button" disabled={bet === 0} onClick={() => setBet(0)}>
                Borrar
              </button>
              {!broke && (
                <button type="button" className="primary" disabled={bet <= 0 || bet > bank} onClick={deal}>
                  Repartir
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {won && (
        <WinBurst
          key={round}
          amount={payout}
          caption={`Con ${eur(wagered)} de apuesta`}
          coins={Math.min(70, Math.round(24 + (net / Math.max(wagered, 1)) * 12))}
          big={big}
          tags={hands.some((hand) => hand.outcome === 'blackjack') ? ['Blackjack'] : []}
        />
      )}
    </main>
  )
}

// La mesa compartida se elige desde el selector de juegos; aquí solo queda el blackjack contra el crupier.
export default BlackjackSolo
