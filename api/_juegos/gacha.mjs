// Gacha de Juegos al estilo de Mudae, con políticos españoles. Cada carta tiene como mucho un dueño.
//   - La mesa: cada TABLE_PERIOD_MS sale sola una carta libre, hasta TABLE_MAX a la vista de todos, y cualquiera puede
//     cogerla (una cada TAKE_COOLDOWN_MS por persona).
//   - Tirar pagando: una tirada (ROLL_COST) o una premium (PREMIUM_COST: épica o legendaria) saca una carta libre y su
//     jugador decide si guardarla o descartarla; hasta decidirlo no puede volver a tirar.
// Todo se paga y se cobra con el saldo de la semana (cuenta en el Score): las tiradas, recargar el reclamo
// (CLAIM_RESET_COST, para coger otra carta de la mesa ya) y vender una carta tuya (SELL_RATE € por punto de valor; la
// carta queda libre otra vez).
// Cada carta tiene además un poder para cada juego (powersOf), más fuerte cuanto más rara es: ver cartas en el póker o
// el blackjack (lo aplica game.mjs en la mesa, que ve un aviso en el chat) o un seguro o un premio para las próximas
// jugadas de un juego en solitario (juegos_gacha_efectos, que aplica applyEffect al liquidar cada jugada). Usar un poder
// gasta la carta: deja de ser tuya y vuelve a poder salir para cualquiera (consumePower).
// Las cartas vienen de gacha-catalogo.json (lo genera scripts/gacha/importar.mjs).
import { randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'

// vercel.json incluye el archivo en la función (includeFiles), por si el trazado de dependencias no lo ve.
const catalogo = JSON.parse(readFileSync(new URL('./gacha-catalogo.json', import.meta.url), 'utf8'))

const HOUR = 3600000
export const TABLE_PERIOD_MS = 2 * HOUR
export const TABLE_MAX = 5
export const TAKE_COOLDOWN_MS = 2 * HOUR
// € por punto de valor al vender: común ≈ 700 €, legendaria ≈ 19.000 €. Una tirada (≈ 1.600 € de media al venderla) y
// una premium (≈ 9.500 €) cuestan más de lo que valen, así que tirar y vender no da dinero infinito.
export const SELL_RATE = 20
export const ROLL_COST = 2000
export const PREMIUM_COST = 20000
export const CLAIM_RESET_COST = 5000
export const POWER_COOLDOWN_MS = 24 * HOUR
// Lo más que puede añadir un premio en una jugada.
export const BONUS_CAP = 10000
// Poderes de mesa según la rareza: game.mjs los aplica a la mano en curso.
const TABLE_POWERS = {
  poker: {
    comun: { kind: 'vistazo', name: 'Vistazo', text: 'Ves una carta de un rival al azar durante una mano de póker.' },
    rara: { kind: 'doble', name: 'Doble vistazo', text: 'Ves una carta de dos rivales al azar durante una mano de póker.' },
    epica: { kind: 'chivatazo', name: 'Chivatazo', text: 'Ves las cartas de un rival al azar durante una mano de póker.' },
    mitica: { kind: 'rayos', name: 'Rayos X', text: 'Ves las cartas de todos los jugadores durante una mano de póker.' },
  },
  blackjack: {
    comun: { kind: 'ojeada', name: 'Ojeada', text: 'Ves cuál es la próxima carta del mazo al usarlo, en una mano de blackjack.' },
    rara: { kind: 'mazo', name: 'Mazo marcado', text: 'Ves siempre la próxima carta del mazo durante una mano de blackjack.' },
    epica: { kind: 'crupier', name: 'Ojo del crupier', text: 'Ves la carta tapada del crupier durante una mano de blackjack.' },
    mitica: {
      kind: 'todo',
      name: 'Ojo del crupier y mazo marcado',
      text: 'Ves la carta tapada del crupier y siempre la próxima carta del mazo durante una mano de blackjack.',
    },
  },
}
// Seguros y premios de los juegos en solitario: cuánto y durante cuántas jugadas, según la rareza.
const STRENGTH = { comun: { pct: 25, uses: 1 }, rara: { pct: 50, uses: 1 }, epica: { pct: 100, uses: 1 }, mitica: { pct: 100, uses: 3 } }
const SOLO_IN = { roulette: 'la ruleta', crash: 'el cohete', slots: 'las tragamonedas', plinko: 'el Plinko' }
const SOLO_TITLE = { roulette: 'ruleta', crash: 'cohete', slots: 'tragamonedas', plinko: 'Plinko' }
const SOLO_GAMES = Object.keys(SOLO_IN)
export const POWER_GAMES = ['poker', 'blackjack', ...SOLO_GAMES]
const euros = (n) => `${n.toLocaleString('es-ES')} €`

function soloPower(kind, game, rarity) {
  const { pct, uses } = STRENGTH[rarity]
  const where = uses > 1 ? `tus próximas ${uses} jugadas en ${SOLO_IN[game]}` : `tu próxima jugada en ${SOLO_IN[game]}`
  const times = uses > 1 ? ` ×${uses}` : ''
  const base = { id: `${kind}:${game}`, kind, game, pct, uses }
  if (kind === 'seguro') {
    return { ...base, name: `${pct === 100 ? 'Seguro total' : `Seguro del ${pct} %`}${times}`, text: `Si pierdes en ${where}, te devuelven el ${pct} % de lo perdido.` }
  }
  return {
    ...base,
    name: `${pct === 100 ? 'Premio doble' : `Premio +${pct} %`}${times}`,
    text: `Si ganas en ${where}, cobras un ${pct} % más de lo ganado (hasta ${euros(BONUS_CAP)} por jugada).`,
  }
}

// Los seis poderes de una carta: los de mesa, según su rareza; en cada juego en solitario, seguro o premio según los
// bits de su posición dentro de su rareza, así que dos cartas de la misma rareza no tienen la misma combinación.
function powersFor(rarity, index) {
  const powers = {}
  for (const game of ['poker', 'blackjack']) powers[game] = { id: TABLE_POWERS[game][rarity].kind, game, ...TABLE_POWERS[game][rarity] }
  SOLO_GAMES.forEach((game, bit) => {
    powers[game] = soloPower((index >> bit) & 1 ? 'premio' : 'seguro', game, rarity)
  })
  return powers
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
  GACHA_TAKEN: '¡Tarde! Otra persona la cogió antes.',
  GACHA_COOLDOWN: 'Todavía no puedes coger otra carta: espera a que se recargue tu reclamo.',
  GACHA_OWNED: 'Esa carta ya tiene dueño.',
  GACHA_FUNDS: 'No te llega el saldo de la semana.',
  GACHA_NOT_YOURS: 'Esa carta no es tuya.',
  GACHA_READY: 'Tu reclamo ya está listo.',
  GACHA_PENDING: 'Primero decide si guardas o descartas la carta que sacaste.',
  GACHA_NO_PENDING: 'No tienes ninguna carta por decidir.',
  GACHA_UPDATE: 'El gacha ha cambiado: recarga la página.',
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
const powersOf = new Map()
for (const [rarity, list] of byRarity) {
  ;[...list].sort((a, b) => a.rank - b.rank).forEach((c, i) => powersOf.set(c.id, powersFor(rarity, i)))
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
    powers: powersOf.get(c.id),
    // Probabilidad (en %) de que te toque esta carta en una tirada normal y en una premium.
    odds: { normal: chance('normal', c.rarity), premium: chance('premium', c.rarity) },
  }
}

function pick(list) {
  return list[randomInt(list.length)]
}

// Primero la rareza y después una carta libre de esa rareza. taken: cartas que no pueden salir (con dueño, en la mesa o
// pendientes de que alguien decida si se las queda).
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

// Periodo de la mesa: sale una carta en cada uno.
const periodOf = (t) => Math.floor(t / TABLE_PERIOD_MS)
const ms = (value) => (value instanceof Date ? value.getTime() : Number(value))

// db: { query, tx } · ping(topic, event) avisa por Realtime · charge(q, userId, amount): cobra del saldo de la semana
// (o paga, si amount es negativo) dentro de la transacción y devuelve el saldo nuevo, o null si no llega.
export function createGacha({ db, ping, now, charge }) {
  // Estado del jugador, bloqueado para la transacción.
  async function player(q, userId) {
    await q(`insert into public.juegos_gacha_jugadores (usuario_id) values ($1) on conflict (usuario_id) do nothing`, [userId])
    const row = (await q(`select reclamo_listo, pendiente, pendiente_premium from public.juegos_gacha_jugadores where usuario_id = $1 for update`, [userId]))
      .rows[0]
    return { claimAt: ms(row.reclamo_listo), pending: row.pendiente, pendingPremium: row.pendiente_premium }
  }

  // Cartas que no pueden salir: con dueño, en la mesa o pendientes de decisión.
  async function takenCards(q) {
    const { rows } = await q(
      `select carta from public.juegos_gacha_cartas union select carta from public.juegos_gacha_mesa
       union select pendiente from public.juegos_gacha_jugadores where pendiente is not null`,
    )
    return new Set(rows.map((r) => r.carta))
  }

  async function log(q, type, userId, cardId, premium, t) {
    const { rows } = await q(
      `insert into public.juegos_gacha_tiradas (tipo, usuario_id, carta, premium, creada) values ($1, $2, $3, $4, to_timestamp($5 / 1000.0)) returning id`,
      [type, userId, cardId, premium, t],
    )
    if (Number(rows[0].id) % 50 === 0) await q(`delete from public.juegos_gacha_tiradas where creada < now() - make_interval(days => $1)`, [KEEP_DAYS])
  }

  // Repone la mesa: una carta por cada periodo que pasó desde la última vez, sin pasar de TABLE_MAX. La primera vez sale
  // una. Cada instancia recuerda el último periodo que comprobó, así que casi siempre no consulta nada.
  let checkedPeriod = null
  async function refill(t) {
    const period = periodOf(t)
    if (checkedPeriod === period) return
    const added = await db.tx(async (q) => {
      await q(`insert into public.juegos_gacha_estado (id, periodo) values (1, $1) on conflict (id) do nothing`, [period - 1])
      const last = Number((await q(`select periodo from public.juegos_gacha_estado where id = 1 for update`)).rows[0].periodo)
      if (last >= period) return 0
      const open = (await q(`select count(*)::int as n from public.juegos_gacha_mesa`)).rows[0].n
      const count = Math.min(period - last, TABLE_MAX - open)
      const taken = await takenCards(q)
      for (let i = 0; i < count; i++) {
        const card = draw(false, taken)
        taken.add(card.id)
        await q(`insert into public.juegos_gacha_mesa (carta, periodo, creada) values ($1, $2, to_timestamp($3 / 1000.0))`, [card.id, period, t])
        await log(q, 'mesa', null, card.id, false, t)
      }
      await q(`update public.juegos_gacha_estado set periodo = $1 where id = 1`, [period])
      return count
    })
    checkedPeriod = period
    if (added > 0) await ping('juegos-gacha', 'tirada')
  }

  // Sin bloqueo: para pintar la pantalla.
  async function readState(userId, t) {
    const [row, owned, table] = await Promise.all([
      db.query(`select reclamo_listo, pendiente, pendiente_premium from public.juegos_gacha_jugadores where usuario_id = $1`, [userId]).then((r) => r.rows[0]),
      db.query(`select count(*)::int as n from public.juegos_gacha_cartas where usuario_id = $1`, [userId]).then((r) => r.rows[0].n),
      db.query(`select id, carta, creada from public.juegos_gacha_mesa order by id`).then((r) => r.rows),
    ])
    const claimAt = row ? ms(row.reclamo_listo) : 0
    const full = table.length >= TABLE_MAX
    return {
      now: t,
      table: table.map((r) => ({ id: Number(r.id), card: cardView(r.carta), at: ms(r.creada) })).filter((x) => x.card),
      tableMax: TABLE_MAX,
      nextDropAt: full ? 0 : (periodOf(t) + 1) * TABLE_PERIOD_MS,
      claimAt: claimAt > t ? claimAt : 0,
      pending: row?.pendiente ? { card: cardView(row.pendiente), premium: row.pendiente_premium } : null,
      owned,
      prices: { roll: ROLL_COST, premium: PREMIUM_COST, claimReset: CLAIM_RESET_COST, sellRate: SELL_RATE },
    }
  }

  // El canal: lo último que ha pasado (salió en la mesa, alguien la cogió, alguien la sacó pagando y se la quedó).
  async function feed(userId) {
    const { rows } = await db.query(
      `select t.id, t.tipo, t.usuario_id, t.carta, t.premium, t.creada, u.nombre, u.avatar
       from public.juegos_gacha_tiradas t left join public.juegos_cuentas u on u.usuario_id = t.usuario_id
       order by t.id desc limit $1`,
      [FEED_SIZE],
    )
    return rows
      .map((r) => {
        const card = cardView(r.carta)
        if (!card) return null
        const by = r.usuario_id ? { id: r.usuario_id, name: r.nombre ?? '¿?', avatar: r.avatar ?? null, me: r.usuario_id === userId } : null
        return { id: Number(r.id), type: r.tipo, card, by, premium: r.premium, at: ms(r.creada) }
      })
      .filter(Boolean)
  }

  // Tirar pagando: sale una carta libre y queda pendiente hasta que decidas si la guardas.
  async function roll(user, msg, t) {
    if (msg.pago !== true) return { error: 'GACHA_UPDATE' }
    const premium = msg.premium === true
    return db.tx(async (q) => {
      const st = await player(q, user.id)
      if (st.pending) return { error: 'GACHA_PENDING' }
      if ((await charge(q, user.id, premium ? PREMIUM_COST : ROLL_COST)) === null) return { error: 'GACHA_FUNDS' }
      const card = draw(premium, await takenCards(q))
      await q(`update public.juegos_gacha_jugadores set pendiente = $2, pendiente_premium = $3 where usuario_id = $1`, [user.id, card.id, premium])
      return { result: { card: cardView(card.id), premium } }
    })
  }

  // Guardar (va a tu biblioteca) o descartar (queda libre) la carta que sacaste pagando.
  async function decide(user, msg, t) {
    const out = await db.tx(async (q) => {
      const st = await player(q, user.id)
      if (!st.pending) return { error: 'GACHA_NO_PENDING' }
      await q(`update public.juegos_gacha_jugadores set pendiente = null, pendiente_premium = false where usuario_id = $1`, [user.id])
      if (msg.keep !== true) return { result: { kept: false, card: cardView(st.pending) } }
      const got = await q(`insert into public.juegos_gacha_cartas (carta, usuario_id) values ($1, $2) on conflict (carta) do nothing returning carta`, [st.pending, user.id])
      if (got.rows.length === 0) return { error: 'GACHA_OWNED' }
      await log(q, 'guardada', user.id, st.pending, st.pendingPremium, t)
      return { result: { kept: true, card: cardView(st.pending) } }
    })
    if (out.result?.kept) await ping('juegos-gacha', 'tirada')
    return out
  }

  // Coger una carta de la mesa: el primero que llega se la queda; después hay que esperar TAKE_COOLDOWN_MS.
  async function take(user, msg, t) {
    if (!Number.isSafeInteger(msg.id)) return { error: 'BAD_MESSAGE' }
    const out = await db.tx(async (q) => {
      const row = (await q(`select carta from public.juegos_gacha_mesa where id = $1 for update`, [msg.id])).rows[0]
      if (!row) return { error: 'GACHA_TAKEN' }
      const st = await player(q, user.id)
      if (st.claimAt > t) return { error: 'GACHA_COOLDOWN' }
      const got = await q(`insert into public.juegos_gacha_cartas (carta, usuario_id) values ($1, $2) on conflict (carta) do nothing returning carta`, [row.carta, user.id])
      if (got.rows.length === 0) return { error: 'GACHA_OWNED' }
      await q(`delete from public.juegos_gacha_mesa where id = $1`, [msg.id])
      await q(`update public.juegos_gacha_jugadores set reclamo_listo = to_timestamp($2 / 1000.0) where usuario_id = $1`, [user.id, t + TAKE_COOLDOWN_MS])
      await log(q, 'cogida', user.id, row.carta, false, t)
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

  // Tienda: tener el reclamo listo ya (para coger otra carta de la mesa). Se paga con el saldo de la semana.
  async function shop(user, msg, t) {
    if (msg.item !== 'reclamo') return { error: 'BAD_MESSAGE' }
    return db.tx(async (q) => {
      const st = await player(q, user.id)
      if (st.claimAt <= t) return { error: 'GACHA_READY' }
      if ((await charge(q, user.id, CLAIM_RESET_COST)) === null) return { error: 'GACHA_FUNDS' }
      await q(`update public.juegos_gacha_jugadores set reclamo_listo = 'epoch' where usuario_id = $1`, [user.id])
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
  async function cardList(user) {
    const { rows } = await db.query(
      `select c.carta, c.usuario_id, a.nombre, a.avatar from public.juegos_gacha_cartas c left join public.juegos_cuentas a on a.usuario_id = c.usuario_id`,
    )
    const owners = new Map(rows.map((r) => [r.carta, { id: r.usuario_id, name: r.nombre ?? '¿?', avatar: r.avatar ?? null, me: r.usuario_id === user.id }]))
    return catalogo.cartas
      .map((c) => ({ ...cardView(c.id), normal: chance('normal', c.rarity), premium: chance('premium', c.rarity), owner: owners.get(c.id) ?? null }))
      .sort((a, b) => b.value - a.value || a.rank - b.rank)
  }

  // Cada poder de tus cartas (uno por carta y juego), cuándo se puede volver a usar (0: ya) y tus efectos activos.
  async function powers(user, t) {
    const [owned, active] = await Promise.all([
      db.query(`select carta, poderes_usados from public.juegos_gacha_cartas where usuario_id = $1`, [user.id]),
      db.query(`select juego, tipo, pct, usos, nombre from public.juegos_gacha_efectos where usuario_id = $1`, [user.id]),
    ])
    const list = []
    for (const row of owned.rows) {
      const card = cardView(row.carta)
      if (!card) continue
      for (const game of POWER_GAMES) {
        const used = Number(row.poderes_usados?.[game] ?? 0)
        const readyAt = used ? used + POWER_COOLDOWN_MS : 0
        list.push({ card, game, power: card.powers[game], readyAt: readyAt > t ? readyAt : 0 })
      }
    }
    list.sort((a, b) => b.card.value - a.card.value)
    return { list, active: active.rows.map((r) => ({ game: r.juego, kind: r.tipo, pct: r.pct, uses: r.usos, name: r.nombre })) }
  }

  // Activa el seguro o el premio de una carta en un juego en solitario (uno a la vez por juego).
  async function activate(user, msg, t) {
    if (!SOLO_IN[msg.game]) return { error: 'POWER_GAME' }
    const spent = await spendPower(user.id, msg.card, msg.game, t)
    if (spent.error) return spent
    const { power } = spent
    const got = await db.query(
      `insert into public.juegos_gacha_efectos (usuario_id, juego, tipo, pct, usos, nombre, carta) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (usuario_id, juego) do nothing returning juego`,
      [user.id, msg.game, power.kind, power.pct, power.uses, `${power.name} · ${SOLO_TITLE[msg.game]}`, spent.card.id],
    )
    if (got.rows.length === 0) {
      await refundPower(user.id, spent.card.id, msg.game, spent.before)
      return { error: 'POWER_ACTIVE' }
    }
    await consumePower(user.id, spent.card.id, t)
    return { result: { activated: power.name, game: msg.game } }
  }

  // Gasta el poder de una carta tuya en un juego (game.mjs lo aplica después en la mesa). Devuelve { card, power, before }
  // para poder devolverlo con refundPower si al final no se puede aplicar.
  async function spendPower(userId, cardId, game, t) {
    const card = cardView(cardId)
    if (!card) return { error: 'BAD_MESSAGE' }
    const power = card.powers[game]
    if (!power) return { error: 'POWER_GAME' }
    return db.tx(async (q) => {
      const row = (await q(`select poderes_usados from public.juegos_gacha_cartas where carta = $1 and usuario_id = $2 for update`, [cardId, userId])).rows[0]
      if (!row) return { error: 'GACHA_NOT_YOURS' }
      const before = row.poderes_usados?.[game] ?? null
      if (before && Number(before) + POWER_COOLDOWN_MS > t) return { error: 'POWER_WAIT' }
      await q(`update public.juegos_gacha_cartas set poderes_usados = poderes_usados || jsonb_build_object($3::text, $4::bigint) where carta = $1 and usuario_id = $2`, [
        cardId,
        userId,
        game,
        t,
      ])
      return { card, power, before }
    })
  }

  // Usar el poder gasta la carta: sale de tu biblioteca y queda libre para que le toque a otro.
  async function consumePower(userId, cardId, t) {
    const gone = await db.tx(async (q) => {
      const { rows } = await q(`delete from public.juegos_gacha_cartas where carta = $1 and usuario_id = $2 returning carta`, [cardId, userId])
      if (rows.length) await log(q, 'usada', userId, cardId, false, t)
      return rows.length > 0
    })
    if (gone) await ping('juegos-gacha', 'tirada')
  }

  async function refundPower(userId, cardId, game, before) {
    if (before === null) {
      await db.query(`update public.juegos_gacha_cartas set poderes_usados = poderes_usados - $3::text where carta = $1 and usuario_id = $2`, [cardId, userId, game])
    } else {
      await db.query(`update public.juegos_gacha_cartas set poderes_usados = poderes_usados || jsonb_build_object($3::text, $4::bigint) where carta = $1 and usuario_id = $2`, [
        cardId,
        userId,
        game,
        before,
      ])
    }
  }

  const ACTIONS = { tirar: roll, decidir: decide, coger: take, vender: sell, tienda: shop, activar: activate }

  // msg.a: estado | tirar { pago, premium } | decidir { keep } | coger { id } | vender { card } | tienda { item }
  //        | coleccion { user } | ranking
  //        | cartas | poderes | activar { card, game }
  async function handle(user, msg) {
    const t = now()
    const reply = {}
    await refill(t)
    if (msg.a === 'coleccion') reply.collection = await collection(user, msg)
    else if (msg.a === 'ranking') reply.ranking = await ranking(user)
    else if (msg.a === 'cartas') reply.cards = await cardList(user)
    else if (msg.a === 'poderes') reply.powers = await powers(user, t)
    else if (Object.hasOwn(ACTIONS, msg.a)) {
      const out = await ACTIONS[msg.a](user, msg, t)
      if (out.error) reply.error = out.error
      else reply.result = out.result
    } else if (msg.a !== 'estado') reply.error = 'BAD_MESSAGE'
    const [state, list] = await Promise.all([readState(user.id, now()), feed(user.id)])
    reply.state = state
    reply.feed = list
    return reply
  }

  return { handle, spendPower, refundPower, consumePower }
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
