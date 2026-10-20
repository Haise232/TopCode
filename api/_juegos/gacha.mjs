// Gacha de Juegos al estilo de Mudae, con políticos españoles. Cada ROLL_PERIOD_MS tienes ROLLS_PER_PERIOD tirada
// gratis; lo que sale lo ve todo el mundo en el canal del gacha y cualquiera puede reclamarlo en los CLAIM_MS siguientes (el primero que
// llega se lo queda), pero cada persona solo puede reclamar una vez cada CLAIM_COOLDOWN_MS. Cada carta tiene como mucho
// un dueño. Todo se paga y se cobra con el saldo de la semana (cuenta en el Score):
//   - tirada premium (PREMIUM_COST): siempre épica o mítica, nunca una carta con dueño y directa a tu colección;
//   - tirada extra (EXTRA_ROLL_COST) y recargar el reclamo (CLAIM_RESET_COST);
//   - vender una carta tuya te paga su precio (SELL_RATE € por punto de valor) y la deja libre otra vez.
// Cada carta tiene además un poder (powerOf) para uno de los juegos, más fuerte cuanto más rara es, que su dueño puede
// usar una vez cada POWER_COOLDOWN_MS: ver cartas en el póker o el blackjack (lo aplica game.mjs en la mesa, que ve un
// aviso en el chat) o un seguro o un premio para las próximas jugadas de un juego en solitario (juegos_gacha_efectos,
// que aplica applyEffect al liquidar cada jugada).
// Las cartas vienen de gacha-catalogo.json (lo genera scripts/gacha/importar.mjs).
import { randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'

// vercel.json incluye el archivo en la función (includeFiles), por si el trazado de dependencias no lo ve.
const catalogo = JSON.parse(readFileSync(new URL('./gacha-catalogo.json', import.meta.url), 'utf8'))

const HOUR = 3600000
export const ROLLS_PER_PERIOD = 1
export const ROLL_PERIOD_MS = 2 * HOUR
export const CLAIM_MS = 45000
// Igual que las tiradas: siempre puedes quedarte la carta de tu tirada gratis.
export const CLAIM_COOLDOWN_MS = 2 * HOUR
export const PREMIUM_COST = 20000
export const EXTRA_ROLL_COST = 1000
export const CLAIM_RESET_COST = 5000
// € por punto de valor al vender: común ≈ 700 €, mítica ≈ 19.000 €. Una premium se vende de media por menos de lo que
// cuesta, y una carta normal, por menos de una recarga de reclamo más una tirada: comprar y vender no da dinero infinito.
export const SELL_RATE = 20
export const POWER_COOLDOWN_MS = 24 * HOUR
// Lo más que puede añadir un premio en una jugada.
export const BONUS_CAP = 10000
// Poderes de mesa: game.mjs los aplica a la mano en curso.
const TABLE_POWERS = {
  rayos: { game: 'poker', name: 'Rayos X', text: 'Ves las cartas de todos los jugadores durante una mano de póker.' },
  chivatazo: { game: 'poker', name: 'Chivatazo', text: 'Ves las cartas de un rival al azar durante una mano de póker.' },
  vistazo: { game: 'poker', name: 'Vistazo', text: 'Ves una carta de un rival al azar durante una mano de póker.' },
  crupier: { game: 'blackjack', name: 'Ojo del crupier', text: 'Ves la carta tapada del crupier durante una mano de blackjack.' },
}
// Seguros y premios de los juegos en solitario: cuánto y durante cuántas jugadas, según la rareza.
const STRENGTH = { comun: { pct: 25, uses: 1 }, rara: { pct: 50, uses: 1 }, epica: { pct: 100, uses: 1 }, mitica: { pct: 100, uses: 3 } }
const SOLO_IN = { roulette: 'la ruleta', crash: 'el cohete', slots: 'las tragamonedas', plinko: 'el Plinko' }
const SOLO_TITLE = { roulette: 'ruleta', crash: 'cohete', slots: 'tragamonedas', plinko: 'Plinko' }
// Qué poder toca a cada carta: las de cada rareza, por orden de popularidad, van recorriendo su lista.
const POOLS = {
  mitica: ['rayos', 'crupier', 'premio:roulette', 'seguro:crash', 'premio:slots', 'seguro:plinko', 'premio:crash', 'seguro:roulette'],
  epica: ['chivatazo', 'crupier', 'seguro:roulette', 'premio:crash', 'seguro:slots', 'premio:plinko', 'premio:roulette', 'seguro:crash', 'premio:slots', 'seguro:plinko'],
  rara: ['vistazo', 'seguro:roulette', 'premio:roulette', 'seguro:crash', 'premio:crash', 'seguro:slots', 'premio:slots', 'seguro:plinko', 'premio:plinko'],
  comun: ['seguro:roulette', 'premio:roulette', 'seguro:crash', 'premio:crash', 'seguro:slots', 'premio:slots', 'seguro:plinko', 'premio:plinko'],
}
// Cartas con un poder elegido a mano (Santiago Abascal, legendaria con Rayos X).
const POWER_OVERRIDES = { 'politica:Q11703587': 'rayos' }
const euros = (n) => `${n.toLocaleString('es-ES')} €`

function buildPower(key, rarity) {
  if (TABLE_POWERS[key]) return { id: key, kind: key, ...TABLE_POWERS[key] }
  const [kind, game] = key.split(':')
  const { pct, uses } = STRENGTH[rarity]
  const where = uses > 1 ? `tus próximas ${uses} jugadas en ${SOLO_IN[game]}` : `tu próxima jugada en ${SOLO_IN[game]}`
  const times = uses > 1 ? ` ×${uses}` : ''
  if (kind === 'seguro') {
    return { id: key, kind, game, pct, uses, name: `${pct === 100 ? 'Seguro total' : `Seguro del ${pct} %`}${times} · ${SOLO_TITLE[game]}`, text: `Si pierdes en ${where}, te devuelven el ${pct} % de lo perdido.` }
  }
  return {
    id: key,
    kind,
    game,
    pct,
    uses,
    name: `${pct === 100 ? 'Premio doble' : `Premio +${pct} %`}${times} · ${SOLO_TITLE[game]}`,
    text: `Si ganas en ${where}, cobras un ${pct} % más de lo ganado (hasta ${euros(BONUS_CAP)} por jugada).`,
  }
}
const RARITY_ORDER = { mitica: 0, epica: 1, rara: 2, comun: 3 }
const FEED_SIZE = 30
const KEEP_DAYS = 7
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
  GACHA_NO_ROLLS: 'Ya has usado tu tirada: tienes una gratis cada 2 horas.',
  GACHA_TAKEN: '¡Tarde! Otra persona la reclamó antes.',
  GACHA_LATE: 'Se acabó el tiempo para reclamarla.',
  GACHA_COOLDOWN: 'Todavía no puedes reclamar: espera a que se recargue tu reclamo.',
  GACHA_OWNED: 'Esa carta ya tiene dueño.',
  GACHA_FUNDS: 'No te llega el saldo de la semana.',
  GACHA_NOT_YOURS: 'Esa carta no es tuya.',
  GACHA_GONE: 'Esa tirada ya no existe.',
  GACHA_READY: 'Tu reclamo ya está listo.',
  POWER_WAIT: 'Ese poder se está recargando: se puede usar una vez al día.',
  POWER_NONE: 'Esa carta no tiene poder.',
  POWER_POKER: 'Este poder se usa sentado en una mesa.',
  POWER_GAME: 'Ese poder es de otro juego: úsalo allí.',
  POWER_NO_HAND: 'Úsalo cuando estés jugando una mano.',
  POWER_ACTIVE: 'Ya tienes un poder activo ahí.',
  POWER_NO_RIVALS: 'No queda ningún rival en la mano.',
}

const cards = new Map(catalogo.cartas.map((c) => [c.id, c]))
const byRarity = new Map()
for (const c of catalogo.cartas) {
  if (!byRarity.has(c.rarity)) byRarity.set(c.rarity, [])
  byRarity.get(c.rarity).push(c)
}
const powerOf = new Map()
for (const [rarity, list] of byRarity) {
  const pool = POOLS[rarity] ?? []
  for (const c of list) if (POWER_OVERRIDES[c.id]) powerOf.set(c.id, buildPower(POWER_OVERRIDES[c.id], rarity))
  ;[...list]
    .filter((c) => !POWER_OVERRIDES[c.id])
    .sort((a, b) => a.rank - b.rank)
    .forEach((c, i) => pool.length && powerOf.set(c.id, buildPower(pool[i % pool.length], rarity)))
}

// Probabilidad (en %) de que una tirada saque una carta concreta de esa rareza.
function chance(kind, rarity) {
  const weight = WEIGHTS[kind].find(([r]) => r === rarity)?.[1] ?? 0
  const total = WEIGHTS[kind].reduce((sum, [, w]) => sum + w, 0)
  return ((weight / total) * 100) / (byRarity.get(rarity)?.length ?? 1)
}

// Lo que se manda al navegador de una carta.
export function cardView(id) {
  const c = cards.get(id)
  if (!c) return null
  return {
    id: c.id,
    name: c.name,
    series: c.series,
    img: c.img,
    rarity: c.rarity,
    value: c.value,
    price: c.value * SELL_RATE,
    rank: c.rank,
    power: powerOf.get(c.id) ?? null,
  }
}

function pick(list) {
  return list[randomInt(list.length)]
}

// Primero la rareza y después una carta de esa rareza. taken: cartas con dueño que la tirada premium no puede sacar.
function draw(premium, taken) {
  const weights = premium ? WEIGHTS.premium : WEIGHTS.normal
  let r = randomInt(weights.reduce((sum, [, w]) => sum + w, 0))
  const [rarity] = weights.find(([, w]) => (r -= w) < 0)
  const free = (list) => (taken ? list.filter((c) => !taken.has(c.id)) : list)
  let pool = free(byRarity.get(rarity) ?? [])
  // Si en esa rareza ya no queda nada libre, cualquier carta libre que no sea común (o cualquiera).
  if (pool.length === 0) pool = free(catalogo.cartas.filter((c) => c.rarity !== 'comun'))
  if (pool.length === 0) pool = free(catalogo.cartas)
  if (pool.length === 0) pool = catalogo.cartas
  return pick(pool)
}

// Periodo de las tiradas gratis (la columna «hora» de juegos_gacha_jugadores guarda este número).
const periodOf = (t) => Math.floor(t / ROLL_PERIOD_MS)
const ms = (value) => (value instanceof Date ? value.getTime() : Number(value))

// db: { query, tx } · ping(topic, event) avisa por Realtime · charge(q, userId, amount): cobra del saldo de la semana
// (o paga, si amount es negativo) dentro de la transacción y devuelve el saldo nuevo, o null si no llega.
export function createGacha({ db, ping, now, charge }) {
  // Estado del jugador, bloqueado para la transacción y con las tiradas de la hora en curso.
  async function player(q, userId, t) {
    await q(`insert into public.juegos_gacha_jugadores (usuario_id) values ($1) on conflict (usuario_id) do nothing`, [userId])
    const row = (await q(`select hora, tiradas, reclamo_listo from public.juegos_gacha_jugadores where usuario_id = $1 for update`, [userId])).rows[0]
    const period = periodOf(t)
    return { period, used: Number(row.hora) === period ? row.tiradas : 0, claimAt: ms(row.reclamo_listo) }
  }

  async function save(q, userId, st) {
    await q(`update public.juegos_gacha_jugadores set hora = $2, tiradas = $3, reclamo_listo = to_timestamp($4 / 1000.0) where usuario_id = $1`, [
      userId,
      st.period,
      st.used,
      st.claimAt,
    ])
  }

  // Sin bloqueo: para pintar la pantalla.
  async function readState(userId, t) {
    const [row, owned] = await Promise.all([
      db.query(`select hora, tiradas, reclamo_listo from public.juegos_gacha_jugadores where usuario_id = $1`, [userId]).then((r) => r.rows[0]),
      db.query(`select count(*)::int as n from public.juegos_gacha_cartas where usuario_id = $1`, [userId]).then((r) => r.rows[0].n),
    ])
    const period = periodOf(t)
    const used = row && Number(row.hora) === period ? row.tiradas : 0
    const claimAt = row ? ms(row.reclamo_listo) : 0
    return {
      now: t,
      rolls: { left: ROLLS_PER_PERIOD - used, max: ROLLS_PER_PERIOD, resetAt: (period + 1) * ROLL_PERIOD_MS, everyMs: ROLL_PERIOD_MS },
      claimAt: claimAt > t ? claimAt : 0,
      claimMs: CLAIM_MS,
      owned,
      prices: { premium: PREMIUM_COST, extraRoll: EXTRA_ROLL_COST, claimReset: CLAIM_RESET_COST, sellRate: SELL_RATE },
    }
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
      if (!premium && st.used >= ROLLS_PER_PERIOD) return { error: 'GACHA_NO_ROLLS' }
      if (premium && (await charge(q, user.id, PREMIUM_COST)) === null) return { error: 'GACHA_FUNDS' }
      let card
      let owner = null
      if (premium) {
        // Directa a tu colección. Si otra premium a la vez se llevó la misma carta (el insert no entra), se sortea otra.
        const taken = new Set((await q(`select carta from public.juegos_gacha_cartas`)).rows.map((r) => r.carta))
        for (let i = 0; i < 5 && !card; i++) {
          const drawn = draw(true, taken)
          const got = await q(`insert into public.juegos_gacha_cartas (carta, usuario_id) values ($1, $2) on conflict (carta) do nothing returning carta`, [drawn.id, user.id])
          if (got.rows.length) card = drawn
          else taken.add(drawn.id)
        }
        if (!card) throw new Error('gacha: no queda ninguna carta libre para la tirada premium')
      } else {
        card = draw(false, null)
        owner = (await q(`select usuario_id from public.juegos_gacha_cartas where carta = $1`, [card.id])).rows[0]?.usuario_id ?? null
        st.used += 1
        await save(q, user.id, st)
      }
      // La hora de la tirada, con el mismo reloj que cuenta los CLAIM_MS al reclamar.
      const { rows } = await q(
        `insert into public.juegos_gacha_tiradas (usuario_id, carta, premium, creada, reclamada_por) values ($1, $2, $3, to_timestamp($4 / 1000.0), $5) returning id`,
        [user.id, card.id, premium, t, premium ? user.id : null],
      )
      if (Number(rows[0].id) % 50 === 0) await q(`delete from public.juegos_gacha_tiradas where creada < now() - make_interval(days => $1)`, [KEEP_DAYS])
      return { result: { id: Number(rows[0].id), card: cardView(card.id), owned: Boolean(owner), claimed: premium } }
    })
    if (!out.error) await ping('juegos-gacha', 'tirada')
    return out
  }

  async function claim(user, msg, t) {
    if (!Number.isSafeInteger(msg.id)) return { error: 'BAD_MESSAGE' }
    const out = await db.tx(async (q) => {
      const row = (await q(`select carta, creada, reclamada_por from public.juegos_gacha_tiradas where id = $1 for update`, [msg.id])).rows[0]
      if (!row) return { error: 'GACHA_GONE' }
      if (row.reclamada_por) return { error: 'GACHA_TAKEN' }
      if (t > ms(row.creada) + CLAIM_MS) return { error: 'GACHA_LATE' }
      const st = await player(q, user.id, t)
      if (st.claimAt > t) return { error: 'GACHA_COOLDOWN' }
      const got = await q(`insert into public.juegos_gacha_cartas (carta, usuario_id) values ($1, $2) on conflict (carta) do nothing returning carta`, [row.carta, user.id])
      if (got.rows.length === 0) return { error: 'GACHA_OWNED' }
      await q(`update public.juegos_gacha_tiradas set reclamada_por = $2 where id = $1`, [msg.id, user.id])
      st.claimAt = t + CLAIM_COOLDOWN_MS
      await save(q, user.id, st)
      return { result: { card: cardView(row.carta) } }
    })
    if (!out.error) await ping('juegos-gacha', 'tirada')
    return out
  }

  // Vender una carta tuya: el dinero va a tu saldo de la semana y la carta vuelve a poder salir para cualquiera.
  async function sell(user, msg) {
    const card = cardView(msg.card)
    if (!card) return { error: 'BAD_MESSAGE' }
    const out = await db.tx(async (q) => {
      // Primero la cuenta y después la carta, en el mismo orden que la tirada premium (así no se bloquean entre sí).
      await q(`select 1 from public.juegos_cuentas where usuario_id = $1 for update`, [user.id])
      const gone = await q(`delete from public.juegos_gacha_cartas where carta = $1 and usuario_id = $2 returning carta`, [card.id, user.id])
      if (gone.rows.length === 0) return { error: 'GACHA_NOT_YOURS' }
      await charge(q, user.id, -card.price)
      return { result: { sold: card.id, earned: card.price } }
    })
    if (!out.error) await ping('juegos-gacha', 'tirada')
    return out
  }

  // Tienda: una tirada más en este periodo, o el reclamo listo ya. Se pagan con el saldo de la semana.
  async function shop(user, msg, t) {
    if (msg.item !== 'tirada' && msg.item !== 'reclamo') return { error: 'BAD_MESSAGE' }
    return db.tx(async (q) => {
      const st = await player(q, user.id, t)
      if (msg.item === 'reclamo' && st.claimAt <= t) return { error: 'GACHA_READY' }
      if ((await charge(q, user.id, msg.item === 'tirada' ? EXTRA_ROLL_COST : CLAIM_RESET_COST)) === null) return { error: 'GACHA_FUNDS' }
      // Una tirada extra es una tirada menos gastada (puede quedar por debajo de cero: tendrás más de ROLLS_PER_PERIOD).
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
      worth: list.reduce((sum, c) => sum + c.price, 0),
    }
  }

  // Todos los que tienen cartas, de la colección que más vale a la que menos.
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
          worth: owned.reduce((sum, c) => sum + c.price, 0),
          rarities: Object.fromEntries(Object.keys(RARITY_ORDER).map((r) => [r, owned.filter((c) => c.rarity === r).length])),
          best,
        }
      })
      .sort((a, b) => b.worth - a.worth)
  }

  // Todas las cartas que pueden salir, con su probabilidad en cada tipo de tirada y quién la tiene.
  async function cardList() {
    const { rows } = await db.query(
      `select c.carta, c.usuario_id, a.nombre from public.juegos_gacha_cartas c left join public.juegos_cuentas a on a.usuario_id = c.usuario_id`,
    )
    const owners = new Map(rows.map((r) => [r.carta, { id: r.usuario_id, name: r.nombre ?? '¿?' }]))
    return catalogo.cartas
      .map((c) => ({ ...cardView(c.id), normal: chance('normal', c.rarity), premium: chance('premium', c.rarity), owner: owners.get(c.id) ?? null }))
      .sort((a, b) => b.value - a.value || a.rank - b.rank)
  }

  // Tus cartas con poder, cuándo se puede volver a usar cada una (0: ya) y los efectos que tienes activos.
  async function powers(user, t) {
    const [owned, active] = await Promise.all([
      db.query(`select carta, poder_usado from public.juegos_gacha_cartas where usuario_id = $1`, [user.id]),
      db.query(`select juego, tipo, pct, usos, nombre from public.juegos_gacha_efectos where usuario_id = $1`, [user.id]),
    ])
    const list = owned.rows
      .map((r) => ({ card: cardView(r.carta), readyAt: r.poder_usado ? Math.max(0, ms(r.poder_usado) + POWER_COOLDOWN_MS) : 0 }))
      .filter((p) => p.card?.power)
      .map((p) => ({ ...p, readyAt: p.readyAt > t ? p.readyAt : 0 }))
      .sort((a, b) => b.card.value - a.card.value)
    return { list, active: active.rows.map((r) => ({ game: r.juego, kind: r.tipo, pct: r.pct, uses: r.usos, name: r.nombre })) }
  }

  // Activa el seguro o el premio de una carta para su juego en solitario (uno a la vez por juego).
  async function activate(user, msg, t) {
    const card = cardView(msg.card)
    if (!card?.power) return { error: card ? 'POWER_NONE' : 'BAD_MESSAGE' }
    if (!SOLO_IN[card.power.game]) return { error: 'POWER_GAME' }
    const spent = await spendPower(user.id, card.id, t)
    if (spent.error) return spent
    const { power } = card
    const got = await db.query(
      `insert into public.juegos_gacha_efectos (usuario_id, juego, tipo, pct, usos, nombre, carta) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (usuario_id, juego) do nothing returning juego`,
      [user.id, power.game, power.kind, power.pct, power.uses, power.name, card.id],
    )
    if (got.rows.length === 0) {
      await refundPower(user.id, card.id, spent.before)
      return { error: 'POWER_ACTIVE' }
    }
    return { result: { activated: power.name, game: power.game } }
  }

  // Gasta el poder de una carta tuya (game.mjs lo aplica después en la mesa). Devuelve { card, before } para poder
  // devolverlo con refundPower si al final no se puede aplicar.
  async function spendPower(userId, cardId, t) {
    const card = cardView(cardId)
    if (!card) return { error: 'BAD_MESSAGE' }
    if (!card.power) return { error: 'POWER_NONE' }
    return db.tx(async (q) => {
      const row = (await q(`select poder_usado from public.juegos_gacha_cartas where carta = $1 and usuario_id = $2 for update`, [cardId, userId])).rows[0]
      if (!row) return { error: 'GACHA_NOT_YOURS' }
      if (row.poder_usado && ms(row.poder_usado) + POWER_COOLDOWN_MS > t) return { error: 'POWER_WAIT' }
      await q(`update public.juegos_gacha_cartas set poder_usado = to_timestamp($3 / 1000.0) where carta = $1 and usuario_id = $2`, [cardId, userId, t])
      return { card, before: row.poder_usado }
    })
  }

  async function refundPower(userId, cardId, before) {
    await db.query(`update public.juegos_gacha_cartas set poder_usado = $3 where carta = $1 and usuario_id = $2`, [cardId, userId, before])
  }

  const ACTIONS = { tirar: roll, reclamar: claim, vender: sell, tienda: shop, activar: activate }

  // msg.a: estado | tirar { premium } | reclamar { id } | vender { card } | tienda { item } | coleccion { user } | ranking
  //        | cartas | poderes | activar { card }
  async function handle(user, msg) {
    const t = now()
    const reply = {}
    if (msg.a === 'coleccion') reply.collection = await collection(user, msg)
    else if (msg.a === 'ranking') reply.ranking = await ranking(user)
    else if (msg.a === 'cartas') reply.cards = await cardList()
    else if (msg.a === 'poderes') reply.powers = await powers(user, t)
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

  return { handle, spendPower, refundPower }
}

// Al liquidarse una jugada de un juego en solitario (dentro de su transacción): si hay un seguro o un premio activo
// para ese juego, lo que añade (extra, que puede ser 0) y se gasta un uso. settlement: { stake, net }.
export async function applyEffect(q, userId, game, { stake, net }) {
  if (!(stake > 0)) return null
  const row = (await q(`select tipo, pct, usos, nombre from public.juegos_gacha_efectos where usuario_id = $1 and juego = $2 for update`, [userId, game])).rows[0]
  if (!row) return null
  let extra = 0
  if (row.tipo === 'seguro' && net < 0) extra = Math.round((-net * row.pct) / 100)
  if (row.tipo === 'premio' && net > 0) extra = Math.min(Math.round((net * row.pct) / 100), BONUS_CAP)
  if (row.usos <= 1) await q(`delete from public.juegos_gacha_efectos where usuario_id = $1 and juego = $2`, [userId, game])
  else await q(`update public.juegos_gacha_efectos set usos = usos - 1 where usuario_id = $1 and juego = $2`, [userId, game])
  return { name: row.nombre, kind: row.tipo, extra, left: row.usos - 1 }
}
