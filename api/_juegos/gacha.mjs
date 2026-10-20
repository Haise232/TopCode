// Gacha de Juegos al estilo de Mudae. Cada hora tienes ROLLS_PER_HOUR tiradas gratis; lo que sale lo ve todo el mundo en
// el canal del gacha y cualquiera puede reclamarlo en los CLAIM_MS siguientes (el primero que llega se lo queda), pero
// cada persona solo puede reclamar una vez cada CLAIM_COOLDOWN_MS. Cada carta tiene como mucho un dueño.
// Kakera: la ganas al sacar una carta que ya tiene dueño y al liberar una tuya; se gasta en tiradas extra o en recargar
// el reclamo. Tirada premium: cuesta PREMIUM_COST € del saldo de la semana, siempre es épica o mítica, nunca sale una
// carta con dueño y solo puede reclamarla quien la pagó (sin gastar su reclamo).
// Las cartas vienen de gacha-catalogo.json (lo genera scripts/gacha/importar.mjs).
import { randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'

// vercel.json incluye el archivo en la función (includeFiles), por si el trazado de dependencias no lo ve.
const catalogo = JSON.parse(readFileSync(new URL('./gacha-catalogo.json', import.meta.url), 'utf8'))

export const ROLLS_PER_HOUR = 8
const HOUR = 3600000
export const CLAIM_MS = 45000
export const CLAIM_COOLDOWN_MS = 3 * HOUR
export const PREMIUM_COST = 20000
export const EXTRA_ROLL_KAKERA = 150
export const CLAIM_RESET_KAKERA = 600
const FEED_SIZE = 30
const RANKING_SIZE = 20
const KEEP_DAYS = 7
const CATS = ['anime', 'cine', 'politica']
// Probabilidad de cada rareza (en milésimas).
const WEIGHTS = {
  normal: [
    ['comun', 700],
    ['rara', 230],
    ['epica', 60],
    ['mitica', 10],
  ],
  premium: [
    ['epica', 750],
    ['mitica', 250],
  ],
}

export const GACHA_ERRORS = {
  GACHA_NO_ROLLS: 'No te quedan tiradas esta hora.',
  GACHA_TAKEN: '¡Tarde! Otra persona la reclamó antes.',
  GACHA_LATE: 'Se acabó el tiempo para reclamarla.',
  GACHA_RESERVED: 'Es una tirada premium: solo puede reclamarla quien la pagó.',
  GACHA_COOLDOWN: 'Todavía no puedes reclamar: espera a que se recargue tu reclamo.',
  GACHA_OWNED: 'Esa carta ya tiene dueño.',
  GACHA_KAKERA: 'No tienes kakera suficiente.',
  GACHA_FUNDS: `Necesitas ${PREMIUM_COST.toLocaleString('es-ES')} € de saldo para la tirada premium.`,
  GACHA_NOT_YOURS: 'Esa carta no es tuya.',
  GACHA_GONE: 'Esa tirada ya no existe.',
  GACHA_READY: 'Tu reclamo ya está listo.',
}

const cards = new Map(catalogo.cartas.map((c) => [c.id, c]))
const groups = new Map()
for (const c of catalogo.cartas) {
  const key = `${c.cat}/${c.rarity}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(c)
}

// Lo que se manda al navegador de una carta.
export function cardView(id) {
  const c = cards.get(id)
  if (!c) return null
  return { id: c.id, cat: c.cat, name: c.name, series: c.series, img: c.img, rarity: c.rarity, value: c.value, rank: c.rank, src: c.src }
}

function pick(list) {
  return list[randomInt(list.length)]
}

// Primero la categoría (en «mixto», las tres por igual), después la rareza y por último la carta.
// taken: cartas con dueño que la tirada premium no puede sacar.
function draw(cat, premium, taken) {
  const cats = CATS.includes(cat) ? [cat] : CATS
  const chosen = pick(cats)
  const weights = premium ? WEIGHTS.premium : WEIGHTS.normal
  let r = randomInt(weights.reduce((sum, [, w]) => sum + w, 0))
  const [rarity] = weights.find(([, w]) => (r -= w) < 0)
  const free = (list) => (taken ? list.filter((c) => !taken.has(c.id)) : list)
  let pool = free(groups.get(`${chosen}/${rarity}`) ?? [])
  // Si en esa rareza ya no queda nada libre, la carta libre más valiosa de la categoría (o de cualquiera).
  if (pool.length === 0) pool = free(catalogo.cartas.filter((c) => c.cat === chosen && c.rarity !== 'comun'))
  if (pool.length === 0) pool = free(catalogo.cartas)
  if (pool.length === 0) pool = catalogo.cartas
  return pick(pool)
}

const hourOf = (t) => Math.floor(t / HOUR)
const ms = (value) => (value instanceof Date ? value.getTime() : Number(value))

// db: { query, tx } · ping(topic, event) avisa por Realtime · charge(q, userId, amount): cobra del saldo de la
// semana dentro de la transacción y devuelve el saldo nuevo, o null si no llega.
export function createGacha({ db, ping, now, charge }) {
  // Estado del jugador, bloqueado para la transacción y con las tiradas de la hora en curso.
  async function player(q, userId, t) {
    await q(`insert into public.juegos_gacha_jugadores (usuario_id) values ($1) on conflict (usuario_id) do nothing`, [userId])
    const row = (await q(`select hora, tiradas, reclamo_listo, kakera from public.juegos_gacha_jugadores where usuario_id = $1 for update`, [userId])).rows[0]
    const hour = hourOf(t)
    return { hour, used: Number(row.hora) === hour ? row.tiradas : 0, claimAt: ms(row.reclamo_listo), kakera: Number(row.kakera) }
  }

  async function save(q, userId, st) {
    await q(`update public.juegos_gacha_jugadores set hora = $2, tiradas = $3, reclamo_listo = to_timestamp($4 / 1000.0), kakera = $5 where usuario_id = $1`, [
      userId,
      st.hour,
      st.used,
      st.claimAt,
      st.kakera,
    ])
  }

  function stateView(st, t) {
    return {
      now: t,
      rolls: { left: ROLLS_PER_HOUR - st.used, max: ROLLS_PER_HOUR, resetAt: (st.hour + 1) * HOUR },
      claimAt: st.claimAt > t ? st.claimAt : 0,
      kakera: st.kakera,
      claimMs: CLAIM_MS,
      prices: { premium: PREMIUM_COST, extraRoll: EXTRA_ROLL_KAKERA, claimReset: CLAIM_RESET_KAKERA },
    }
  }

  // Sin bloqueo: para pintar la pantalla.
  async function readState(userId, t) {
    const row = (await db.query(`select hora, tiradas, reclamo_listo, kakera from public.juegos_gacha_jugadores where usuario_id = $1`, [userId])).rows[0]
    const hour = hourOf(t)
    const st = row
      ? { hour, used: Number(row.hora) === hour ? row.tiradas : 0, claimAt: ms(row.reclamo_listo), kakera: Number(row.kakera) }
      : { hour, used: 0, claimAt: 0, kakera: 0 }
    return stateView(st, t)
  }

  async function feed(userId, t) {
    const { rows } = await db.query(
      `select t.id, t.usuario_id, t.carta, t.premium, t.creada, t.reclamada_por,
              ru.nombre as by_name, ru.avatar as by_avatar, cu.nombre as claimer_name, cu.avatar as claimer_avatar,
              o.usuario_id as owner_id, ou.nombre as owner_name
       from public.juegos_gacha_tiradas t
       left join public.juegos_cuentas ru on ru.usuario_id = t.usuario_id
       left join public.juegos_cuentas cu on cu.usuario_id = t.reclamada_por
       left join public.juegos_gacha_cartas o on o.carta = t.carta
       left join public.juegos_cuentas ou on ou.usuario_id = o.usuario_id
       order by t.id desc limit $1`,
      [FEED_SIZE],
    )
    return rows
      .map((r) => {
        const at = ms(r.creada)
        const card = cardView(r.carta)
        if (!card) return null
        const claimed = r.reclamada_por ? { id: r.reclamada_por, name: r.claimer_name ?? '¿?', avatar: r.claimer_avatar ?? null } : null
        const owner = r.owner_id ? { id: r.owner_id, name: r.owner_name ?? '¿?', me: r.owner_id === userId } : null
        return {
          id: Number(r.id),
          card,
          by: { id: r.usuario_id, name: r.by_name ?? '¿?', avatar: r.by_avatar ?? null, me: r.usuario_id === userId },
          premium: r.premium,
          at,
          claimed,
          // Dueño de antes de la tirada (si la reclamó alguien en esta misma tirada, eso ya lo dice «claimed»).
          owner: claimed ? null : owner,
          until: !claimed && !owner && t < at + CLAIM_MS ? at + CLAIM_MS : 0,
        }
      })
      .filter(Boolean)
  }

  async function roll(user, msg, t) {
    const premium = msg.premium === true
    const out = await db.tx(async (q) => {
      const st = await player(q, user.id, t)
      if (!premium && st.used >= ROLLS_PER_HOUR) return { error: 'GACHA_NO_ROLLS' }
      if (premium && (await charge(q, user.id, PREMIUM_COST)) === null) return { error: 'GACHA_FUNDS' }
      const taken = premium ? new Set((await q(`select carta from public.juegos_gacha_cartas`)).rows.map((r) => r.carta)) : null
      const card = draw(msg.cat, premium, taken)
      const owner = (await q(`select usuario_id from public.juegos_gacha_cartas where carta = $1`, [card.id])).rows[0]?.usuario_id
      // Si ya tiene dueño (aunque seas tú), te llevas kakera en lugar de la carta.
      const gain = owner ? Math.round(card.value / 2) : 0
      if (!premium) st.used += 1
      st.kakera += gain
      await save(q, user.id, st)
      // La hora de la tirada, con el mismo reloj que cuenta los CLAIM_MS al reclamar.
      const { rows } = await q(
        `insert into public.juegos_gacha_tiradas (usuario_id, carta, premium, creada) values ($1, $2, $3, to_timestamp($4 / 1000.0)) returning id`,
        [user.id, card.id, premium, t],
      )
      if (Number(rows[0].id) % 50 === 0) await q(`delete from public.juegos_gacha_tiradas where creada < now() - make_interval(days => $1)`, [KEEP_DAYS])
      return { result: { id: Number(rows[0].id), card: cardView(card.id), kakera: gain, owned: Boolean(owner) } }
    })
    if (!out.error) await ping('juegos-gacha', 'tirada')
    return out
  }

  async function claim(user, msg, t) {
    if (!Number.isSafeInteger(msg.id)) return { error: 'BAD_MESSAGE' }
    const out = await db.tx(async (q) => {
      const row = (await q(`select usuario_id, carta, premium, creada, reclamada_por from public.juegos_gacha_tiradas where id = $1 for update`, [msg.id])).rows[0]
      if (!row) return { error: 'GACHA_GONE' }
      if (row.reclamada_por) return { error: 'GACHA_TAKEN' }
      if (t > ms(row.creada) + CLAIM_MS) return { error: 'GACHA_LATE' }
      if (row.premium && row.usuario_id !== user.id) return { error: 'GACHA_RESERVED' }
      const st = await player(q, user.id, t)
      const free = row.premium && row.usuario_id === user.id
      if (!free && st.claimAt > t) return { error: 'GACHA_COOLDOWN' }
      const got = await q(`insert into public.juegos_gacha_cartas (carta, usuario_id) values ($1, $2) on conflict (carta) do nothing returning carta`, [row.carta, user.id])
      if (got.rows.length === 0) return { error: 'GACHA_OWNED' }
      await q(`update public.juegos_gacha_tiradas set reclamada_por = $2 where id = $1`, [msg.id, user.id])
      if (!free) {
        st.claimAt = t + CLAIM_COOLDOWN_MS
        await save(q, user.id, st)
      }
      return { result: { card: cardView(row.carta) } }
    })
    if (!out.error) await ping('juegos-gacha', 'tirada')
    return out
  }

  // Soltar una carta tuya: vuelve a poder salir para cualquiera y te da su valor en kakera.
  async function release(user, msg, t) {
    const card = cardView(msg.card)
    if (!card) return { error: 'BAD_MESSAGE' }
    return db.tx(async (q) => {
      const gone = await q(`delete from public.juegos_gacha_cartas where carta = $1 and usuario_id = $2 returning carta`, [card.id, user.id])
      if (gone.rows.length === 0) return { error: 'GACHA_NOT_YOURS' }
      const st = await player(q, user.id, t)
      st.kakera += card.value
      await save(q, user.id, st)
      return { result: { kakera: card.value } }
    })
  }

  async function shop(user, msg, t) {
    if (msg.item !== 'tirada' && msg.item !== 'reclamo') return { error: 'BAD_MESSAGE' }
    return db.tx(async (q) => {
      const st = await player(q, user.id, t)
      const price = msg.item === 'tirada' ? EXTRA_ROLL_KAKERA : CLAIM_RESET_KAKERA
      if (msg.item === 'reclamo' && st.claimAt <= t) return { error: 'GACHA_READY' }
      if (st.kakera < price) return { error: 'GACHA_KAKERA' }
      st.kakera -= price
      // Una tirada extra es una tirada menos gastada (puede quedar por debajo de cero: tendrás más de ROLLS_PER_HOUR).
      if (msg.item === 'tirada') st.used -= 1
      else st.claimAt = 0
      await save(q, user.id, st)
      return { result: { item: msg.item } }
    })
  }

  // Colección de alguien (la tuya si no se dice de quién), de la carta más valiosa a la que menos.
  async function collection(user, msg) {
    const who = typeof msg.user === 'string' && /^[0-9a-f-]{36}$/.test(msg.user) ? msg.user : user.id
    const [owned, account] = await Promise.all([
      db.query(`select carta, reclamada from public.juegos_gacha_cartas where usuario_id = $1`, [who]),
      db.query(`select nombre, avatar from public.juegos_cuentas where usuario_id = $1`, [who]),
    ])
    const list = owned.rows
      .map((r) => ({ ...cardView(r.carta), claimedAt: ms(r.reclamada) }))
      .filter((c) => c.id)
      .sort((a, b) => b.value - a.value || a.rank - b.rank)
    return {
      user: { id: who, name: account.rows[0]?.nombre ?? '¿?', avatar: account.rows[0]?.avatar ?? null, me: who === user.id },
      cards: list,
      value: list.reduce((sum, c) => sum + c.value, 0),
    }
  }

  async function ranking(user) {
    const { rows } = await db.query(
      `select c.usuario_id, array_agg(c.carta) as cartas, a.nombre, a.avatar
       from public.juegos_gacha_cartas c left join public.juegos_cuentas a on a.usuario_id = c.usuario_id
       group by c.usuario_id, a.nombre, a.avatar`,
    )
    return rows
      .map((r) => {
        const owned = r.cartas.map(cardView).filter(Boolean)
        const best = [...owned].sort((a, b) => b.value - a.value)[0] ?? null
        return {
          id: r.usuario_id,
          name: r.nombre ?? '¿?',
          avatar: r.avatar ?? null,
          me: r.usuario_id === user.id,
          count: owned.length,
          value: owned.reduce((sum, c) => sum + c.value, 0),
          best,
        }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, RANKING_SIZE)
  }

  const ACTIONS = { tirar: roll, reclamar: claim, liberar: release, tienda: shop }

  // msg.a: estado | tirar { cat, premium } | reclamar { id } | liberar { card } | tienda { item } | coleccion { user } | ranking
  async function handle(user, msg) {
    const t = now()
    const reply = {}
    if (msg.a === 'coleccion') reply.collection = await collection(user, msg)
    else if (msg.a === 'ranking') reply.ranking = await ranking(user)
    else if (Object.hasOwn(ACTIONS, msg.a)) {
      const out = await ACTIONS[msg.a](user, msg, t)
      if (out.error) reply.error = out.error
      else reply.result = out.result
    } else if (msg.a !== 'estado') reply.error = 'BAD_MESSAGE'
    const [state, list] = await Promise.all([readState(user.id, now()), feed(user.id, now())])
    reply.state = state
    reply.feed = list
    return reply
  }

  return { handle }
}

export const CATALOG_INFO = {
  generated: catalogo.generado,
  counts: CATS.map((cat) => ({ cat, total: catalogo.cartas.filter((c) => c.cat === cat).length })),
}
