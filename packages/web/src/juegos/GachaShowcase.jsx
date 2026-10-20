import Avatar from './Avatar.jsx'
import GachaCard from './GachaCard.jsx'
import { RARITY, useGacha, useServerNow, wait } from './gacha.js'

const SHOWN = 6

// El gacha en el selector de juegos: las últimas cartas del canal en directo y tu estado, con acceso directo.
function GachaShowcase({ juegos, online, onOpen }) {
  const { state, feed, offset } = useGacha(juegos.request)
  const t = useServerNow(offset)
  const claimReady = state ? state.claimAt === 0 || state.claimAt <= t : false
  const open = feed.filter((r) => r.until > t)
  const recent = feed.slice(0, SHOWN)
  const best = feed.find((r) => r.card.rarity === 'mitica') ?? feed.find((r) => r.card.rarity === 'epica')

  let headline = 'Anime, cine y políticos: tira y quédate la carta antes que nadie.'
  if (open.length > 0) headline = `¡${open.length === 1 ? 'Hay una carta' : `Hay ${open.length} cartas`} por reclamar ahora mismo!`
  else if (best) headline = `Última gran tirada: ${best.card.name} (${RARITY[best.card.rarity].toLowerCase()}).`

  return (
    <article className={`hub-gacha ${open.length ? 'is-hot' : ''}`} aria-labelledby="gacha-title">
      <div className="hub-gacha__head">
        <h3 id="gacha-title">Gacha</h3>
        <span className={`hub-chip hub-chip--${open.length ? 'on' : 'free'}`}>
          <i aria-hidden="true" />
          {open.length ? `${open.length} por reclamar` : 'En directo'}
        </span>
      </div>
      <p className="hub-gacha__line">{headline}</p>

      {recent.length > 0 ? (
        <ul className="hub-gacha__strip" aria-label="Últimas tiradas">
          {recent.map((r) => (
            <li key={r.id} className={r.until > t ? 'is-open' : ''} title={`${r.card.name} · ${RARITY[r.card.rarity]} · tirada de ${r.by.name}`}>
              <GachaCard card={r.card} mini />
              <span className="hub-gacha__who">
                <Avatar name={r.by.name} src={r.by.avatar} size={18} />
                {r.until > t ? wait(r.until - t) : r.claimed ? `de ${r.claimed.name}` : r.owner ? `de ${r.owner.name}` : 'libre'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="hub-gacha__strip hub-gacha__strip--empty" aria-hidden="true">
          {Array.from({ length: SHOWN }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      )}

      <div className="hub-gacha__foot">
        <dl className="hub-gacha__facts">
          <div>
            <dt>Tiradas</dt>
            <dd>{state ? `${state.rolls.left}/${state.rolls.max}` : '–'}</dd>
          </div>
          <div>
            <dt>Reclamo</dt>
            <dd className={claimReady ? 'is-ready' : ''}>{state ? (claimReady ? 'Listo' : wait(state.claimAt - t)) : '–'}</dd>
          </div>
          <div>
            <dt>Colección</dt>
            <dd>{state ? state.owned : '–'}</dd>
          </div>
        </dl>
        <div className="hub-gacha__actions">
          <button type="button" className="hub-btn hub-btn--primary" disabled={!online} onClick={() => onOpen('tirar')}>
            {open.length ? 'Ir a reclamar' : 'Tirar'}
          </button>
          <button type="button" className="hub-btn" disabled={!online} onClick={() => onOpen('coleccion')}>
            Colección
          </button>
        </div>
      </div>
    </article>
  )
}

export default GachaShowcase
