import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import GachaCard from './GachaCard.jsx'
import GachaPowers from './GachaPowers.jsx'
import Help from './Help.jsx'
import { eur } from './money.js'
import { playBoom, playCard, playSpin, playWin, playZap } from './sound.js'
import { ODDS, RARITIES, RARITY, pct, useGacha, useServerNow, wait } from './gacha.js'
import './Gacha.css'

// Gacha de políticos españoles al estilo de Mudae (las reglas están en api/_juegos/gacha.mjs): tiradas que ve todo el
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
const BUILD_MS = { comun: 0, rara: 600, epica: 1600, mitica: 3400 }
const BURST_MS = { comun: 650, rara: 750, epica: 950, mitica: 1300 }
const SPARKS = { rara: 12, epica: 32, mitica: 64 }
const WAVES = { rara: 1, epica: 2, mitica: 3 }
const IMPLODE = 26
const BOLTS = 7
const CONFETTI = 46
const range = (n) => Array.from({ length: n }, (_, i) => i)

// La invocación: la carta llega boca abajo y se carga de energía (charge, esperando al servidor). Si es rara o mejor,
// se va tiñendo del color de su rareza (build): las épicas vibran y absorben partículas; las legendarias pasan por
// todos los colores hasta el dorado, les caen rayos y se agrietan. Luego estalla con ondas expansivas (burst) y se da
// la vuelta (show); la legendaria, con explosión dorada, temblor, «¡LEGENDARIA!» letra a letra y lluvia de confeti.
function Summon({ summon, busy, onDecide }) {
  const { stage, result } = summon
  const rarity = result?.card.rarity ?? 'comun'
  const legend = rarity === 'mitica'
  const sparks = SPARKS[rarity] ?? 0
  const waves = WAVES[rarity] ?? 0
  const title = legend ? '¡LEGENDARIA!' : RARITY[rarity]
  return (
    <div
      className={`gacha-summon is-${stage} gacha-summon--${stage === 'charge' ? 'unknown' : rarity}`}
      role="dialog"
      aria-modal="true"
      aria-label="Tirada del gacha"
    >
      <span className="gacha-summon__rays" aria-hidden="true" />
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
      <div className="gacha-summon__stage">
        {stage === 'show' ? (
          <>
            <span className={`gacha-summon__title ${legend ? 'gacha-summon__title--legend' : ''}`} aria-label={title}>
              {legend
                ? [...title].map((ch, i) => (
                    <span key={i} style={{ '--t': `${0.5 + i * 0.07}s` }} aria-hidden="true">
                      {ch}
                    </span>
                  ))
                : title}
            </span>
            <div className="gacha-summon__card">
              {legend && <span className="gacha-summon__aura" aria-hidden="true" />}
              <GachaCard card={result.card} big />
            </div>
            <p className="gacha-summon__name">{result.card.name}</p>
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
const WORDS = { mitica: ['legendaria', 'legendarias'], epica: ['épica', 'épicas'], rara: ['rara', 'raras'], comun: ['común', 'comunes'] }
const SHELF = { mitica: 'Legendarias', epica: 'Épicas', rara: 'Raras', comun: 'Comunes' }

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
          Cartas <small>{`${list.length} políticos · ${taken} con dueño · ${list.length - taken} libres`}</small>
        </h2>
        <div className="gacha-filters">
          <label className="gacha-select">
            <span>Buscar</span>
            <input type="search" value={query} placeholder="Nombre, partido o dueño" onChange={(e) => setQuery(e.target.value)} />
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
                      ) : (
                        <span className="gacha-owner gacha-free">Libre: puede tocarle a cualquiera</span>
                      )}
                    </span>
                  </span>
                </td>
                <td className={`gacha-roll__name--${c.rarity}`}>
                  <em>{RARITY[c.rarity]}</em>
                </td>
                <td className="is-num">{pct(c.normal)}</td>
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
        <b>Cada político tiene sus propios poderes</b>, uno para cada juego (míralos en «✦ Poderes en 6 juegos» de la
        carta): dos cartas de la misma rareza casi nunca tienen los mismos. Cuanto más rara, más fuerte, y cada uno tiene{' '}
        <b>★ su punto fuerte</b>: un juego en el que su poder es de la rareza siguiente. Se usan con el botón «✦ Poderes» de
        cada juego y <b>son de un solo uso</b>: al usar el poder de una carta, la gastas, sale de tu biblioteca y vuelve a
        quedar libre para que le toque a otro.
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
          <b>Ruleta, cohete, tragamonedas y Plinko:</b> un <b>seguro</b> (si pierdes, te devuelven una parte) o un{' '}
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
              <td>{ODDS.normal[r] ?? 0} %</td>
              <td>{ODDS.premium[r] ?? 0} %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="gacha-note">
        Las cartas son políticos españoles de la democracia. La rareza sale de lo conocido que es cada uno (en cuántas
        Wikipedias tiene artículo). Tu biblioteca no se reinicia el domingo; tu saldo, sí.
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
    const rarity = result.card.rarity
    if (BUILD_MS[rarity]) {
      setSummon({ stage: 'build', result })
      playSpin(BUILD_MS[rarity])
      await new Promise((resolve) => setTimeout(resolve, BUILD_MS[rarity]))
    }
    setSummon({ stage: 'burst', result })
    playZap()
    if (rarity === 'mitica') playBoom()
    await new Promise((resolve) => setTimeout(resolve, BURST_MS[rarity]))
    setSummon({ stage: 'show', result })
    if (rarity === 'mitica' || rarity === 'epica') playWin(rarity === 'mitica')
    else playCard()
  }

  async function decide(keep) {
    await act('decidir', { keep })
    setSummon(null)
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
          <section className="gacha-mesa" aria-labelledby="mesa-title">
            <h2 id="mesa-title" className="hub-title">
              La mesa{' '}
              <small>
                {state?.nextDropAt ? `sale otra carta en ${wait(state.nextDropAt - t)}` : 'llena: hasta 5 cartas'} · gratis y sin
                límite
              </small>
            </h2>
            {table.length === 0 ? (
              <p className="gacha-empty">{state ? 'La mesa está vacía: en un rato saldrá una carta.' : 'Cargando…'}</p>
            ) : (
              <ul className="gacha-mesa__cards">
                {table.map((entry) => (
                  <li key={entry.id}>
                    <GachaCard card={entry.card} />
                    <button
                      type="button"
                      className="hub-btn hub-btn--primary"
                      disabled={busy}
                      onClick={() => act('coger', { id: entry.id })}
                    >
                      Coger
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="gacha-play">
            <section className="gacha-panel" aria-labelledby="roll-title">
              <h2 id="roll-title" className="hub-title">
                Tirar pagando <small>tú decides si te la quedas</small>
              </h2>
              {state?.pending && !summon ? (
                <Pending pending={state.pending} busy={busy} onDecide={decide} />
              ) : (
                <>
                  <button type="button" className="gacha-roll-btn" disabled={busy || !state || balance < rollPrice} onClick={() => roll(false)}>
                    <b>Tirar</b>
                    <small>{eur(rollPrice)} · cualquier rareza</small>
                  </button>
                  <div className="gacha-actions">
                    <button
                      type="button"
                      className="hub-btn gacha-premium"
                      disabled={busy || !state || balance < premiumPrice}
                      title="Siempre épica o legendaria"
                      onClick={() => roll(true)}
                    >
                      ✦ Premium · {eur(premiumPrice)}
                    </button>
                  </div>
                  <div className="gacha-placeholder" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </>
              )}
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

      {summon && <Summon summon={summon} busy={busy} onDecide={decide} />}

      <footer className="gacha-foot">Fotos de Wikimedia Commons y datos de Wikipedia. Solo para TopCode, sin fines comerciales.</footer>
    </main>
  )
}
