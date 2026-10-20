import { useState } from 'react'
import { CAT_NAME, RARITY } from './gacha.js'
import './Gacha.css'

// Una carta del gacha. mini: solo la imagen con el marco de su rareza. Si la imagen no carga, las iniciales.
function GachaCard({ card, big = false, mini = false }) {
  const [broken, setBroken] = useState(false)
  const initials = card.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <figure className={`gacha-card gacha-card--${card.rarity} ${big ? 'gacha-card--big' : ''} ${mini ? 'gacha-card--mini' : ''}`}>
      <span className="gacha-card__img">
        {broken ? (
          <span className="gacha-card__fallback" aria-hidden="true">
            {initials}
          </span>
        ) : (
          <img src={card.img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        )}
      </span>
      {!mini && (
        <figcaption>
          <b>{card.name}</b>
          {card.series && <small>{card.series}</small>}
          <span className="gacha-card__tags">
            <em>{RARITY[card.rarity]}</em>
            <span>{CAT_NAME[card.cat]}</span>
            <span className="gacha-kakera" title="Valor en kakera">
              {card.value}
            </span>
          </span>
        </figcaption>
      )}
    </figure>
  )
}

export default GachaCard
