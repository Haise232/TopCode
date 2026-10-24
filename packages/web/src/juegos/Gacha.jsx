import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import GachaCard from './GachaCard.jsx'
import GachaPowers from './GachaPowers.jsx'
import Help from './Help.jsx'
import { eur } from './money.js'
import { playBoom, playCard, playGrowl, playHeartbeat, playOvation, playSiren, playSpin, playWin, playZap } from './sound.js'
import { ODDS, RARITIES, RARITY, pct, useGacha, useServerNow, wait } from './gacha.js'
import './Gacha.css'

// Gacha de personajes y mods de juegos al estilo de Mudae (las reglas están en api/_juegos/gacha.mjs): tiradas que ve todo el
// mundo, el primero que reclama se queda la carta, vender cartas por saldo de la semana y ver la colección de cualquiera.

// Probabilidad de una carta concreta: «0,48 %», «0,0029 %».

// Nombre de alguien que lleva a su biblioteca.
function Who({ person, onOpen }) {
  return (
    <button type="button" className="gacha-who" onClick={() => onOpen(person.id)} title={`Ver la biblioteca de ${person.name}`}>
      {person.name}
    </button>
  )
}

// «hace 5 min», «hace 2 h», «hace 3 d».
function ago(ms) {
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`
}

// Un movimiento del canal: salió en la mesa, alguien la cogió o alguien la sacó pagando y se la quedó.
function Move({ move, t, onOpen }) {
  const who = move.by && (move.by.me ? 'Tú' : <Who person={move.by} onOpen={onOpen} />)
  let text = 'Salió en la mesa'
  if (move.type === 'cogida') text = <>{who} la {move.by?.me ? 'cogiste' : 'cogió'} de la mesa</>
  if (move.type === 'guardada') {
    text = (
      <>
        {who} la {move.by?.me ? 'sacaste' : 'sacó'} {move.premium ? 'con una premium' : 'pagando'} y {move.by?.me ? 'te la quedaste' : 'se la quedó'}
      </>
    )
  }
  if (move.type === 'tirada') text = <>{who} la sacó</>
  if (move.type === 'usada') text = <>{who} {move.by?.me ? 'gastaste' : 'gastó'} su poder: vuelve a estar libre</>
  if (move.type === 'fusion') {
    text = (
      <>
        {who} {move.by?.me ? 'juntaste' : 'juntó'} {move.card.fusion?.join(' y ') ?? 'las dos cartas'} y {move.by?.me ? 'las fusionaste' : 'las fusionó'}
      </>
    )
  }
  return (
    <li className={`gacha-roll gacha-move--${move.type} ${move.by?.me ? 'is-mine' : ''}`}>
      <GachaCard card={move.card} mini />
      <div className="gacha-roll__info">
        <span className={`gacha-roll__name gacha-roll__name--${move.card.rarity}`}>
          <b>{move.card.name}</b>
          <small>
            <em>{RARITY[move.card.rarity]}</em>
            {move.card.series ? ` · ${move.card.series}` : ''}
          </small>
        </span>
        <span className="gacha-roll__status">
          {move.by && <Avatar name={move.by.name} src={move.by.avatar} size={18} />}
          {text}
        </span>
      </div>
      <span className="gacha-roll__value">{ago(t - move.at)}</span>
    </li>
  )
}

// El canal enseña los últimos movimientos; el resto, al pulsar «Ver más».
const FEED_SHOWN = 8
const CHARGE_MS = 1300
// Cuanto más rara, más larga y más bestia: la carga de color (build) y el estallido (burst) duran más.
const BUILD_MS = { comun: 0, rara: 600, epica: 1600, mitica: 3400, unica: 4600 }
const BURST_MS = { comun: 650, rara: 750, epica: 950, mitica: 1300, unica: 1700 }
const SPARKS = { rara: 12, epica: 32, mitica: 64, unica: 110 }
const WAVES = { rara: 1, epica: 2, mitica: 3, unica: 5 }
// La mítica tiene dos actos más: un presagio antes de la carga (pantalla negra, latido y grietas) y un apagón antes del
// estallido.
const OMEN_MS = 3000
const BLACKOUT_MS = 900
const EMBERS = 40
const STARS = { rara: 12, epica: 18 }
const COINS = 26
const DUST = 12
const IMPLODE = 26
const BOLTS = 7
const CONFETTI = 46
const range = (n) => Array.from({ length: n }, (_, i) => i)

// La invocación: la carta llega boca abajo y se carga de energía (charge, esperando al servidor). Si es rara o mejor,
// se va tiñendo del color de su rareza (build): las épicas vibran y absorben partículas; las legendarias pasan por
// todos los colores hasta el dorado, les caen rayos y se agrietan. Luego estalla con ondas expansivas (burst) y se da
// la vuelta (show); la legendaria, con explosión dorada, temblor, «¡LEGENDARIA!» letra a letra y lluvia de confeti. La
// mítica hace lo mismo que la legendaria, más larga y en rojo, con «¡MÍTICA!».
function Summon({ summon, busy, onDecide, onClose }) {
  const { stage, result } = summon
  const rarity = result?.card.rarity ?? 'comun'
  const fused = Boolean(result?.fused)
  const legend = rarity === 'mitica' || rarity === 'unica'
  const sparks = SPARKS[rarity] ?? 0
  const waves = WAVES[rarity] ?? 0
  const title = fused ? '¡FUSIÓN!' : rarity === 'unica' ? '¡MÍTICA!' : legend ? '¡LEGENDARIA!' : rarity === 'epica' ? '¡ÉPICA!' : RARITY[rarity]
  const mythic = rarity === 'unica'
  const epic = rarity === 'epica'
  const stars = STARS[rarity] ?? 0
  const lettered = legend || epic
  if (stage === 'omen' || stage === 'blackout') return <MythicOmen stage={stage} />
  return (
    <div
      className={`gacha-summon is-${stage} gacha-summon--${stage === 'charge' ? 'unknown' : rarity}`}
      role="dialog"
      aria-modal="true"
      aria-label="Tirada del gacha"
    >
      <span className="gacha-summon__rays" aria-hidden="true" />
      {/* Foco de luz del color de la rareza bajo la carta. */}
      {stage !== 'charge' && <span className="gacha-summon__floor" aria-hidden="true" />}
      {/* Rara: anillos que se expanden mientras se carga. */}
      {stage === 'build' && rarity === 'rara' && (
        <span className="gacha-summon__rings" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      {/* Épica: círculo mágico de runas detrás de la carta. */}
      {(stage === 'build' || stage === 'show') && epic && (
        <svg className="gacha-summon__runes" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <path id="gacha-rune-path" d="M100 100 m-78 0 a78 78 0 1 1 156 0 a78 78 0 1 1 -156 0" />
          </defs>
          <circle cx="100" cy="100" r="92" />
          <circle cx="100" cy="100" r="64" className="gacha-summon__runes-inner" />
          <path d="M100 8 L180 146 L20 146 Z M100 192 L20 54 L180 54 Z" className="gacha-summon__runes-star" />
          <text>
            <textPath href="#gacha-rune-path">ΑΒΓΔΕΖ ✦ ΗΘΙΚΛΜ ✦ ΝΞΟΠΡΣ ✦ ΤΥΦΧΨΩ ✦</textPath>
          </text>
        </svg>
      )}
      {/* Legendaria: columna de luz dorada que cae sobre la carta. */}
      {stage === 'build' && rarity === 'mitica' && <span className="gacha-summon__pillar" aria-hidden="true" />}
      {legend && stage === 'show' && <span className="gacha-summon__rays gacha-summon__rays--back" aria-hidden="true" />}
      <span className="gacha-summon__flash" aria-hidden="true" />
      {stage === 'build' && (rarity === 'epica' || legend) && (
        <span className="gacha-summon__implode" aria-hidden="true">
          {range(IMPLODE).map((i) => (
            <i key={i} style={{ '--a': `${(360 / IMPLODE) * i + (i % 3) * 7}deg`, '--d': `${220 + ((i * 53) % 220)}px`, '--t': `${(i % 7) * 0.13}s` }} />
          ))}
        </span>
      )}
      {stage === 'build' && legend && (
        <span className="gacha-summon__bolts" aria-hidden="true">
          {range(BOLTS).map((i) => (
            <i key={i} style={{ '--a': `${-70 + i * 23 + (i % 2) * 9}deg`, '--t': `${1.2 + ((i * 0.37) % 1.8)}s` }} />
          ))}
        </span>
      )}
      {(stage === 'burst' || stage === 'show') &&
        range(waves).map((i) => <span key={i} className="gacha-summon__wave" style={{ '--t': `${i * 0.18}s` }} aria-hidden="true" />)}
      {sparks > 0 && stage !== 'charge' && stage !== 'build' && (
        <span className="gacha-summon__sparks" aria-hidden="true">
          {range(sparks).map((i) => (
            <i
              key={i}
              style={{
                '--a': `${(360 / sparks) * i}deg`,
                '--d': `${(legend ? 160 : 110) + ((i * 37) % (legend ? 260 : 160))}px`,
                '--t': `${(i % 5) * 0.05}s`,
              }}
            />
          ))}
        </span>
      )}
      {legend && stage === 'show' && (
        <span className="gacha-summon__confetti" aria-hidden="true">
          {range(CONFETTI).map((i) => (
            <i
              key={i}
              style={{
                '--x': `${(i * 61) % 100}vw`,
                '--t': `${((i * 0.29) % 3.2).toFixed(2)}s`,
                '--s': `${2.6 + ((i * 0.41) % 2.2)}s`,
                '--r': `${(i % 2 ? 1 : -1) * (180 + ((i * 47) % 540))}deg`,
                '--c': ['#f2c14e', '#fff4c7', '#e8a33a', '#ffffff'][i % 4],
              }}
            />
          ))}
        </span>
      )}
      {stage === 'show' && rarity === 'comun' && (
        <span className="gacha-summon__dust" aria-hidden="true">
          {range(DUST).map((i) => (
            <i key={i} style={{ '--a': `${(360 / DUST) * i}deg`, '--d': `${70 + ((i * 29) % 60)}px` }} />
          ))}
        </span>
      )}
      {stage === 'show' && stars > 0 && (
        <span className="gacha-summon__stars" aria-hidden="true">
          {range(stars).map((i) => (
            <i
              key={i}
              style={{
                '--x': `${50 + Math.cos((i / stars) * 6.283) * (24 + (i % 3) * 7)}%`,
                '--y': `${48 + Math.sin((i / stars) * 6.283) * (30 + (i % 2) * 8)}%`,
                '--t': `${((i * 0.37) % 1.6).toFixed(2)}s`,
                '--z': `${12 + (i % 3) * 6}px`,
              }}
            >
              ✦
            </i>
          ))}
        </span>
      )}
      {stage === 'show' && rarity === 'mitica' && (
        <span className="gacha-summon__coins" aria-hidden="true">
          {range(COINS).map((i) => (
            <i key={i} style={{ '--x': `${(i * 41) % 100}vw`, '--t': `${((i * 0.27) % 2.6).toFixed(2)}s`, '--s': `${1.8 + ((i * 0.31) % 1.4)}s` }} />
          ))}
        </span>
      )}
      {mythic && stage === 'show' && (
        <span className="gacha-summon__embers" aria-hidden="true">
          {range(EMBERS).map((i) => (
            <i
              key={i}
              style={{ '--x': `${(i * 37) % 100}vw`, '--t': `${((i * 0.23) % 4).toFixed(2)}s`, '--s': `${3 + ((i * 0.37) % 3)}s`, '--z': `${3 + (i % 4) * 2}px` }}
            />
          ))}
        </span>
      )}
      <div className="gacha-summon__stage">
        {stage === 'show' ? (
          <>
            {mythic && (
              <span className="gacha-summon__crown" aria-hidden="true">
                ♛
              </span>
            )}
            <span className={`gacha-summon__title ${legend ? 'gacha-summon__title--legend' : epic ? 'gacha-summon__title--legend gacha-summon__title--epic' : ''}`} aria-label={title}>
              {lettered
                ? [...title].map((ch, i) => (
                    <span key={i} style={{ '--t': `${0.5 + i * 0.07}s` }} aria-hidden="true">
                      {ch}
                    </span>
                  ))
                : title}
            </span>
            <div className="gacha-summon__card">
              {legend && <span className="gacha-summon__aura" aria-hidden="true" />}
              {rarity === 'mitica' && <span className="gacha-summon__glory" aria-hidden="true" />}
              <GachaCard card={result.card} big />
            </div>
            <p className="gacha-summon__name">{result.card.name}</p>
            {mythic && <p className="gacha-summon__one">{fused ? `${result.card.fusion.join(' + ')} · ` : ''}1 de 1 · única en TopCode</p>}
            {fused ? (
              <div className="gacha-decide">
                <button type="button" className="hub-btn hub-btn--primary" onClick={onClose} autoFocus>
                  ¡A mi biblioteca!
                </button>
              </div>
            ) : (
              <>
                <div className="gacha-decide">
                  <button type="button" className="hub-btn hub-btn--primary" disabled={busy} onClick={() => onDecide(true)} autoFocus>
                    Guardar en mi biblioteca
                  </button>
                  <button type="button" className="hub-btn" disabled={busy} onClick={() => onDecide(false)}>
                    Descartar
                  </button>
                </div>
                <small className="gacha-decide__note">Si la descartas, queda libre para que le toque a otro. Se vende por {eur(result.card.price)}.</small>
              </>
            )}
          </>
        ) : (
          <div className="gacha-summon__card">
            <span className="gacha-summon__back" />
            {stage === 'build' && legend && (
              <svg className="gacha-summon__cracks" viewBox="0 0 100 150" aria-hidden="true">
                <path d="M50 75 L38 52 L44 40 L30 18" />
                <path d="M50 75 L66 60 L62 44 L78 26" />
                <path d="M50 75 L34 90 L40 104 L22 128" />
                <path d="M50 75 L64 96 L58 112 L74 136" />
                <path d="M50 75 L80 78 L92 70" />
                <path d="M50 75 L20 72 L8 80" />
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Los actos previos de la mítica: presagio (latido rojo, grietas por toda la pantalla, «anomalía» parpadeando y la carta
// boca abajo temblando) y apagón (negro total con un punto de luz justo antes de estallar).
function MythicOmen({ stage }) {
  return (
    <div className={`gacha-omen is-${stage}`} role="dialog" aria-modal="true" aria-label="Tirada del gacha">
      {stage === 'omen' ? (
        <>
          <span className="gacha-omen__pulse" aria-hidden="true" />
          <span className="gacha-omen__static" aria-hidden="true" />
          <svg className="gacha-omen__cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M50 50 L42 38 L46 26 L34 10 L30 0" />
            <path d="M50 50 L61 41 L58 28 L72 14 L80 0" />
            <path d="M50 50 L66 54 L80 48 L100 52" />
            <path d="M50 50 L34 56 L20 50 L0 58" />
            <path d="M50 50 L44 64 L52 78 L46 100" />
            <path d="M50 50 L60 66 L74 74 L86 100" />
            <path d="M50 50 L36 70 L18 82 L8 100" />
          </svg>
          <p className="gacha-omen__text" data-text="⚠ ANOMALÍA DETECTADA ⚠">
            ⚠ ANOMALÍA DETECTADA ⚠
          </p>
          <div className="gacha-summon__card gacha-omen__card">
            <span className="gacha-summon__back" />
          </div>
        </>
      ) : (
        <span className="gacha-omen__dot" aria-hidden="true" />
      )}
    </div>
  )
}

// Lo que puede salir en cada tipo de tirada, de lo mejor a lo peor (sin la común, que es lo que sobra).
function Odds({ kind }) {
  return (
    <span className="gacha-odds">
      {RARITIES.filter((r) => ODDS[kind][r] && r !== 'comun').map((r) => (
        <span key={r} className={`gacha-odds__item gacha-odds__item--${r}`}>
          {RARITY[r]} <b>{ODDS[kind][r].toLocaleString('es-ES')} %</b>
        </span>
      ))}
    </span>
  )
}

// La carta que sacaste pagando y aún no has decidido si guardar (por ejemplo, si recargaste la página).
function Pending({ pending, busy, onDecide }) {
  return (
    <div className={`gacha-reveal gacha-reveal--${pending.card.rarity}`}>
      <span className="gacha-reveal__burst" aria-hidden="true" />
      <GachaCard card={pending.card} big />
      <div className="gacha-reveal__text">
        <span className="gacha-reveal__rarity">{RARITY[pending.card.rarity]}</span>
        <p>¿Te la quedas?</p>
        <div className="gacha-decide">
          <button type="button" className="hub-btn hub-btn--primary" disabled={busy} onClick={() => onDecide(true)}>
            Guardar
          </button>
          <button type="button" className="hub-btn" disabled={busy} onClick={() => onDecide(false)}>
            Descartar
          </button>
        </div>
        <small>Si la descartas, queda libre. Se vende por {eur(pending.card.price)}.</small>
        <GachaPowers powers={pending.card.powers} />
      </div>
    </div>
  )
}

// Nombre de una rareza en plural o singular: «2 legendarias», «1 común».
const WORDS = { unica: ['mítica', 'míticas'], mitica: ['legendaria', 'legendarias'], epica: ['épica', 'épicas'], rara: ['rara', 'raras'], comun: ['común', 'comunes'] }
const SHELF = { unica: 'Mítica', mitica: 'Legendarias', epica: 'Épicas', rara: 'Raras', comun: 'Comunes' }

// «2 legendarias, 3 épicas y 1 rara».
function summary(counts) {
  const parts = RARITIES.filter((r) => counts[r] > 0).map((r) => `${counts[r]} ${WORDS[r][counts[r] === 1 ? 0 : 1]}`)
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : (parts[0] ?? '')
}

// La biblioteca de alguien: un titular con lo que tiene y sus cartas en estantes por rareza.
function Library({ data, onSell, busy }) {
  const [confirm, setConfirm] = useState(null)
  const [copied, setCopied] = useState(false)
  if (!data) return <p className="gacha-empty">Cargando…</p>
  const { user, cards, worth } = data
  const counts = Object.fromEntries(RARITIES.map((r) => [r, cards.filter((c) => c.rarity === r).length]))
  const line = cards.length ? `${user.me ? 'Tengo' : 'Tiene'} ${summary(counts)}.` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Mi biblioteca del gacha de TopCode: ${summary(counts)} (${cards.length} ${cards.length === 1 ? 'carta' : 'cartas'}, valen ${eur(worth)}).`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="gacha-library" aria-labelledby="lib-title">
      <header className="gacha-lib-head">
        <Avatar name={user.name} src={user.avatar} size={56} />
        <div className="gacha-lib-head__text">
          <h2 id="lib-title">{user.me ? 'Mi biblioteca' : `Biblioteca de ${user.name}`}</h2>
          {line && <p className="gacha-lib-line">{line}</p>}
          <p className="gacha-lib-meta">
            {cards.length} {cards.length === 1 ? 'carta' : 'cartas'} · {cards.length === 1 ? 'vale' : 'valen'} {eur(worth)}
          </p>
        </div>
        {user.me && cards.length > 0 && (
          <button type="button" className="hub-btn hub-btn--ghost gacha-lib-copy" onClick={copy}>
            {copied ? 'Copiado' : 'Copiar resumen'}
          </button>
        )}
      </header>
      {cards.length === 0 ? (
        <p className="gacha-empty">{user.me ? 'Aún no tienes cartas: tira y reclama la que te guste.' : `${user.name} aún no tiene cartas.`}</p>
      ) : (
        RARITIES.filter((r) => counts[r] > 0).map((r) => (
          <section key={r} className={`gacha-shelf gacha-shelf--${r}`} aria-label={SHELF[r]}>
            <h3>
              {SHELF[r]} <small>{counts[r]}</small>
            </h3>
            <ul className="gacha-grid">
              {cards
                .filter((c) => c.rarity === r)
                .map((card) => (
                  <li key={card.id}>
                    <GachaCard card={card} />
                    <GachaPowers powers={card.powers} />
                    {user.me && (
                      <button
                        type="button"
                        className={`gacha-sell ${confirm === card.id ? 'is-confirm' : ''}`}
                        disabled={busy}
                        onBlur={() => setConfirm(null)}
                        onClick={() => {
                          if (confirm !== card.id) return setConfirm(card.id)
                          setConfirm(null)
                          onSell(card.id)
                        }}
                      >
                        {confirm === card.id ? `¿Vender por ${eur(card.price)}?` : `Vender · ${eur(card.price)}`}
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </section>
  )
}

// Todos los que tienen cartas, de la biblioteca que más vale a la que menos; cada uno abre su biblioteca.
function Collectors({ list, onOpen }) {
  if (!list) return <p className="gacha-empty">Cargando…</p>
  if (list.length === 0) return <p className="gacha-empty">Nadie tiene cartas todavía. ¡Sé el primero!</p>
  return (
    <ol className="gacha-rank" aria-label="Bibliotecas de todos">
      {list.map((p, i) => (
        <li key={p.id}>
          <button type="button" className={p.me ? 'is-me' : ''} onClick={() => onOpen(p.id)}>
            <b className="gacha-rank__pos">{i + 1}</b>
            <Avatar name={p.name} src={p.avatar} size={40} />
            <span className="gacha-rank__name">
              {p.name}
              <small>{p.rarities ? summary(p.rarities) : `${p.count} ${p.count === 1 ? 'carta' : 'cartas'}`}</small>
            </span>
            {p.best && (
              <span className="gacha-rank__best">
                <GachaCard card={p.best} mini />
              </span>
            )}
            <span className="gacha-rank__worth">{eur(p.worth)}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

// Todas las cartas que pueden salir: rareza, probabilidad de que te toque cada una, precio de venta y dueño.
function CardTable({ list, onOpen }) {
  const [rarity, setRarity] = useState('todas')
  const [owner, setOwner] = useState('todas')
  const [query, setQuery] = useState('')
  if (!list) return <p className="gacha-empty">Cargando…</p>
  const q = query.trim().toLowerCase()
  const byOwner = { todas: () => true, con: (c) => c.owner, libres: (c) => !c.owner, mias: (c) => c.owner?.me }
  const shown = list.filter(
    (c) =>
      (rarity === 'todas' || c.rarity === rarity) &&
      byOwner[owner](c) &&
      (!q || `${c.name} ${c.series} ${c.owner?.name ?? ''}`.toLowerCase().includes(q)),
  )
  const taken = list.filter((c) => c.owner).length
  return (
    <section className="gacha-cards" aria-labelledby="cards-title">
      <header className="gacha-cards__head">
        <h2 id="cards-title" className="hub-title">
          Cartas <small>{`${list.length} cartas · ${taken} con dueño · ${list.length - taken} libres`}</small>
        </h2>
        <div className="gacha-filters">
          <label className="gacha-select">
            <span>Buscar</span>
            <input type="search" value={query} placeholder="Nombre, origen o dueño" onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="gacha-select">
            <span>Rareza</span>
            <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
              <option value="todas">Todas</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {RARITY[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="gacha-select">
            <span>Dueño</span>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="con">Con dueño</option>
              <option value="libres">Libres</option>
              <option value="mias">Mías</option>
            </select>
          </label>
        </div>
      </header>
      <div className="gacha-table-wrap">
        <table className="gacha-table">
          <thead>
            <tr>
              <th scope="col">Carta y dueño</th>
              <th scope="col">Rareza</th>
              <th scope="col" className="is-num" title="Probabilidad de que te toque esta carta en una tirada normal">
                Prob. tirada
              </th>
              <th scope="col" className="is-num" title="Probabilidad de que te toque esta carta en una tirada premium">
                Prob. premium
              </th>
              <th scope="col" className="is-num">
                Venta
              </th>
              <th scope="col">Poderes</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className={c.owner?.me ? 'is-mine' : ''}>
                <td>
                  <span className="gacha-table__card">
                    <GachaCard card={c} mini />
                    <span>
                      <b>{c.name}</b>
                      {c.series && <small>{c.series}</small>}
                      {c.owner ? (
                        <span className="gacha-owner">
                          <Avatar name={c.owner.name} src={c.owner.avatar} size={18} />
                          {c.owner.me ? <b>Es tuya</b> : <>Es de <Who person={c.owner} onOpen={onOpen} /></>}
                        </span>
                      ) : c.fusion ? (
                        <span className="gacha-owner gacha-free">Solo por fusión: junta {c.fusion.join(' y ')}</span>
                      ) : (
                        <span className="gacha-owner gacha-free">Libre: puede tocarle a cualquiera</span>
                      )}
                      {c.fusesWith && <span className="gacha-owner gacha-fuse">Fusión: júntala con {c.fusesWith.with}</span>}
                    </span>
                  </span>
                </td>
                <td className={`gacha-roll__name--${c.rarity}`}>
                  <em>{RARITY[c.rarity]}</em>
                </td>
                <td className="is-num">{c.fusion ? '—' : pct(c.normal)}</td>
                <td className="is-num">{c.premium ? pct(c.premium) : '—'}</td>
                <td className="is-num">{eur(c.price)}</td>
                <td>
                  <GachaPowers powers={c.powers} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="gacha-empty">Ninguna carta con esos filtros.</p>}
      </div>
    </section>
  )
}

function Rules({ prices }) {
  return (
    <Help label="Cómo funciona" title="Cómo funciona el gacha" wide>
      <p>
        <b>La mesa:</b> cada hora sale sola una carta, hasta 5 a la vista de todos. Cualquiera puede <b>cogerla</b> gratis y
        se la queda el primero que pulse, <b>sin límite</b>: puedes coger todas las que quieras. Cada carta tiene un solo
        dueño.
      </p>
      <p>
        <b>Tirar pagando</b> con tu saldo de la semana: una tirada cuesta {eur(prices?.roll ?? 2000)} y una{' '}
        <b>premium</b>, {eur(prices?.premium ?? 20000)} (siempre épica o legendaria). Sale una carta sin dueño y decides si la{' '}
        <b>guardas</b> o la <b>descartas</b>; hasta decidirlo no puedes volver a tirar.
      </p>
      <p>
        <b>Cada carta tiene sus propios poderes</b>, uno para cada juego (míralos en «✦ Poderes en 6 juegos» de la
        carta): dos cartas de la misma rareza casi nunca tienen los mismos. Cuanto más rara, más fuerte, y cada uno tiene{' '}
        <b>★ su punto fuerte</b>: un juego en el que su poder es de la rareza siguiente. Se usan con el botón «✦ Poderes» de
        cada juego y <b>son de un solo uso</b>: al usar el poder de una carta, la gastas, sale de tu biblioteca y vuelve a
        quedar libre para que le toque a otro. Salvo las <b>míticas</b>: Macho Man dragón (un 0,1 % por tirada y un 0,5 % en las premium)
        y las de fusión. Tienen lo máximo en todos los juegos (Omnisciencia en el póker, el crupier comprado en
        el blackjack y un seguro total o un premio triple durante diez jugadas en los demás) y <b>no se gastan</b>: cada
        poder se recarga en un día.
      </p>
      <p>
        <b>Fusiones:</b> si juntas en tu biblioteca a <b>Vergil</b> (legendaria) y la <b>Silla de plástico</b> (común), al
        momento se convierten en la mítica <b>Vergil en la silla de plástico</b>; y a <b>Lady Dimitrescu</b> (rara) con la{' '}
        <b>Crema solar</b> (común), en la mítica <b>Lady Dimitrescu en bikini</b>. Las dos cartas vuelven a quedar libres.
        Las de fusión no salen nunca en la mesa ni en las tiradas: hay una de cada y solo se consiguen así.
      </p>
      <ul className="gacha-powers">
        <li>
          <b>Póker:</b> ver cartas de rivales (uno al azar, el que tiene más fichas o el que más apuesta; una carta o las dos)
          o adivinar la mesa (si la próxima carta es alta o baja, cuál es o todas las que faltan). Las legendarias, Rayos X:
          las de todos. Dura una mano.
        </li>
        <li>
          <b>Blackjack:</b> la próxima carta del mazo (una vez, siempre o solo si es alta o baja) y la carta tapada del
          crupier (o solo si es alta o baja). Dura una mano.
        </li>
        <li>
          <b>Ruleta, cohete, laberinto, Plinko, sobornos, rana y carrera:</b> un <b>seguro</b> (si pierdes, te devuelven una parte) o un{' '}
          <b>premio</b> (si ganas, cobras más), fuerte para una jugada o más flojo para varias: una común da entre un 25 % una
          vez y un 10 % tres veces; una épica, hasta un 100 %; una legendaria, el 100 % durante tres jugadas o más.
        </li>
      </ul>
      <p>En las mesas, los demás ven un aviso en el chat cuando usas un poder.</p>
      <p>
        Puedes <b>vender</b> cualquier carta tuya desde tu biblioteca: el dinero va a tu saldo de la semana (una común, unos
        700 €; una legendaria, unos 19.000 €) y la carta vuelve a poder salir. En «Bibliotecas» ves las cartas de todo el mundo y
        en «Cartas», todas las que pueden tocar y con qué probabilidad.
      </p>
      <table className="gacha-odds">
        <thead>
          <tr>
            <th>Rareza</th>
            <th>Mesa y tirada</th>
            <th>Premium</th>
          </tr>
        </thead>
        <tbody>
          {RARITIES.map((r) => (
            <tr key={r} className={`gacha-roll__name--${r}`}>
              <td>
                <em>{RARITY[r]}</em>
              </td>
              <td>{(ODDS.normal[r] ?? 0).toLocaleString('es-ES')} %</td>
              <td>{(ODDS.premium[r] ?? 0).toLocaleString('es-ES')} %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="gacha-note">
        Las cartas son personajes de juegos para adultos (Devil May Cry, Monster Hunter, The Witcher, Resident Evil…) y,
        en lo más alto, mods famosos y graciosos como Macho Man en Skyrim o Shrek en Elden Ring. La rareza sale de lo
        famoso que es cada uno. Tu biblioteca no se reinicia el domingo; tu saldo, sí.
      </p>
    </Help>
  )
}

const TABS = [
  ['tirar', 'Tirar'],
  ['coleccion', 'Mi biblioteca'],
  ['colecciones', 'Bibliotecas'],
  ['cartas', 'Cartas'],
]

export default function Gacha({ onExit, juegos, initialTab = 'tirar' }) {
  const { state, feed, offset, collection, setCollection, ranking, cards, load } = useGacha(juegos.request)
  const [tab, setTab] = useState(initialTab)
  const [busy, setBusy] = useState(false)
  const [summon, setSummon] = useState(null)
  const [feedOpen, setFeedOpen] = useState(false)
  const t = useServerNow(offset)
  const balance = juegos.me?.balance ?? 0

  async function act(a, extra) {
    setBusy(true)
    const body = await load(a, extra)
    setBusy(false)
    return body
  }

  async function roll(premium) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const started = Date.now()
    if (!reduced) {
      setSummon({ stage: 'charge' })
      playSpin(CHARGE_MS)
    }
    const body = await act('tirar', { pago: true, premium })
    const result = body?.gacha?.result
    if (!result) return setSummon(null)
    if (reduced) return setSummon({ stage: 'show', result })
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, CHARGE_MS - (Date.now() - started))))
    await reveal(result)
  }

  // Presagio, carga, estallido y la carta: lo que dura y lo que suena depende de la rareza.
  async function reveal(result) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setSummon({ stage: 'show', result })
    const rarity = result.card.rarity
    if (rarity === 'unica') {
      setSummon({ stage: 'omen', result })
      playGrowl()
      for (let k = 0; k < 4; k++) setTimeout(playHeartbeat, 300 + k * 650)
      setTimeout(playSiren, OMEN_MS - 700)
      await new Promise((resolve) => setTimeout(resolve, OMEN_MS))
    }
    if (BUILD_MS[rarity]) {
      setSummon({ stage: 'build', result })
      playSpin(BUILD_MS[rarity])
      await new Promise((resolve) => setTimeout(resolve, BUILD_MS[rarity]))
    }
    if (rarity === 'unica') {
      setSummon({ stage: 'blackout', result })
      await new Promise((resolve) => setTimeout(resolve, BLACKOUT_MS))
    }
    setSummon({ stage: 'burst', result })
    playZap()
    if (rarity === 'mitica' || rarity === 'unica') playBoom()
    if (rarity === 'unica') setTimeout(playBoom, 260)
    await new Promise((resolve) => setTimeout(resolve, BURST_MS[rarity]))
    setSummon({ stage: 'show', result })
    if (rarity === 'unica' || rarity === 'mitica' || rarity === 'epica') playWin(rarity !== 'epica')
    else playCard()
    if (rarity === 'unica') setTimeout(playOvation, 700)
  }

  async function decide(keep) {
    const body = await act('decidir', { keep })
    setSummon(null)
    await revealFusion(body)
  }

  async function take(id) {
    await revealFusion(await act('coger', { id }))
  }

  // Si con la carta que acabas de conseguir juntas una fusión, el servidor ya te la ha dado: se enseña como una mítica.
  async function revealFusion(body) {
    const fused = body?.gacha?.result?.fused
    if (fused) await reveal({ card: fused, fused: true })
  }

  function openCollection(user) {
    setCollection(null)
    setTab('coleccion')
    load('coleccion', user ? { user } : {})
  }

  function openTab(id) {
    if (id === 'coleccion') return openCollection()
    setTab(id)
    if (id === 'colecciones') load('ranking')
    if (id === 'cartas') load('cartas')
  }

  // Si se entra desde el escaparate con una pestaña concreta, se cargan sus datos.
  useEffect(() => {
    if (initialTab === 'coleccion') load('coleccion')
    if (initialTab === 'colecciones') load('ranking')
    if (initialTab === 'cartas') load('cartas')
  }, [initialTab, load])

  const prices = state?.prices
  const premiumPrice = prices?.premium ?? 20000
  const rollPrice = prices?.roll ?? 2000
  const table = state?.table ?? []

  return (
    <main className="app gacha-app">
      <header className="top">
        <h1>Gacha</h1>
        <div className="toggles">
          <button type="button" onClick={onExit}>
            Juegos
          </button>
          <Rules prices={prices} />
        </div>
      </header>

      <dl className="gacha-hud">
        <div>
          <dt>La mesa</dt>
          <dd>
            {state ? `${table.length}/${state.tableMax}` : '–'}
            {state && <small>{state.nextDropAt ? `otra carta en ${wait(state.nextDropAt - t)}` : 'llena: cógelas'}</small>}
          </dd>
        </div>
        <div>
          <dt>Biblioteca</dt>
          <dd>
            {state ? state.owned : '–'}
            <small>{state?.owned === 1 ? 'carta tuya' : 'cartas tuyas'}</small>
          </dd>
        </div>
        <div>
          <dt>Saldo de la semana</dt>
          <dd>
            {eur(balance)}
            <small>{balance >= premiumPrice ? 'te llega para una premium' : `la premium cuesta ${eur(premiumPrice)}`}</small>
          </dd>
        </div>
      </dl>

      <nav className="hub-segs gacha-tabs" aria-label="Secciones del gacha">
        {TABS.map(([id, name]) => (
          <button key={id} type="button" className="hub-seg" aria-pressed={tab === id} onClick={() => openTab(id)}>
            <span>{name}</span>
          </button>
        ))}
      </nav>

      {(juegos.error || !state) && (
        <p className="status gacha-status" role="status">
          {juegos.error || 'Conectando…'}
        </p>
      )}

      {tab === 'tirar' && (
        <>
          <div className="gacha-home">
            {/* Portal de invocación: los dos botones de tirar pagando, con lo que puede salir en cada uno. */}
            <section className="gacha-portal" aria-labelledby="roll-title">
              <span className="gacha-portal__ring" aria-hidden="true" />
              <span className="gacha-portal__fan" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <h2 id="roll-title" className="hub-title">
                Invocar <small>tú decides si te la quedas</small>
              </h2>
              {state?.pending && !summon ? (
                <Pending pending={state.pending} busy={busy} onDecide={decide} />
              ) : (
                <div className="gacha-portal__btns">
                  <button type="button" className="gacha-roll-btn" disabled={busy || !state || balance < rollPrice} onClick={() => roll(false)}>
                    <b>Tirar</b>
                    <small>{eur(rollPrice)} · cualquier rareza</small>
                    <Odds kind="normal" />
                  </button>
                  <button
                    type="button"
                    className="gacha-roll-btn gacha-roll-btn--premium"
                    disabled={busy || !state || balance < premiumPrice}
                    onClick={() => roll(true)}
                  >
                    <b>✦ Premium</b>
                    <small>{eur(premiumPrice)} · épica o mejor</small>
                    <Odds kind="premium" />
                  </button>
                </div>
              )}
            </section>

            <section className="gacha-mesa" aria-labelledby="mesa-title">
              <h2 id="mesa-title" className="hub-title">
                La mesa <small>gratis y sin límite · {state?.nextDropAt ? `otra carta en ${wait(state.nextDropAt - t)}` : 'llena'}</small>
              </h2>
              {/* key: con el imán del carrusel (móvil), al llegar una carta el navegador seguía enganchado al hueco que
                  ocupaba el primer puesto y la lista salía desplazada; con otra lista vuelve al principio. */}
              <ul className="gacha-mesa__cards" key={table.map((entry) => entry.id).join()}>
                {table.map((entry) => (
                  <li key={entry.id}>
                    <GachaCard card={entry.card} />
                    <button type="button" className="hub-btn hub-btn--primary" disabled={busy} onClick={() => take(entry.id)}>
                      Coger
                    </button>
                  </li>
                ))}
                {/* Huecos libres: el primero dice cuándo sale la siguiente. */}
                {range(Math.max(0, (state?.tableMax ?? 5) - table.length)).map((i) => (
                  <li key={`hueco-${i}`} className="gacha-mesa__slot" aria-hidden="true">
                    <span>{i === 0 && state?.nextDropAt ? `Sale en ${wait(state.nextDropAt - t)}` : 'Hueco libre'}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="gacha-feed" aria-labelledby="feed-title">
              <h2 id="feed-title" className="hub-title">
                Canal <small>lo último que ha pasado</small>
              </h2>
              {feed.length === 0 ? (
                <p className="gacha-empty">{state ? 'Todavía no ha pasado nada.' : 'Cargando…'}</p>
              ) : (
                <>
                  <ul className="gacha-rolls">
                    {(feedOpen ? feed : feed.slice(0, FEED_SHOWN)).map((move) => (
                      <Move key={move.id} move={move} t={t} onOpen={openCollection} />
                    ))}
                  </ul>
                  {feed.length > FEED_SHOWN && (
                    <button type="button" className="hub-btn gacha-feed__more" onClick={() => setFeedOpen((v) => !v)}>
                      {feedOpen ? 'Ver menos' : `Ver más (${feed.length - FEED_SHOWN})`}
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}

      {tab === 'coleccion' && (
        <Library data={collection} busy={busy} onSell={(card) => act('vender', { card }).then(() => load('coleccion'))} />
      )}
      {tab === 'colecciones' && <Collectors list={ranking} onOpen={openCollection} />}
      {tab === 'cartas' && <CardTable list={cards} onOpen={openCollection} />}

      {summon && <Summon summon={summon} busy={busy} onDecide={decide} onClose={() => setSummon(null)} />}

      <footer className="gacha-foot">Imágenes enlazadas desde Wikipedia, Wikimedia Commons y las noticias de cada mod; los personajes son de sus compañías y los mods, de sus autores. Solo para TopCode, sin fines comerciales.</footer>
    </main>
  )
}
