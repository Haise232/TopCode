import { useState } from 'react'
import { eur } from './money.js'
import { RARITY, pct } from './gacha.js'
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
          <img
            src={card.img}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            // pos: encuadre horizontal cuando lo importante de la imagen no está en el centro.
            style={card.pos ? { objectPosition: `${card.pos} 20%` } : undefined}
            onError={() => setBroken(true)}
          />
        )}
      </span>
      {!mini && (
        <figcaption>
          <b>{card.name}</b>
          {card.series && <small>{card.series}</small>}
          <span className="gacha-card__tags">
            <em>{RARITY[card.rarity]}</em>
            <span title="Precio de venta">{eur(card.price)}</span>
          </span>
          {card.fusion ? (
            <span className="gacha-card__odds gacha-card__fuse">Solo por fusión: {card.fusion.join(' + ')}</span>
          ) : (
            card.odds && <span className="gacha-card__odds">{pct(card.odds.normal)} por tirada</span>
          )}
          {card.fusesWith && <span className="gacha-card__odds gacha-card__fuse">Júntala con {card.fusesWith.with}: fusión mítica</span>}
        </figcaption>
      )}
    </figure>
  )
}

export default GachaCard
