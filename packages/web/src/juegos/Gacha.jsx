import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import GachaCard from './GachaCard.jsx'
import Help from './Help.jsx'
import { eur } from './money.js'
import { ODDS, RARITIES, RARITY, useGacha, useServerNow, wait } from './gacha.js'
import './Gacha.css'

// Gacha de políticos españoles al estilo de Mudae (las reglas están en api/_juegos/gacha.mjs): tiradas que ve todo el
// mundo, el primero que reclama se queda la carta, vender cartas por saldo de la semana y ver la colección de cualquiera.

// Probabilidad de una carta concreta: «0,48 %», «0,0029 %».
const pct = (n) => `${n.toLocaleString('es-ES', { maximumSignificantDigits: 2 })} %`

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
    <button type="button" className="gacha-who" onClick={() => onOpen(person.id)} title={`Ver la colección de ${person.name}`}>
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
function Reveal({ last, roll, t, meId, claimReady, busy, onClaim }) {
  let text = 'Se te escapó.'
  if (roll?.claimed) text = roll.claimed.id === meId ? (last.claimed ? '¡Directa a tu colección!' : '¡Es tuya!') : `Te la ha quitado ${roll.claimed.name}.`
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
      </div>
    </div>
  )
}

function Collection({ data, onSell, busy }) {
  const [confirm, setConfirm] = useState(null)
  const [rarity, setRarity] = useState('todas')
  if (!data) return <p className="gacha-empty">Cargando…</p>
  const { user, cards, worth } = data
  const count = (r) => cards.filter((c) => c.rarity === r).length
  const shown = cards.filter((c) => rarity === 'todas' || c.rarity === rarity)
  return (
    <section className="gacha-collection" aria-labelledby="col-title">
      <header className="gacha-col-head">
        <Avatar name={user.name} src={user.avatar} size={44} />
        <div>
          <h2 id="col-title">{user.me ? 'Tu colección' : `Colección de ${user.name}`}</h2>
          <p>
            {cards.length} {cards.length === 1 ? 'carta' : 'cartas'} · se {cards.length === 1 ? 'vende' : 'venden'} por {eur(worth)}
          </p>
        </div>
        <ul className="gacha-col-counts" aria-label="Cartas por rareza">
          {RARITIES.map((r) => (
            <li key={r} className={`gacha-roll__name--${r}`}>
              <em>{count(r)}</em> {RARITY[r]}
            </li>
          ))}
        </ul>
      </header>
      {cards.length > 0 && (
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
      )}
      {cards.length === 0 ? (
        <p className="gacha-empty">{user.me ? 'Aún no tienes cartas: tira y reclama la que te guste.' : `${user.name} aún no tiene cartas.`}</p>
      ) : shown.length === 0 ? (
        <p className="gacha-empty">Ninguna carta de esa rareza.</p>
      ) : (
        <ul className="gacha-grid">
          {shown.map((card) => (
            <li key={card.id}>
              <GachaCard card={card} />
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
      )}
    </section>
  )
}

// Todos los que tienen cartas, de la colección que más vale a la que menos; cada uno abre su colección.
function Collectors({ list, onOpen }) {
  if (!list) return <p className="gacha-empty">Cargando…</p>
  if (list.length === 0) return <p className="gacha-empty">Nadie tiene cartas todavía. ¡Sé el primero!</p>
  return (
    <ol className="gacha-rank" aria-label="Colecciones de todos">
      {list.map((p, i) => (
        <li key={p.id}>
          <button type="button" className={p.me ? 'is-me' : ''} onClick={() => onOpen(p.id)}>
            <b className="gacha-rank__pos">{i + 1}</b>
            <Avatar name={p.name} src={p.avatar} size={40} />
            <span className="gacha-rank__name">
              {p.name}
              <small>
                {p.count} {p.count === 1 ? 'carta' : 'cartas'}
                {p.best ? ` · la mejor: ${p.best.name}` : ''}
              </small>
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
  const [query, setQuery] = useState('')
  if (!list) return <p className="gacha-empty">Cargando…</p>
  const q = query.trim().toLowerCase()
  const shown = list.filter((c) => (rarity === 'todas' || c.rarity === rarity) && (!q || `${c.name} ${c.series}`.toLowerCase().includes(q)))
  const free = list.filter((c) => !c.owner).length
  return (
    <section className="gacha-cards" aria-labelledby="cards-title">
      <header className="gacha-cards__head">
        <h2 id="cards-title" className="hub-title">
          Cartas <small>{`${list.length} políticos · ${free} sin dueño`}</small>
        </h2>
        <div className="gacha-filters">
          <label className="gacha-select">
            <span>Buscar</span>
            <input type="search" value={query} placeholder="Nombre o partido" onChange={(e) => setQuery(e.target.value)} />
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
        </div>
      </header>
      <div className="gacha-table-wrap">
        <table className="gacha-table">
          <thead>
            <tr>
              <th scope="col">Carta</th>
              <th scope="col">Rareza</th>
              <th scope="col" className="is-num" title="Probabilidad de que te toque esta carta en una tirada normal">
                Tirada
              </th>
              <th scope="col" className="is-num" title="Probabilidad de que te toque esta carta en una tirada premium">
                Premium
              </th>
              <th scope="col" className="is-num">
                Venta
              </th>
              <th scope="col">Dueño</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className="gacha-table__card">
                    <GachaCard card={c} mini />
                    <span>
                      <b>{c.name}</b>
                      {c.series && <small>{c.series}</small>}
                    </span>
                  </span>
                </td>
                <td className={`gacha-roll__name--${c.rarity}`}>
                  <em>{RARITY[c.rarity]}</em>
                </td>
                <td className="is-num">{pct(c.normal)}</td>
                <td className="is-num">{c.premium ? pct(c.premium) : '—'}</td>
                <td className="is-num">{eur(c.price)}</td>
                <td>{c.owner ? <Who person={c.owner} onOpen={onOpen} /> : <span className="gacha-free">Libre</span>}</td>
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
        Cada hora tienes <b>8 tiradas gratis</b>. Lo que sale aparece en el <b>canal</b> y lo ve todo el mundo: durante 45 s
        cualquiera puede <b>reclamarlo</b>, y se lo queda el primero que pulse. Cada carta tiene un solo dueño.
      </p>
      <p>
        Solo puedes reclamar <b>una carta cada 3 horas</b>, así que elige bien.
      </p>
      <p>
        Todo va con tu <b>saldo de la semana</b>. La <b>tirada premium</b> cuesta {eur(prices?.premium ?? 20000)}: siempre es
        épica o mítica, nunca sale una carta con dueño y va directa a tu colección, sin gastar tu reclamo. Una tirada extra
        cuesta {eur(prices?.extraRoll ?? 1000)} y recargar el reclamo, {eur(prices?.claimReset ?? 5000)}.
      </p>
      <p>
        Puedes <b>vender</b> cualquier carta tuya desde tu colección: el dinero va a tu saldo de la semana (una común, unos
        700 €; una mítica, unos 19.000 €) y la carta vuelve a poder salir. En «Colecciones» ves las cartas de todo el mundo y
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
        Wikipedias tiene artículo). Tu colección no se reinicia el domingo; tu saldo, sí.
      </p>
    </Help>
  )
}

const TABS = [
  ['tirar', 'Tirar'],
  ['coleccion', 'Mi colección'],
  ['colecciones', 'Colecciones'],
  ['cartas', 'Cartas'],
]

export default function Gacha({ onExit, juegos, initialTab = 'tirar' }) {
  const { state, feed, offset, collection, setCollection, ranking, cards, load } = useGacha(juegos.request)
  const [tab, setTab] = useState(initialTab)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
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
    const body = await act('tirar', { premium })
    if (body?.gacha?.result) setLast(body.gacha.result)
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
            {rolls && <small>{rolls.left < rolls.max ? `se recargan en ${wait(rolls.resetAt - t)}` : 'se recargan cada hora'}</small>}
          </dd>
        </div>
        <div className={claimReady ? 'is-ready' : ''}>
          <dt>Reclamo</dt>
          <dd>
            {state ? (claimReady ? 'Listo' : wait(state.claimAt - t)) : '–'}
            <small>{claimReady ? 'puedes quedarte una carta' : 'uno cada 3 h'}</small>
          </dd>
        </div>
        <div>
          <dt>Colección</dt>
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
              <small>{rolls && rolls.left <= 0 ? `Vuelven en ${wait(rolls.resetAt - t)}` : `${rolls?.left ?? 0} gratis esta hora`}</small>
            </button>
            <div className="gacha-actions">
              <button
                type="button"
                className="hub-btn gacha-premium"
                disabled={busy || !state || balance < premiumPrice}
                title="Épica o mítica, sin dueño, directa a tu colección"
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
        <Collection data={collection} busy={busy} onSell={(card) => act('vender', { card }).then(() => load('coleccion'))} />
      )}
      {tab === 'colecciones' && <Collectors list={ranking} onOpen={openCollection} />}
      {tab === 'cartas' && <CardTable list={cards} onOpen={openCollection} />}

      <footer className="gacha-foot">Fotos de Wikimedia Commons y datos de Wikipedia. Solo para TopCode, sin fines comerciales.</footer>
    </main>
  )
}
