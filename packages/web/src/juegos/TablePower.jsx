import { useEffect, useRef, useState } from 'react'
import GachaCard from './GachaCard.jsx'
import { RARITY } from './gacha.js'
import { playZap } from './sound.js'

const CAST_MS = 2800
const keyOf = (p) => `${p.hand}-${p.seat}-${p.card.id}`

// Animación en el centro de la mesa cuando alguien usa el poder de una carta del gacha (state.powers, que ve toda la
// mesa). Solo anima los poderes nuevos: los que ya estaban al abrir la mesa salen directamente junto a su asiento.
export function PowerCast({ powers, seats }) {
  const seen = useRef(null)
  const timer = useRef(null)
  const [cast, setCast] = useState(null)

  // Las vistas de la mesa llegan a menudo: el temporizador va aparte para que una vista nueva no corte la animación.
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    const list = powers ?? []
    if (seen.current === null) {
      seen.current = new Set(list.map(keyOf))
      return
    }
    const fresh = list.find((p) => !seen.current.has(keyOf(p)))
    for (const p of list) seen.current.add(keyOf(p))
    if (!fresh) return
    setCast(fresh)
    playZap()
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCast(null), CAST_MS)
  }, [powers])

  if (!cast) return null
  const who = seats[cast.seat]?.name ?? 'Alguien'
  return (
    <div className={`tp-cast tp-cast--${cast.card.rarity}`} role="status">
      <span className="tp-cast__rays" aria-hidden="true" />
      <div className="tp-cast__card">
        <GachaCard card={cast.card} />
      </div>
      <p className="tp-cast__text">
        <span>
          <b>{who}</b> usa <em>{cast.power}</em>
        </span>
        <small>
          con {cast.card.name} ({RARITY[cast.card.rarity].toLowerCase()})
        </small>
      </p>
    </div>
  )
}

// La carta en miniatura junto a la foto de quien la está usando, mientras dura su poder (la mano en curso).
export function SeatPower({ power }) {
  if (!power) return null
  return (
    <span className={`tp-seat tp-seat--${power.card.rarity}`} title={`${power.power} · ${power.card.name}`}>
      <GachaCard card={power.card} mini />
      <i aria-hidden="true">✦</i>
    </span>
  )
}

// El poder que usa ese asiento en esta mano, si usa alguno.
export const powerOfSeat = (powers, index) => (powers ?? []).find((p) => p.seat === index) ?? null
