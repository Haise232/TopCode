import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar.jsx'
import { eur } from './money.js'
import './Gacha.css'

// Gacha al estilo de Mudae (las reglas están en api/_juegos/gacha.mjs): tiradas que ve todo el mundo, el primero que
// reclama se queda la carta, colección y ranking. Supabase Realtime avisa de cada tirada o reclamo («juegos-gacha»)
// y la pantalla pide el canal de nuevo; el aviso no lleva datos.
const CATS = [
  { id: 'mixto', name: 'Mixto' },
  { id: 'anime', name: 'Anime' },
  { id: 'cine', name: 'Cine' },
  { id: 'politica', name: 'Política' },
]
const CAT_NAME = { anime: 'Anime', cine: 'Cine', politica: 'Política' }
const RARITY = { comun: 'Común', rara: 'Rara', epica: 'Épica', mitica: 'Mítica' }
const REFRESH_MS = 20000

// «45 s», «12 min», «2 h 5 min».
function wait(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s < 60) return `${s} s`
  const min = Math.ceil(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`
}

// Reloj del servidor (las cuentas atrás de reclamar se miden con él), avanzando cada segundo.
function useServerNow(offset) {
  const [t, setT] = useState(() => Date.now() + offset)
  useEffect(() => {
    setT(Date.now() + offset)
    const timer = setInterval(() => setT(Date.now() + offset), 1000)
    return () => clearInterval(timer)
  }, [offset])
  return t
}

// Si la imagen no carga (la fuente la quitó o va lenta), las iniciales en su lugar.
function Card({ card, big = false }) {
  const [broken, setBroken] = useState(false)
  const initials = card.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <figure className={`gacha-card gacha-card--${card.rarity} ${big ? 'gacha-card--big' : ''}`}>
      <span className="gacha-card__img">
        {broken ? (
          <span className="gacha-card__fallback" aria-hidden="true">
            {initials}
          </span>
        ) : (
          <img src={card.img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        )}
      </span>
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
    </figure>
  )
}

// Una tirada del canal: la carta y qué ha pasado con ella.
function Roll({ roll, t, meId, claimReady, busy, onClaim }) {
  const open = roll.until > t
  const reserved = roll.premium && !roll.by.me
  const canClaim = open && !busy && !reserved && (claimReady || (roll.premium && roll.by.me))
  let status
  if (roll.claimed) status = roll.claimed.id === meId ? '¡Es tuya!' : `Reclamada por ${roll.claimed.name}`
  else if (roll.owner) status = roll.owner.me ? 'Ya era tuya' : `Ya es de ${roll.owner.name}`
  else if (!open) status = 'Nadie la reclamó'
  return (
    <li className={`gacha-roll ${open ? 'is-open' : ''} ${roll.premium ? 'is-premium' : ''}`}>
      <Card card={roll.card} />
      <div className="gacha-roll__info">
        <span className={`gacha-roll__name gacha-roll__name--${roll.card.rarity}`}>
          <b>{roll.card.name}</b>
          <small>
            <em>{RARITY[roll.card.rarity]}</em> · {CAT_NAME[roll.card.cat]}
            {roll.card.series ? ` · ${roll.card.series}` : ''} · <span className="gacha-kakera">{roll.card.value}</span>
          </small>
        </span>
        <span className="gacha-roll__by">
          <Avatar name={roll.by.name} src={roll.by.avatar} size={22} />
          {roll.by.me ? 'Tu tirada' : `Tirada de ${roll.by.name}`}
          {roll.premium && <em className="gacha-pill">Premium</em>}
        </span>
        {open ? (
          <button
            type="button"
            className="hub-btn hub-btn--primary gacha-claim"
            disabled={!canClaim}
            title={reserved ? 'Solo puede reclamarla quien pagó la tirada premium' : !claimReady ? 'Tu reclamo aún se está recargando' : undefined}
            onClick={() => onClaim(roll.id)}
          >
            Reclamar · {wait(roll.until - t)}
          </button>
        ) : (
          <span className="gacha-roll__status">{status}</span>
        )}
      </div>
    </li>
  )
}

function Collection({ data, onRelease, busy }) {
  const [confirm, setConfirm] = useState(null)
  if (!data) return <p className="gacha-empty">Cargando…</p>
  const { user, cards, value } = data
  return (
    <section aria-labelledby="col-title">
      <h2 id="col-title" className="hub-title gacha-col-title">
        <Avatar name={user.name} src={user.avatar} size={32} />
        {user.me ? 'Tu colección' : `Colección de ${user.name}`}
        <small>
          {cards.length} {cards.length === 1 ? 'carta' : 'cartas'} · <span className="gacha-kakera">{value}</span>
        </small>
      </h2>
      {cards.length === 0 ? (
        <p className="gacha-empty">{user.me ? 'Aún no tienes cartas: tira y reclama la que te guste.' : 'Aún no tiene cartas.'}</p>
      ) : (
        <ul className="gacha-grid">
          {cards.map((card) => (
            <li key={card.id}>
              <Card card={card} />
              {user.me && (
                <button
                  type="button"
                  className="gacha-release"
                  disabled={busy}
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
  if (list.length === 0) return <p className="gacha-empty">Nadie tiene cartas todavía.</p>
  return (
    <ol className="gacha-rank">
      {list.map((p, i) => (
        <li key={p.id}>
          <button type="button" className={p.me ? 'is-me' : ''} onClick={() => onOpen(p.id)}>
            <b className="gacha-rank__pos">{i + 1}</b>
            <Avatar name={p.name} src={p.avatar} size={36} />
            <span className="gacha-rank__name">
              {p.name}
              <small>
                {p.count} {p.count === 1 ? 'carta' : 'cartas'}
                {p.best ? ` · la mejor: ${p.best.name}` : ''}
              </small>
            </span>
            <span className="gacha-kakera">{p.value}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

export default function Gacha({ onExit, juegos }) {
  const { request } = juegos
  const [tab, setTab] = useState('tirar')
  const [cat, setCat] = useState('mixto')
  const [state, setState] = useState(null)
  const [feed, setFeed] = useState([])
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [collection, setCollection] = useState(null)
  const [ranking, setRanking] = useState(null)
  const t = useServerNow(offset)
  const balance = juegos.me?.balance ?? 0

  const load = useCallback(
    async (a, extra = {}) => {
      const body = await request({ t: 'gacha', a, ...extra })
      const g = body?.gacha
      if (!g) return null
      setState(g.state)
      setFeed(g.feed)
      setOffset(g.state.now - Date.now())
      if (g.collection) setCollection(g.collection)
      if (g.ranking) setRanking(g.ranking)
      return body
    },
    [request],
  )

  // Al entrar, cada vez que alguien tira o reclama (aviso de Realtime) y, por si se pierde un aviso, cada REFRESH_MS.
  const debounce = useRef(null)
  useEffect(() => {
    load('estado')
    const channel = supabase
      .channel('juegos-gacha')
      .on('broadcast', { event: 'tirada' }, () => {
        clearTimeout(debounce.current)
        debounce.current = setTimeout(() => load('estado'), 250)
      })
      .subscribe()
    const timer = setInterval(() => load('estado'), REFRESH_MS)
    return () => {
      clearTimeout(debounce.current)
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [load])

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

  async function openCollection(user) {
    setCollection(null)
    setTab('coleccion')
    await load('coleccion', user ? { user } : {})
  }

  const rolls = state?.rolls
  const claimReady = state ? state.claimAt === 0 || state.claimAt <= t : false
  const lastRoll = last && feed.find((r) => r.id === last.id)

  let lastText = null
  if (last && lastRoll) {
    if (lastRoll.claimed) lastText = lastRoll.claimed.id === juegos.me?.id ? '¡Es tuya!' : `Te la ha quitado ${lastRoll.claimed.name}.`
    else if (last.owned) lastText = `Ya tiene dueño: te llevas ${last.kakera} de kakera.`
    else if (lastRoll.until > t) lastText = `¡Reclámala antes de ${wait(lastRoll.until - t)}!`
    else lastText = 'Se te escapó.'
  }

  return (
    <main className="app gacha-app">
      <header className="top">
        <h1>Gacha</h1>
        <div className="toggles">
          <button type="button" onClick={onExit}>
            Volver
          </button>
        </div>
      </header>

      <dl className="gacha-hud">
        <div>
          <dt>Tiradas</dt>
          <dd>
            {rolls ? `${rolls.left}/${rolls.max}` : '–'}
            {rolls && <small>se recargan en {wait(rolls.resetAt - t)}</small>}
          </dd>
        </div>
        <div>
          <dt>Reclamo</dt>
          <dd className={claimReady ? 'is-ready' : ''}>
            {state ? (claimReady ? 'Listo' : wait(state.claimAt - t)) : '–'}
            <small>uno cada 3 h</small>
          </dd>
        </div>
        <div>
          <dt>Kakera</dt>
          <dd>
            <span className="gacha-kakera">{state?.kakera ?? 0}</span>
          </dd>
        </div>
        <div>
          <dt>Saldo de la semana</dt>
          <dd>{eur(balance)}</dd>
        </div>
      </dl>

      <nav className="hub-segs gacha-tabs" aria-label="Secciones del gacha">
        {[
          ['tirar', 'Tirar'],
          ['coleccion', 'Mi colección'],
          ['ranking', 'Ranking'],
        ].map(([id, name]) => (
          <button
            key={id}
            type="button"
            className="hub-seg"
            aria-pressed={tab === id}
            onClick={() => (id === 'coleccion' ? openCollection() : id === 'ranking' ? (setTab('ranking'), load('ranking')) : setTab(id))}
          >
            <span>{name}</span>
          </button>
        ))}
      </nav>

      <p className="status gacha-status" aria-live="polite">
        {juegos.error || (state ? '' : 'Conectando…')}
      </p>

      {tab === 'tirar' && (
        <div className="gacha-play">
          <section className="gacha-panel" aria-labelledby="roll-title">
            <h2 id="roll-title" className="hub-title">
              Tirar <small>lo que salga lo ve todo el mundo durante 45 s</small>
            </h2>
            <div className="hub-segs" role="group" aria-label="Categoría">
              {CATS.map((c) => (
                <button key={c.id} type="button" className="hub-seg" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
            <div className="gacha-actions">
              <button type="button" className="hub-btn hub-btn--primary" disabled={busy || !rolls || rolls.left <= 0} onClick={() => roll(false)}>
                {rolls && rolls.left <= 0 ? 'Sin tiradas esta hora' : 'Tirar'}
              </button>
              <button
                type="button"
                className="hub-btn gacha-premium"
                disabled={busy || !state || balance < state.prices.premium}
                title="Siempre épica o mítica, sin dueño, y solo la puedes reclamar tú (sin gastar tu reclamo)"
                onClick={() => roll(true)}
              >
                Premium · {eur(state?.prices.premium ?? 20000)}
              </button>
            </div>
            <div className="gacha-shop">
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
                onClick={() => act('tienda', { item: 'reclamo' })}
              >
                Recargar reclamo · <span className="gacha-kakera">{state?.prices.claimReset ?? 600}</span>
              </button>
            </div>
            {last && (
              <div className="gacha-last" key={last.id}>
                <Card card={last.card} big />
                <div className="gacha-last__text">
                  <p>{lastText}</p>
                  {lastRoll && lastRoll.until > t && (
                    <button
                      type="button"
                      className="hub-btn hub-btn--primary"
                      disabled={busy || (!claimReady && !lastRoll.premium)}
                      onClick={() => act('reclamar', { id: last.id })}
                    >
                      Reclamar
                    </button>
                  )}
                  <a href={last.card.src} target="_blank" rel="noreferrer">
                    Ver en la fuente
                  </a>
                </div>
              </div>
            )}
          </section>

          <section className="gacha-feed" aria-labelledby="feed-title">
            <h2 id="feed-title" className="hub-title">
              Canal <small>las últimas tiradas de todos</small>
            </h2>
            {feed.length === 0 ? (
              <p className="gacha-empty">{state ? 'Todavía no ha tirado nadie. ¡Estrénalo!' : 'Cargando…'}</p>
            ) : (
              <ul className="gacha-rolls">
                {feed.map((r) => (
                  <Roll key={r.id} roll={r} t={t} meId={juegos.me?.id} claimReady={claimReady} busy={busy} onClaim={(id) => act('reclamar', { id })} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'coleccion' && <Collection data={collection} busy={busy} onRelease={(card) => act('liberar', { card }).then(() => load('coleccion'))} />}
      {tab === 'ranking' && <Ranking list={ranking} onOpen={openCollection} />}

      <footer className="gacha-foot">
        Datos e imágenes de AniList, Wikipedia y Wikimedia Commons. Solo para TopCode, sin fines comerciales.
      </footer>
    </main>
  )
}
