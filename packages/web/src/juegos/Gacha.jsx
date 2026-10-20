import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import GachaCard from './GachaCard.jsx'
import GachaPowers from './GachaPowers.jsx'
import Help from './Help.jsx'
import { eur } from './money.js'
import { playCard, playSpin, playWin, playZap } from './sound.js'
import { ODDS, RARITIES, RARITY, pct, useGacha, useServerNow, wait } from './gacha.js'
import './Gacha.css'

// Gacha de políticos españoles al estilo de Mudae (las reglas están en api/_juegos/gacha.mjs): tiradas que ve todo el
// mundo, el primero que reclama se queda la carta, vender cartas por saldo de la semana y ver la colección de cualquiera.

// Probabilidad de una carta concreta: «0,48 %», «0,0029 %».

// Barra que se vacía mientras quedan segundos para reclamar.
function Countdown({ until, t, total }) {
  const left = Math.max(0, until - t)
  return (
    <span className="gacha-timer" aria-hidden="true">
      <i style={{ transform: `scaleX(${Math.min(1, left / total)})` }} />
    </span>
  )
}

// Nombre de alguien que lleva a su colección.
function Who({ person, onOpen }) {
  return (
    <button type="button" className="gacha-who" onClick={() => onOpen(person.id)} title={`Ver la biblioteca de ${person.name}`}>
      {person.name}
    </button>
  )
}

// Una tirada del canal: la carta y qué ha pasado con ella.
function Roll({ roll, t, meId, claimReady, claimMs, busy, onClaim, onOpen }) {
  const open = roll.until > t
  const canClaim = open && !busy && claimReady
  const mine = roll.claimed?.id === meId
  let status = null
  if (roll.claimed) {
    status = mine ? (
      '¡Es tuya!'
    ) : (
      <>
        Se la quedó <Who person={roll.claimed} onOpen={onOpen} />
      </>
    )
  } else if (roll.owner) {
    status = roll.owner.me ? (
      'Ya era tuya'
    ) : (
      <>
        Ya es de <Who person={roll.owner} onOpen={onOpen} />
      </>
    )
  } else if (!open) status = 'Nadie la reclamó'
  return (
    <li className={`gacha-roll ${open ? 'is-open' : ''} ${mine ? 'is-mine' : ''}`}>
      <GachaCard card={roll.card} mini />
      <div className="gacha-roll__info">
        <span className={`gacha-roll__name gacha-roll__name--${roll.card.rarity}`}>
          <b>{roll.card.name}</b>
          <small>
            <em>{RARITY[roll.card.rarity]}</em>
            {roll.card.series ? ` · ${roll.card.series}` : ''}
          </small>
        </span>
        <span className="gacha-roll__by">
          <Avatar name={roll.by.name} src={roll.by.avatar} size={20} />
          {roll.by.me ? 'Tu tirada' : <Who person={roll.by} onOpen={onOpen} />}
          {roll.premium && <em className="gacha-pill">Premium</em>}
        </span>
        {open ? (
          <>
            <button
              type="button"
              className="hub-btn hub-btn--primary gacha-claim"
              disabled={!canClaim}
              title={!claimReady ? 'Tu reclamo aún se está recargando' : undefined}
              onClick={() => onClaim(roll.id)}
            >
              Reclamar · {wait(roll.until - t)}
            </button>
            <Countdown until={roll.until} t={t} total={claimMs} />
          </>
        ) : (
          <span className={`gacha-roll__status ${mine ? 'is-mine' : ''}`}>{status}</span>
        )}
      </div>
      <span className="gacha-roll__value">{eur(roll.card.price)}</span>
    </li>
  )
}

// La carta que acabas de sacar, en grande, con la entrada según su rareza.
const CHARGE_MS = 1300
const BURST_MS = 650
const SPARKS = 28

// La invocación: la carta llega boca abajo y se carga de energía, estalla con el color de su rareza y se da la vuelta.
// Las épicas y legendarias traen rayos y chispas; las legendarias, además, un destello dorado y un temblor.
// stage: charge (esperando al servidor) | burst | show.
function Summon({ summon, onClose }) {
  const { stage, result } = summon
  const rarity = result?.card.rarity ?? 'comun'
  const big = rarity === 'mitica' || rarity === 'epica'
  return (
    <div
      className={`gacha-summon is-${stage} gacha-summon--${stage === 'charge' ? 'unknown' : rarity}`}
      role="dialog"
      aria-modal="true"
      aria-label="Tirada del gacha"
      onClick={() => stage === 'show' && onClose()}
    >
      <span className="gacha-summon__rays" aria-hidden="true" />
      <span className="gacha-summon__flash" aria-hidden="true" />
      {big && stage !== 'charge' && (
        <span className="gacha-summon__sparks" aria-hidden="true">
          {Array.from({ length: SPARKS }, (_, i) => (
            <i key={i} style={{ '--a': `${(360 / SPARKS) * i}deg`, '--d': `${120 + ((i * 37) % 160)}px`, '--t': `${(i % 5) * 0.05}s` }} />
          ))}
        </span>
      )}
      <div className="gacha-summon__stage">
        {stage === 'show' ? (
          <>
            <span className="gacha-summon__title">{rarity === 'mitica' ? '¡LEGENDARIA!' : RARITY[rarity]}</span>
            <div className="gacha-summon__card">
              <GachaCard card={result.card} big />
            </div>
            <p className="gacha-summon__name">{result.card.name}</p>
            <button type="button" className="hub-btn hub-btn--primary" onClick={onClose} autoFocus>
              {result.claimed ? '¡A mi biblioteca!' : result.owned ? 'Vaya, ya tiene dueño' : '¡A reclamarla!'}
            </button>
          </>
        ) : (
          <div className="gacha-summon__card">
            <span className="gacha-summon__back" />
          </div>
        )}
      </div>
    </div>
  )
}

function Reveal({ last, roll, t, meId, claimReady, busy, onClaim }) {
  let text = 'Se te escapó.'
  if (roll?.claimed) text = roll.claimed.id === meId ? (last.claimed ? '¡Directa a tu biblioteca!' : '¡Es tuya!') : `Te la ha quitado ${roll.claimed.name}.`
  else if (last.owned) text = roll?.owner ? `Ya es de ${roll.owner.me ? 'ti' : roll.owner.name}.` : 'Ya tiene dueño.'
  else if (roll && roll.until > t) text = '¡Reclámala antes que nadie!'
  const open = roll && !roll.claimed && roll.until > t
  return (
    <div className={`gacha-reveal gacha-reveal--${last.card.rarity}`} key={last.id}>
      <span className="gacha-reveal__burst" aria-hidden="true" />
      <GachaCard card={last.card} big />
      <div className="gacha-reveal__text">
        <span className="gacha-reveal__rarity">{RARITY[last.card.rarity]}</span>
        <p aria-live="polite">{text}</p>
        {open && (
          <button type="button" className="hub-btn hub-btn--primary" disabled={busy || !claimReady} onClick={() => onClaim(last.id)}>
            Reclamar · {wait(roll.until - t)}
          </button>
        )}
        {open && !claimReady && <small>Tu reclamo aún se está recargando; puedes recargarlo ya desde la tienda.</small>}
        <small>Se vende por {eur(last.card.price)}.</small>
        <GachaPowers powers={last.card.powers} />
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
        Tienes <b>una tirada gratis cada 2 horas</b>. Lo que sale aparece en el <b>canal</b> y lo ve todo el mundo: durante 45 s
        cualquiera puede <b>reclamarlo</b>, y se lo queda el primero que pulse. Cada carta tiene un solo dueño.
      </p>
      <p>
        Solo puedes reclamar <b>una carta cada 2 horas</b>, así que elige bien.
      </p>
      <p>
        Todo va con tu <b>saldo de la semana</b>. La <b>tirada premium</b> cuesta {eur(prices?.premium ?? 20000)}: siempre es
        épica o legendaria, nunca sale una carta con dueño y va directa a tu biblioteca, sin gastar tu reclamo. Una tirada extra
        cuesta {eur(prices?.extraRoll ?? 1000)} y recargar el reclamo, {eur(prices?.claimReset ?? 5000)}.
      </p>
      <p>
        <b>Cada carta tiene un poder para cada juego</b> (míralos en «✦ Poderes en 6 juegos» de la carta), y cuanto más rara,
        más fuerte. Cada uno se usa una vez al día con el botón «✦ Poderes» de su juego:
      </p>
      <ul className="gacha-powers">
        <li>
          <b>Póker:</b> Vistazo (común: una carta de un rival), Doble vistazo (rara: una carta de dos rivales), Chivatazo
          (épica: las cartas de un rival) y Rayos X (legendaria: las de todos), durante una mano.
        </li>
        <li>
          <b>Blackjack:</b> Ojeada (común: la próxima carta del mazo), Mazo marcado (rara: siempre la próxima carta), Ojo del
          crupier (épica: su carta tapada) y los dos últimos a la vez (legendaria), durante una mano.
        </li>
        <li>
          <b>Ruleta, cohete, tragamonedas y Plinko:</b> un <b>seguro</b> (si pierdes, te devuelven una parte) o un{' '}
          <b>premio</b> (si ganas, cobras más) según la carta: 25 % con una común, 50 % con una rara, 100 % con una épica y
          100 % durante tres jugadas con una legendaria.
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
            <th>Tirada normal</th>
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
  const [last, setLast] = useState(null)
  const [summon, setSummon] = useState(null)
  const t = useServerNow(offset)
  const balance = juegos.me?.balance ?? 0
  const meId = juegos.me?.id

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
    const body = await act('tirar', { premium })
    const result = body?.gacha?.result
    if (!result) return setSummon(null)
    setLast(result)
    if (reduced) return setSummon({ stage: 'show', result })
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, CHARGE_MS - (Date.now() - started))))
    setSummon({ stage: 'burst', result })
    playZap()
    await new Promise((resolve) => setTimeout(resolve, BURST_MS))
    setSummon({ stage: 'show', result })
    const rarity = result.card.rarity
    if (rarity === 'mitica' || rarity === 'epica') playWin(rarity === 'mitica')
    else playCard()
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

  const rolls = state?.rolls
  const claimReady = state ? state.claimAt === 0 || state.claimAt <= t : false
  const lastRoll = last && feed.find((r) => r.id === last.id)
  const prices = state?.prices
  const premiumPrice = prices?.premium ?? 20000
  const openCount = feed.filter((r) => r.until > t).length

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
          <dt>Tiradas</dt>
          <dd>
            {rolls ? `${rolls.left}/${rolls.max}` : '–'}
            {rolls && <small>{rolls.left < rolls.max ? `se recargan en ${wait(rolls.resetAt - t)}` : 'una gratis cada 2 h'}</small>}
          </dd>
        </div>
        <div className={claimReady ? 'is-ready' : ''}>
          <dt>Reclamo</dt>
          <dd>
            {state ? (claimReady ? 'Listo' : wait(state.claimAt - t)) : '–'}
            <small>{claimReady ? 'puedes quedarte una carta' : 'uno cada 2 h'}</small>
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
        <div className="gacha-play">
          <section className="gacha-panel" aria-labelledby="roll-title">
            <h2 id="roll-title" className="hub-title">
              Tirar <small>todos lo verán durante 45 s</small>
            </h2>
            <button type="button" className="gacha-roll-btn" disabled={busy || !rolls || rolls.left <= 0} onClick={() => roll(false)}>
              <b>{rolls && rolls.left <= 0 ? 'Sin tiradas' : 'Tirar'}</b>
              <small>{rolls && rolls.left <= 0 ? `Vuelven en ${wait(rolls.resetAt - t)}` : `${rolls?.left ?? 0} gratis · una cada 2 h`}</small>
            </button>
            <div className="gacha-actions">
              <button
                type="button"
                className="hub-btn gacha-premium"
                disabled={busy || !state || balance < premiumPrice}
                title="Épica o legendaria, sin dueño, directa a tu biblioteca"
                onClick={() => roll(true)}
              >
                ✦ Premium · {eur(premiumPrice)}
              </button>
              <button
                type="button"
                className="hub-btn hub-btn--ghost"
                disabled={busy || !prices || balance < prices.extraRoll}
                onClick={() => act('tienda', { item: 'tirada' })}
              >
                +1 tirada · {eur(prices?.extraRoll ?? 1000)}
              </button>
              <button
                type="button"
                className="hub-btn hub-btn--ghost"
                disabled={busy || !prices || claimReady || balance < prices.claimReset}
                title="Recarga tu reclamo para poder quedarte otra carta ahora"
                onClick={() => act('tienda', { item: 'reclamo' })}
              >
                Reclamo ya · {eur(prices?.claimReset ?? 5000)}
              </button>
            </div>
            {last ? (
              <Reveal last={last} roll={lastRoll} t={t} meId={meId} claimReady={claimReady} busy={busy} onClaim={(id) => act('reclamar', { id })} />
            ) : (
              <div className="gacha-placeholder" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            )}
          </section>

          <section className="gacha-feed" aria-labelledby="feed-title">
            <h2 id="feed-title" className="hub-title">
              Canal
              <small>{openCount > 0 ? `${openCount} por reclamar ahora mismo` : 'las últimas tiradas de todos'}</small>
            </h2>
            {feed.length === 0 ? (
              <p className="gacha-empty">{state ? 'Todavía no ha tirado nadie. ¡Estrénalo!' : 'Cargando…'}</p>
            ) : (
              <ul className="gacha-rolls">
                {feed.map((r) => (
                  <Roll
                    key={r.id}
                    roll={r}
                    t={t}
                    meId={meId}
                    claimReady={claimReady}
                    claimMs={state?.claimMs ?? 45000}
                    busy={busy}
                    onClaim={(id) => act('reclamar', { id })}
                    onOpen={openCollection}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'coleccion' && (
        <Library data={collection} busy={busy} onSell={(card) => act('vender', { card }).then(() => load('coleccion'))} />
      )}
      {tab === 'colecciones' && <Collectors list={ranking} onOpen={openCollection} />}
      {tab === 'cartas' && <CardTable list={cards} onOpen={openCollection} />}

      {summon && <Summon summon={summon} onClose={() => setSummon(null)} />}

      <footer className="gacha-foot">Fotos de Wikimedia Commons y datos de Wikipedia. Solo para TopCode, sin fines comerciales.</footer>
    </main>
  )
}
