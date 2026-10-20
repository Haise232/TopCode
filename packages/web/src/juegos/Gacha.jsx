import { useEffect, useState } from 'react'
import Avatar from './Avatar.jsx'
import GachaCard from './GachaCard.jsx'
import Help from './Help.jsx'
import { eur } from './money.js'
import { CATS, CAT_NAME, ODDS, RARITIES, RARITY, useGacha, useServerNow, wait } from './gacha.js'
import './Gacha.css'

// Gacha al estilo de Mudae (las reglas están en api/_juegos/gacha.mjs): tiradas que ve todo el mundo, el primero que
// reclama se queda la carta, colección y ranking.

// Barra que se vacía mientras quedan segundos para reclamar.
function Countdown({ until, t, total }) {
  const left = Math.max(0, until - t)
  return (
    <span className="gacha-timer" aria-hidden="true">
      <i style={{ transform: `scaleX(${Math.min(1, left / total)})` }} />
    </span>
  )
}

// Una tirada del canal: la carta y qué ha pasado con ella.
function Roll({ roll, t, meId, claimReady, claimMs, busy, onClaim }) {
  const open = roll.until > t
  const canClaim = open && !busy && claimReady
  let status
  if (roll.claimed) status = roll.claimed.id === meId ? '¡Es tuya!' : `Se la quedó ${roll.claimed.name}`
  else if (roll.owner) status = roll.owner.me ? 'Ya era tuya' : `Ya es de ${roll.owner.name}`
  else if (!open) status = 'Nadie la reclamó'
  const mine = roll.claimed?.id === meId
  return (
    <li className={`gacha-roll ${open ? 'is-open' : ''} ${mine ? 'is-mine' : ''}`}>
      <GachaCard card={roll.card} mini />
      <div className="gacha-roll__info">
        <span className={`gacha-roll__name gacha-roll__name--${roll.card.rarity}`}>
          <b>{roll.card.name}</b>
          <small>
            <em>{RARITY[roll.card.rarity]}</em> · {CAT_NAME[roll.card.cat]}
            {roll.card.series ? ` · ${roll.card.series}` : ''}
          </small>
        </span>
        <span className="gacha-roll__by">
          <Avatar name={roll.by.name} src={roll.by.avatar} size={20} />
          {roll.by.me ? 'Tu tirada' : roll.by.name}
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
      <span className="gacha-kakera gacha-roll__value">{roll.card.value}</span>
    </li>
  )
}

// La carta que acabas de sacar, en grande, con la entrada según su rareza.
function Reveal({ last, roll, t, meId, claimReady, busy, onClaim }) {
  let text = 'Se te escapó.'
  if (roll?.claimed) text = roll.claimed.id === meId ? (last.claimed ? '¡Directa a tu colección!' : '¡Es tuya!') : `Te la ha quitado ${roll.claimed.name}.`
  else if (last.owned) text = `Ya tiene dueño: te llevas ${last.kakera} de kakera.`
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
        {open && !claimReady && <small>Tu reclamo aún se está recargando; puedes recargarlo con kakera.</small>}
        <a href={last.card.src} target="_blank" rel="noreferrer">
          Ver en la fuente ↗
        </a>
      </div>
    </div>
  )
}

function Collection({ data, onRelease, busy }) {
  const [confirm, setConfirm] = useState(null)
  const [cat, setCat] = useState('todas')
  const [rarity, setRarity] = useState('todas')
  if (!data) return <p className="gacha-empty">Cargando…</p>
  const { user, cards, value } = data
  const count = (r) => cards.filter((c) => c.rarity === r).length
  const shown = cards.filter((c) => (cat === 'todas' || c.cat === cat) && (rarity === 'todas' || c.rarity === rarity))
  return (
    <section className="gacha-collection" aria-labelledby="col-title">
      <header className="gacha-col-head">
        <Avatar name={user.name} src={user.avatar} size={44} />
        <div>
          <h2 id="col-title">{user.me ? 'Tu colección' : `Colección de ${user.name}`}</h2>
          <p>
            {cards.length} {cards.length === 1 ? 'carta' : 'cartas'} · valor <span className="gacha-kakera">{value}</span>
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
        <div className="gacha-filters">
          <div className="hub-segs" role="group" aria-label="Categoría">
            {[{ id: 'todas', name: 'Todas' }, ...CATS.filter((c) => c.id !== 'mixto')].map((c) => (
              <button key={c.id} type="button" className="hub-seg" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
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
      )}
      {cards.length === 0 ? (
        <p className="gacha-empty">{user.me ? 'Aún no tienes cartas: tira y reclama la que te guste.' : 'Aún no tiene cartas.'}</p>
      ) : shown.length === 0 ? (
        <p className="gacha-empty">Ninguna carta con esos filtros.</p>
      ) : (
        <ul className="gacha-grid">
          {shown.map((card) => (
            <li key={card.id}>
              <GachaCard card={card} />
              {user.me && (
                <button
                  type="button"
                  className={`gacha-release ${confirm === card.id ? 'is-confirm' : ''}`}
                  disabled={busy}
                  onBlur={() => setConfirm(null)}
                  onClick={() => {
                    if (confirm !== card.id) return setConfirm(card.id)
                    setConfirm(null)
                    onRelease(card.id)
                  }}
                >
                  {confirm === card.id ? `¿Seguro? +${card.value} kakera` : 'Liberar'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Ranking({ list, onOpen }) {
  if (!list) return <p className="gacha-empty">Cargando…</p>
  if (list.length === 0) return <p className="gacha-empty">Nadie tiene cartas todavía. ¡Sé el primero!</p>
  return (
    <ol className="gacha-rank">
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
            <span className="gacha-kakera">{p.value}</span>
          </button>
        </li>
      ))}
    </ol>
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
        Solo puedes reclamar <b>una carta cada 3 horas</b>, así que elige bien. Si sale una carta que ya tiene dueño, quien
        tiró se lleva la mitad de su valor en <b>kakera</b>.
      </p>
      <p>
        La <b>tirada premium</b> cuesta {eur(prices?.premium ?? 20000)} de tu saldo de la semana: siempre es épica o mítica,
        nunca sale una carta con dueño y va directa a tu colección, sin gastar tu reclamo.
      </p>
      <p>
        Con <b>kakera</b> compras una tirada extra ({prices?.extraRoll ?? 150}) o recargas tu reclamo ({prices?.claimReset ?? 600}).
        La consigues sacando cartas con dueño y liberando las tuyas, que te devuelven su valor.
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
        La rareza sale de lo popular que es cada personaje: los favoritos de AniList y, en cine y política, en cuántas
        Wikipedias aparece. Tu colección no se reinicia el domingo.
      </p>
    </Help>
  )
}

export default function Gacha({ onExit, juegos, initialTab = 'tirar' }) {
  const { state, feed, offset, collection, setCollection, ranking, load } = useGacha(juegos.request)
  const [tab, setTab] = useState(initialTab)
  const [cat, setCat] = useState('mixto')
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
    const body = await act('tirar', { cat, premium })
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
    if (id === 'ranking') load('ranking')
  }

  // Si se entra desde el escaparate con «Mi colección» o «Ranking», se cargan sus datos.
  useEffect(() => {
    if (initialTab === 'coleccion') load('coleccion')
    if (initialTab === 'ranking') load('ranking')
  }, [initialTab, load])

  const rolls = state?.rolls
  const claimReady = state ? state.claimAt === 0 || state.claimAt <= t : false
  const lastRoll = last && feed.find((r) => r.id === last.id)
  const premiumPrice = state?.prices.premium ?? 20000
  const openCount = feed.filter((r) => r.until > t).length

  return (
    <main className="app gacha-app">
      <header className="top">
        <h1>Gacha</h1>
        <div className="toggles">
          <button type="button" onClick={onExit}>
            Juegos
          </button>
          <Rules prices={state?.prices} />
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
          <dt>Kakera</dt>
          <dd>
            <span className="gacha-kakera">{state?.kakera ?? 0}</span>
            <small>{state ? `${state.owned} ${state.owned === 1 ? 'carta' : 'cartas'} en tu colección` : ''}</small>
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
        {[
          ['tirar', 'Tirar'],
          ['coleccion', 'Mi colección'],
          ['ranking', 'Ranking'],
        ].map(([id, name]) => (
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
            <div className="hub-segs gacha-cats" role="group" aria-label="Categoría">
              {CATS.map((c) => (
                <button key={c.id} type="button" className="hub-seg" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
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
                disabled={busy || !state || state.kakera < state.prices.extraRoll}
                onClick={() => act('tienda', { item: 'tirada' })}
              >
                +1 tirada · <span className="gacha-kakera">{state?.prices.extraRoll ?? 150}</span>
              </button>
              <button
                type="button"
                className="hub-btn hub-btn--ghost"
                disabled={busy || !state || claimReady || state.kakera < state.prices.claimReset}
                title="Recarga tu reclamo para poder quedarte otra carta ahora"
                onClick={() => act('tienda', { item: 'reclamo' })}
              >
                Reclamo ya · <span className="gacha-kakera">{state?.prices.claimReset ?? 600}</span>
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
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'coleccion' && (
        <Collection data={collection} busy={busy} onRelease={(card) => act('liberar', { card }).then(() => load('coleccion'))} />
      )}
      {tab === 'ranking' && <Ranking list={ranking} onOpen={openCollection} />}

      <footer className="gacha-foot">
        Datos e imágenes de AniList, Wikipedia y Wikimedia Commons. Solo para TopCode, sin fines comerciales.
      </footer>
    </main>
  )
}
