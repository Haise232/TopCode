// Juegos de TopCode sin servidor propio: cada petición carga la mesa de Postgres con bloqueo (FOR UPDATE),
// le aplica la acción con el mismo motor que la sección de juegos original y la guarda. Los temporizadores (turnos, crupier)
// quedan anotados en la mesa y los dispara la primera petición que llegue después de que venzan (los navegadores
// mandan «tick» a tiempo). Tras cada cambio se avisa por Supabase Realtime y cada jugador pide su propia vista:
// así nadie recibe las cartas tapadas de los demás.
import { randomInt } from 'node:crypto'
import { Room } from './engine/room.mjs'
import { PokerRoom } from './engine/poker-room.mjs'
import { storedTimers } from './engine/timers.mjs'
import { weekOf } from './engine/week.mjs'
import { PUBLIC_SEATS, GAMES, nextNumber, pickTable } from './engine/lobby.mjs'
import { SCHEMA_SQL } from './schema.mjs'
import { SOLO_GAMES, SOLO_PLAY, crashDue, crashView, crashWaitMs, raceDue, raceView, rouletteDue, rouletteView } from './solo.mjs'
import { GACHA_ERRORS, applyEffect, cardView, createGacha } from './gacha.mjs'

// Alta: 10, figura o as. Para las pistas de los poderes del gacha.
const SUIT_MARK = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
const highLow = (card) => (['10', 'J', 'Q', 'K', 'A'].includes(card.rank) ? 'alta' : 'baja')
const cardName = (card) => `${card.rank}${SUIT_MARK[card.suit] ?? ''}`

export const STARTING_BALANCE = 10000
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_PUBLIC_PER_GAME = 6
const AWAY_MS = 45000 // sin noticias del navegador: se le da por desconectado
const GONE_MS = 3 * 60000 // y pasado este rato, fuera de la mesa
const SEEN_SAVE_MS = 15000 // el latido se guarda aunque la mesa no cambie, como mucho una vez cada este rato
const ONLINE_MS = 60000
const TOUCH_S = 20
const CHAT_KEEP = 50
const CHAT_GAP_MS = 700
const CRASH_WAIT_MAX_MS = 20000 // el vuelo más largo del cohete dura 18 s
const CRASH_WAIT_PAD_MS = 25
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const POKER_LIVE = new Set(['preflop', 'flop', 'turn', 'river'])
const MAX_SCORES = 200
const NO_DAYS = [null, null, null, null, null, null, null]
// Array de Postgres como texto ({NULL,9000,…}): igual con cualquier driver.
const pgArray = (values) => `{${values.map((v) => (Number.isFinite(v) ? Math.round(v) : 'NULL')).join(',')}}`
// Días de la semana leídos de la BD (según el driver, los vacíos llegan como null o como 'NULL').
const readDays = (dias) =>
  Array.from({ length: 7 }, (_, i) => {
    const value = Array.isArray(dias) ? dias[i] : null
    return value === null || value === undefined || value === 'NULL' ? null : Number(value)
  })

export const ERRORS = {
  BAD_MESSAGE: 'Mensaje no válido.',
  BAD_PHASE: 'No puedes hacer eso ahora.',
  NOT_YOUR_TURN: 'No es tu turno.',
  INSUFFICIENT_FUNDS: 'Saldo insuficiente.',
  BETS_CLOSED: 'No va más: la bola ya está en marcha. Apuesta en la siguiente ronda.',
  LAUNCHED: 'El cohete ya despegó: apuesta en la siguiente ronda.',
  CRASHED: '¡Tarde! El cohete ya explotó.',
  SEAT_TAKEN: 'Ese asiento está ocupado.',
  NOT_HOST: 'Las mesas públicas no tienen anfitrión.',
  ROOM_NOT_FOUND: 'Esa mesa ya no existe.',
  ROOM_FULL: 'Todas las mesas están llenas. Prueba a mirar.',
  RATE_LIMIT: 'Vas demasiado rápido.',
  BUSY: 'La mesa está muy concurrida, inténtalo de nuevo.',
  BROKE: 'Te quedaste sin saldo esta semana: el domingo a las 23:59 todos vuelven a empezar con 10.000 €.',
  AUTH_REQUIRED: 'Inicia sesión en TopCode.',
  AUTH_INVALID: 'Tu sesión de TopCode caducó. Recarga la página.',
  AUTH_PENDING: 'Tu cuenta de TopCode aún no está aprobada.',
  AUTH_DOWN: 'No se pudo comprobar tu sesión. Reintentando…',
  ...GACHA_ERRORS,
}

export class JuegosError extends Error {
  constructor(code) {
    super(ERRORS[code] ?? code)
    this.code = code
  }
}

const ROOM_STATIC = new Set(['accounts', 'randomInt', 'onClose', 'now', 'timers', 'timer', 'sweeper', 'members'])

// --- saldos dentro de una transacción: el motor usa get/adjust como con el archivo de juegos original ---

class TxAccounts {
  constructor(rows, day) {
    this.day = day
    this.map = new Map(rows.map((r) => [r.usuario_id, { balance: Number(r.saldo), days: readDays(r.dias), played: r.jugado }]))
    this.dirty = new Set()
  }
  get(token) {
    return this.map.get(token)
  }
  adjust(token, delta) {
    const acc = this.map.get(token)
    if (!acc) return
    acc.balance += delta
    acc.days[this.day] = acc.balance
    acc.played = true
    this.dirty.add(token)
  }
}

// --- mesa <-> JSON ---

function serialize(room) {
  const data = {}
  for (const [key, value] of Object.entries(room)) if (!ROOM_STATIC.has(key)) data[key] = value
  const members = [...room.members.values()].map(({ id, token, name, avatar, seat, seen, away }) => ({ id, token, name, avatar, seat, seen, away }))
  return { room: data, members }
}

function restore(row, accounts, now) {
  const Kind = row.juego === 'poker' ? PokerRoom : Room
  const room = Object.create(Kind.prototype)
  Object.assign(room, row.estado.room, { accounts, randomInt, now, timers: storedTimers, timer: null, onClose: null })
  room.members = new Map()
  for (const m of row.estado.members) room.members.set(m.id, { ...m, ws: null, room })
  return room
}

function tokensOf(estado) {
  const tokens = new Set(estado.members.map((m) => m.token))
  for (const seat of estado.room.seats) if (seat) tokens.add(seat.token)
  return tokens
}

// Asientos tal y como los verá quien entre ahora: quien lleva más de GONE_MS sin dar señales sale al abrir la mesa
// (null) y quien lleva más de AWAY_MS se marca como ausente. Así el selector no muestra fantasmas.
function liveSeats(estado, now) {
  const seen = new Map(estado.members.map((m) => [m.id, m.seen]))
  return estado.room.seats.map((seat) => {
    if (!seat) return null
    const idle = seen.has(seat.sid) ? now - seen.get(seat.sid) : Infinity
    if (idle > GONE_MS) return null
    return { ...seat, away: idle > AWAY_MS }
  })
}

// Resumen de una mesa para el selector (sin abrirla).
function summary(row, now) {
  const { room, members } = row.estado
  const seated = liveSeats(row.estado, now).filter(Boolean)
  const present = seated.filter((seat) => !seat.away)
  return {
    code: row.codigo,
    game: row.juego,
    label: row.etiqueta,
    seats: room.seats.length,
    players: present.length,
    away: seated.length - present.length,
    spectators: members.filter((m) => m.seat === null && now - m.seen < AWAY_MS).length,
    people: present.map((seat) => ({ name: seat.name, avatar: seat.avatar ?? null })),
    phase: room.phase,
  }
}

function newCode(taken) {
  for (let i = 0; i < 50; i++) {
    const code = Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')
    if (!taken.has(code)) return code
  }
  throw new JuegosError('ROOM_FULL')
}

const cleanText = (value) =>
  typeof value === 'string'
    ? [...value]
        .filter((ch) => ch >= ' ')
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
    : ''

// db: { query(sql, params), tx(fn) } · ping(topic) avisa por Realtime · now() reloj · secret: semilla de la ruleta en vivo
export function createJuegos({ db, ping = async () => {}, now = Date.now, secret = 'topcode-juegos' }) {
  let schemaReady = null
  let knownWeek = null

  function ensureSchema() {
    schemaReady ??= (async () => {
      // La tabla más nueva: si falta, se ejecuta el esquema entero (es idempotente).
      const { rows } = await db.query(`select to_regclass('public.juegos_gacha_mesa') is not null as ok`)
      if (!rows[0].ok) await db.query(SCHEMA_SQL)
      await db.query(`insert into public.juegos_meta (id, semana) values (1, $1) on conflict (id) do nothing`, [weekOf(now()).key])
      await refundSoloBlackjack()
    })().catch((error) => {
      schemaReady = null
      throw error
    })
    return schemaReady
  }

  // El blackjack en solitario ya no existe (lo sustituye Plinko): una mano que se quedó a medias ya no se puede terminar,
  // así que se devuelve lo apostado en ella y se borra. Las partidas de semanas pasadas ya las borró el reinicio, y tras
  // la primera vez no queda ninguna fila: en cada arranque es una consulta que no encuentra nada.
  async function refundSoloBlackjack() {
    await db.tx(async (q) => {
      const { rows } = await q(`select usuario_id, estado from public.juegos_solo where juego = 'blackjack' for update`)
      for (const { usuario_id: id, estado } of rows) {
        const stake = estado?.phase && estado.phase !== 'idle' ? (estado.hands ?? []).reduce((sum, hand) => sum + (hand.bet ?? 0), 0) : 0
        if (stake > 0) await q(`update public.juegos_cuentas set saldo = saldo + $2 where usuario_id = $1`, [id, stake])
      }
      if (rows.length) await q(`delete from public.juegos_solo where juego = 'blackjack'`)
    })
  }

  // Domingo 23:59: se guarda el podio y todos vuelven a 10.000 €.
  async function rollover(week) {
    if (knownWeek === week.key) return
    const { rows } = await db.query(`select semana from public.juegos_meta where id = 1`)
    if (rows[0]?.semana !== week.key) {
      await db.tx(async (q) => {
        const meta = (await q(`select semana, semana_pasada from public.juegos_meta where id = 1 for update`)).rows[0]
        if (meta.semana === week.key) return
        const podium = (
          await q(`select nombre as name, avatar, saldo as balance from public.juegos_cuentas where jugado order by saldo desc, nombre limit 3`)
        ).rows
        const lastWeek = podium.length ? { week: meta.semana, podium } : meta.semana_pasada
        await q(`update public.juegos_meta set semana = $1, semana_pasada = $2 where id = 1`, [week.key, lastWeek])
        await q(`update public.juegos_cuentas set saldo = $1, dias = $2::bigint[], jugado = false`, [STARTING_BALANCE, pgArray(NO_DAYS)])
        await q(`delete from public.juegos_chat where creado < now() - interval '7 days'`)
        await q(`delete from public.juegos_solo`)
      })
      await ping('juegos-lobby')
    }
    knownWeek = week.key
  }

  // Cuenta del jugador. «visto» (para el contador de conectados) se escribe como mucho cada TOUCH_S. Una lectura ligera
  // basta casi siempre; solo se escribe si la cuenta es nueva, pasaron TOUCH_S o cambió el nombre o el avatar.
  async function touchAccount(user) {
    const { rows } = await db.query(
      `select saldo, mesa, nombre, avatar, visto < now() - make_interval(secs => $2::int) as viejo
       from public.juegos_cuentas where usuario_id = $1`,
      [user.id, TOUCH_S],
    )
    const row = rows[0]
    if (row && !row.viejo && row.nombre === user.name && (row.avatar ?? null) === (user.avatar ?? null)) return { saldo: row.saldo, mesa: row.mesa }
    const written = await db.query(
      `insert into public.juegos_cuentas (usuario_id, nombre, avatar) values ($1, $2, $3)
       on conflict (usuario_id) do update set nombre = excluded.nombre, avatar = excluded.avatar, visto = now()
       returning saldo, mesa`,
      [user.id, user.name, user.avatar],
    )
    return written.rows[0]
  }

  // Lo que el selector enseña de una mesa, como texto para comparar antes y después de una jugada.
  function lobbyKey(code, row, estado, t) {
    return JSON.stringify(summary({ codigo: code, juego: row.juego, etiqueta: row.etiqueta, estado }, t))
  }

  // Abre la mesa con bloqueo, aplica fn(room, session) y la guarda si cambió algo.
  async function withTable(code, user, fn) {
    const t = now()
    const week = weekOf(t)
    const outcome = await db.tx(async (q) => {
      const row = (await q(`select * from public.juegos_mesas where codigo = $1 for update`, [code])).rows[0]
      if (!row) throw new JuegosError('ROOM_NOT_FOUND')
      const lobbyBefore = lobbyKey(code, row, row.estado, t) // antes de restaurar: el motor puede tocar los asientos en su sitio
      const tokens = tokensOf(row.estado)
      tokens.add(user.id)
      const accRows = (
        await q(`select usuario_id, saldo, dias, jugado from public.juegos_cuentas where usuario_id = any($1::uuid[]) order by usuario_id for update`, [[...tokens]])
      ).rows
      const accounts = new TxAccounts(accRows, week.day)
      const room = restore(row, accounts, () => now())
      const revBefore = room.rev
      let presence = false

      // Presencia: quien no da señales se marca ausente y, pasado un rato, sale de la mesa.
      const gone = []
      for (const member of [...room.members.values()]) {
        if (member.id === user.id) continue
        const idle = t - member.seen
        if (idle > GONE_MS) {
          room.leave(member)
          gone.push(member.id)
          presence = true
        } else if (idle > AWAY_MS && !member.away) {
          member.away = true
          room.disconnect(member)
          presence = true
        }
      }

      let session = room.members.get(user.id)
      // Latido: si lo guardado ya es viejo se escribe aunque no cambie nada más, para que quien espera solo no
      // parezca ausente cuando llegue otra persona.
      const touch = Boolean(session && t - session.seen > SEEN_SAVE_MS)
      if (session) {
        Object.assign(session, { name: user.name, avatar: user.avatar, seen: t })
        if (session.away) {
          session.away = false
          room.reconnect(session)
        }
      } else {
        session = { id: user.id, token: user.id, name: user.name, avatar: user.avatar, ws: null, room: null, seat: null, seen: t, away: false }
      }
      const wasIn = room.members.has(user.id)
      room.wake()
      const error = fn(room, session) ?? null

      const changed = room.rev !== revBefore || presence
      let saved = null
      if (changed || touch) {
        saved = serialize(room)
        await q(`update public.juegos_mesas set estado = $2, version = version + 1, actualizado = now() where codigo = $1`, [code, saved])
        for (const token of accounts.dirty) {
          const acc = accounts.get(token)
          await q(`update public.juegos_cuentas set saldo = $2, dias = $3::bigint[], jugado = $4 where usuario_id = $1`, [token, acc.balance, pgArray(acc.days), acc.played])
        }
      }
      if (gone.length) await q(`update public.juegos_cuentas set mesa = null where usuario_id = any($1::uuid[]) and mesa = $2`, [gone, code])
      const inRoom = room.members.has(user.id)
      if (inRoom !== wasIn) await q(`update public.juegos_cuentas set mesa = $2 where usuario_id = $1`, [user.id, inRoom ? code : null])
      // Mesas extra vacías: se borran (la «Mesa 1» de cada juego se queda siempre).
      let deleted = false
      if (!row.persistente && room.members.size === 0 && room.seats.every((s) => !s)) {
        await q(`delete from public.juegos_mesas where codigo = $1`, [code])
        deleted = true
      }
      // El selector solo muestra asientos, presencia, fase y mirones: si eso no cambió no hace falta avisarle.
      const lobbyChanged = deleted || (saved !== null && lobbyKey(code, row, saved, t) !== lobbyBefore)
      return { error, changed, lobbyChanged, code, balance: accounts.get(user.id)?.balance, view: inRoom ? viewFor(room, user.id) : null }
    })
    // Ya con el commit hecho se avisa, sin esperar: quien llama lo espera (outcome.sent) junto a sus otras consultas.
    // Nunca rechaza: si el aviso falla, los clientes se ponen al día con su latido.
    if (outcome.changed) {
      outcome.sent = Promise.all([ping(`juegos-mesa-${code}`), outcome.lobbyChanged ? ping('juegos-lobby') : null]).catch(() => {})
    }
    return outcome
  }

  // Vista sin bloquear la mesa, para los latidos y los «tick» que llegan cuando no hay nada que hacer. Devuelve null
  // si hay que abrirla con bloqueo: un temporizador vencido, alguien a quien marcar como ausente o sacar, tu propio
  // latido por guardar, o si no estás en la mesa.
  async function peekTable(code, user) {
    const t = now()
    const row = (await db.query(`select * from public.juegos_mesas where codigo = $1`, [code])).rows[0]
    if (!row) return null
    const me = row.estado.members.find((m) => m.id === user.id)
    if (!me || me.away || t - me.seen > SEEN_SAVE_MS) return null
    if (row.estado.room.pending && row.estado.room.pending.at <= t) return null
    for (const m of row.estado.members) {
      const idle = t - m.seen
      if (m.id !== user.id && (idle > GONE_MS || (idle > AWAY_MS && !m.away))) return null
    }
    const tokens = [...tokensOf(row.estado)]
    const accRows = (await db.query(`select usuario_id, saldo, dias, jugado from public.juegos_cuentas where usuario_id = any($1::uuid[])`, [tokens])).rows
    const accounts = new TxAccounts(accRows, weekOf(t).day)
    const room = restore(row, accounts, () => now())
    return { error: null, changed: false, balance: accounts.get(user.id)?.balance, view: viewFor(room, user.id) }
  }

  // Poder del gacha activo en la mano en curso: room.peeks[usuario] = { hand, seats: 'all' | [asientos], power, card }.
  // Se guarda con la mesa (serialize copia todo lo que no es del motor) y solo cambia la vista de quien lo usó.
  // Póker: picks = 'all' o [{ seat, card }] (card: índice de la carta, o null para ver las dos).
  // Blackjack: dealer (ves la carta tapada), live (siempre la próxima del mazo) o next (la que era al usarlo).
  // Las cartas de la mesa del póker que faltan por salir, en orden: el motor quema una antes de cada calle y las saca
  // del final del mazo (pop).
  function futureBoard(room) {
    const streets = { preflop: [3, 1, 1], flop: [1, 1], turn: [1] }[room.phase] ?? []
    const out = []
    let i = room.deck.length - 1
    for (const n of streets) {
      i-- // quemada
      for (let k = 0; k < n && i >= 0; k++, i--) out.push(room.deck[i])
    }
    return out
  }

  function applyPeek(room, userId, state) {
    const peek = room.peeks?.[userId]
    if (!peek) return
    let extra = null
    if (room.game === 'blackjack') {
      if (peek.hand !== room.round || room.phase !== 'playing') return
      if (peek.dealer) state.dealer = [...room.dealer]
      if (peek.live) state.nextCard = room.shoe.at(-1) ?? null
      else if (peek.next) state.nextCard = peek.next
      const hints = []
      if (peek.hole && room.dealer[1]) hints.push(`La tapada del crupier es ${highLow(room.dealer[1])}`)
      if (peek.nextHint && room.shoe.length) hints.push(`La próxima carta del mazo es ${highLow(room.shoe.at(-1))}`)
      if (hints.length) extra = hints.join(' · ')
    } else {
      if (peek.hand !== room.hand || !POKER_LIVE.has(room.phase)) return
      state.seats.forEach((seat, i) => {
        const real = room.seats[i]
        if (!seat || !real || real.sid === userId) return
        if (peek.picks === 'all') return void (seat.cards = real.cards)
        for (const pick of peek.picks ?? []) {
          if (pick.seat !== i) continue
          seat.cards = pick.card === null ? real.cards : seat.cards.map((c, k) => (k === pick.card ? real.cards[k] : c))
        }
      })
      const coming = peek.board ? futureBoard(room) : []
      if (coming.length) {
        if (peek.board === 'hint') extra = `La próxima carta de la mesa es ${highLow(coming[0])}`
        else if (peek.board === 'next') extra = `Próxima carta de la mesa: ${cardName(coming[0])}`
        else extra = `Faltan por salir: ${coming.map(cardName).join(' ')}`
      }
    }
    state.peek = { power: peek.power, card: peek.cardName, text: peek.text, extra }
  }

  // Lo que ve toda la mesa: quién está usando un poder en esta mano, cuál y con qué carta (la animación y la carta junto
  // a su foto). Lo que descubre cada poder solo lo ve quien lo usó (applyPeek).
  function publicPowers(room) {
    const current = room.game === 'blackjack' ? room.round : room.hand
    const live = room.game === 'blackjack' ? room.phase === 'playing' : POKER_LIVE.has(room.phase)
    if (!live) return []
    return Object.entries(room.peeks ?? {})
      .filter(([, p]) => p.hand === current && p.cardId)
      .map(([uid, p]) => ({ seat: room.seats.findIndex((s) => s?.sid === uid), hand: current, power: p.power, card: cardView(p.cardId) }))
      .filter((x) => x.seat >= 0 && x.card)
  }

  function viewFor(room, userId) {
    const state = room.view(userId)
    applyPeek(room, userId, state)
    state.powers = publicPowers(room)
    // Cuándo hay que volver a llamar para que avance un temporizador (crupier, turnos, cuenta atrás…).
    state.wakeIn = room.pending ? Math.max(0, room.pending.at - now()) : null
    return state
  }

  async function chatSince(code, after) {
    if (!code) return []
    const { rows } = await db.query(
      `select id, usuario_id as "from", nombre as name, avatar, texto as text, extract(epoch from creado) * 1000 as at
       from public.juegos_chat where mesa = $1 and id > $2 order by id desc limit $3`,
      [code, Number(after) || 0, CHAT_KEEP],
    )
    return rows.reverse().map((r) => ({ ...r, id: Number(r.id), at: Number(r.at) }))
  }

  async function lobby(user) {
    const t = now()
    const [tables, online, acc] = await Promise.all([
      db.query(`select codigo, juego, etiqueta, numero, estado from public.juegos_mesas order by juego, numero`),
      db.query(`select count(*)::int as n from public.juegos_cuentas where visto > now() - make_interval(secs => $1::int)`, [ONLINE_MS / 1000]),
      db.query(`select saldo from public.juegos_cuentas where usuario_id = $1`, [user.id]),
    ])
    return {
      tables: tables.rows.map((row) => summary(row, t)),
      online: online.rows[0].n,
      balance: acc.rows[0]?.saldo ?? STARTING_BALANCE,
      resetAt: weekOf(t).resetAt,
    }
  }

  async function scores(user) {
    const week = weekOf(now())
    const [rows, meta] = await Promise.all([
      db.query(
        `select usuario_id, nombre as name, avatar, saldo as balance, dias from public.juegos_cuentas
         where jugado order by saldo desc, nombre limit $1`,
        [MAX_SCORES],
      ),
      db.query(`select semana_pasada from public.juegos_meta where id = 1`),
    ])
    const players = rows.rows.map((r, i) => {
      let last = STARTING_BALANCE
      const days = readDays(r.dias).map((value, d) => {
        if (d > week.day) return null
        if (value !== null) last = value
        return last
      })
      return { rank: i + 1, name: r.name, avatar: r.avatar, balance: r.balance, days, me: r.usuario_id === user.id }
    })
    return {
      week: { key: week.key, day: week.day, resetAt: week.resetAt },
      starting: STARTING_BALANCE,
      players,
      lastWeek: meta.rows[0]?.semana_pasada ?? null,
    }
  }

  // Elige mesa pública (o la crea) y entra.
  async function joinPublic(user, msg, current) {
    if (!GAMES.includes(msg.game)) throw new JuegosError('BAD_MESSAGE')
    const left = current ? await withTable(current, user, (room, session) => room.leave(session)).catch(() => null) : null
    try {
      const outcome = await joinTarget(user, msg)
      if (left?.sent) outcome.sent = Promise.all([left.sent, outcome.sent])
      return outcome
    } catch (error) {
      await left?.sent
      throw error
    }
  }

  async function joinTarget(user, msg) {
    const play = msg.as !== 'spectator'
    const all = (await db.query(`select codigo, juego, numero, estado from public.juegos_mesas`)).rows
    const t = now()
    // Los asientos de quien ya se fue cuentan como libres (salen de la mesa al entrar).
    const tables = all
      .filter((r) => r.juego === msg.game)
      .map((r) => ({ code: r.codigo, number: r.numero, seats: liveSeats(r.estado, t) }))
    let target = typeof msg.code === 'string' ? tables.find((r) => r.code === msg.code) : null
    if (target && play && !target.seats.some((s) => !s)) target = null
    target ??= pickTable(tables, play)
    if (!target && play) {
      // Todas llenas: se abre otra mesa («Mesa 2», «Mesa 3»…).
      if (tables.length >= MAX_PUBLIC_PER_GAME) throw new JuegosError('ROOM_FULL')
      const number = nextNumber(tables)
      target = { code: (await createTable(msg.game, number, new Set(all.map((r) => r.codigo)))) ?? null }
      if (!target.code) throw new JuegosError('BUSY')
    }
    if (!target) throw new JuegosError('ROOM_FULL')
    return withTable(target.code, user, (room, session) => room.join(session, play))
  }

  // Inserta una mesa pública vacía. Si otra petición creó ya ese número a la vez, no hace nada (índice único).
  async function createTable(game, number, taken) {
    const code = newCode(taken)
    const Kind = game === 'poker' ? PokerRoom : Room
    const label = `Mesa ${number}`
    const room = new Kind({ code, seats: PUBLIC_SEATS[game], accounts: new TxAccounts([], 0), randomInt, now: () => now(), label, persistent: number === 1, timers: storedTimers })
    room.number = number
    const { rows } = await db.query(
      `insert into public.juegos_mesas (codigo, juego, etiqueta, numero, persistente, estado) values ($1, $2, $3, $4, $5, $6)
       on conflict do nothing returning codigo`,
      [code, game, label, number, number === 1, serialize(room)],
    )
    return rows[0]?.codigo ?? null
  }

  // Devuelve un código de error o null. El límite de ritmo se mide con el reloj de la base de datos.
  async function postChat(user, code, text) {
    const clean = cleanText(text)
    if (!clean) return 'BAD_MESSAGE'
    const { rows } = await db.query(
      `select exists (select 1 from public.juegos_chat where usuario_id = $1 and creado > now() - make_interval(secs => $2::float)) as busy`,
      [user.id, CHAT_GAP_MS / 1000],
    )
    if (rows[0].busy) return 'RATE_LIMIT'
    await db.query(`insert into public.juegos_chat (mesa, usuario_id, nombre, avatar, texto) values ($1, $2, $3, $4, $5)`, [code, user.id, user.name, user.avatar, clean])
    // Aviso propio del chat: los demás piden solo los mensajes nuevos, no la mesa entera.
    await ping(`juegos-mesa-${code}`, 'chat')
    return null
  }

  // Lo apostado y lo ganado (o perdido) en la jugada que acaba de liquidarse, o null si no se liquidó ninguna.
  // Plinko se liquida en cada jugada; los demás, cuando aparece un «last» de otra ronda o partida.
  function settlementOf(game, msg, saved, out) {
    if (game === 'plinko') return { stake: msg.bet, net: out.delta }
    const last = out.saved?.last
    if (!last || last.round === saved?.last?.round) return null
    return { stake: last.stake, net: last.net }
  }

  // Una jugada en solitario: se bloquea tu cuenta, se sortea en el servidor y se guarda el saldo (cuenta en el Score).
  async function playSolo(user, msg) {
    const game = SOLO_GAMES[msg.t]
    const t = now()
    const week = weekOf(t)
    const ctx = { now: t, secret, week: week.key, userId: user.id }
    return db.tx(async (q) => {
      ctx.q = q // la carrera mira quién pilota cada coche dentro de la misma transacción
      const accRows = (await q(`select usuario_id, saldo, dias, jugado from public.juegos_cuentas where usuario_id = $1 for update`, [user.id])).rows
      const accounts = new TxAccounts(accRows, week.day)
      const balance = accounts.get(user.id).balance
      // Plinko no guarda nada entre jugadas.
      const saved =
        game === 'plinko'
          ? null
          : ((await q(`select estado from public.juegos_solo where usuario_id = $1 and juego = $2 for update`, [user.id, game])).rows[0]?.estado ?? null)
      const out = await SOLO_PLAY[game](msg, balance, saved, randomInt, ctx)
      if (out.error) return out
      // Seguro o premio del gacha activo para este juego: se aplica cuando se liquida una jugada.
      const settled = settlementOf(game, msg, saved, out)
      if (settled) {
        const hit = await applyEffect(q, user.id, game, settled)
        if (hit) {
          out.delta += hit.extra
          out.power = hit
        }
      }
      // Toda jugada cuenta para el Score, también la que te deja igual (entras en la clasificación y se anota el día).
      if (out.played || out.delta) accounts.adjust(user.id, out.delta)
      for (const token of accounts.dirty) {
        const acc = accounts.get(token)
        await q(`update public.juegos_cuentas set saldo = $2, dias = $3::bigint[], jugado = $4 where usuario_id = $1`, [token, acc.balance, pgArray(acc.days), acc.played])
      }
      if (out.saved) {
        await q(
          `insert into public.juegos_solo (usuario_id, juego, estado) values ($1, $2, $3)
           on conflict (usuario_id, juego) do update set estado = excluded.estado, actualizado = now()`,
          [user.id, game, out.saved],
        )
      }
      return out
    })
  }

  // Cobro del gacha dentro de su transacción, con el mismo registro que las jugadas (cuenta en el Score).
  // Devuelve el saldo nuevo, o null si no llega.
  async function charge(q, userId, amount) {
    const week = weekOf(now())
    const rows = (await q(`select usuario_id, saldo, dias, jugado from public.juegos_cuentas where usuario_id = $1 for update`, [userId])).rows
    const accounts = new TxAccounts(rows, week.day)
    if (!accounts.get(userId) || accounts.get(userId).balance < amount) return null
    accounts.adjust(userId, -amount)
    const acc = accounts.get(userId)
    await q(`update public.juegos_cuentas set saldo = $2, dias = $3::bigint[], jugado = $4 where usuario_id = $1`, [userId, acc.balance, pgArray(acc.days), acc.played])
    return acc.balance
  }
  const gacha = createGacha({ db, ping, now, charge })

  // Jugadores con apuesta en una ronda de la ruleta o el cohete en vivo (la ronda se queda anotada aunque ya se haya pagado).
  async function soloPlayers(game, round) {
    const { rows } = await db.query(
      `select count(*)::int as n from public.juegos_solo where juego = $2 and estado->>'round' = $1
         and (jsonb_array_length(coalesce(estado->'bets', '[]'::jsonb)) > 0 or coalesce((estado->>'bet')::bigint, 0) > 0
              or estado->'last'->>'round' = $1)`,
      [String(round), game],
    )
    return rows[0].n
  }

  // Pilotos de una carrera: quién lleva cada coche (los demás los lleva la IA).
  async function raceSeats(round) {
    const { rows } = await db.query(
      `select (s.estado->>'seat')::int as car, c.nombre as name, c.avatar
       from public.juegos_solo s join public.juegos_cuentas c on c.usuario_id = s.usuario_id
       where s.juego = 'race' and s.estado->>'seatRound' = $1 and s.estado->>'seat' is not null`,
      [String(round)],
    )
    return rows.map((r) => ({ car: r.car, name: r.name, avatar: r.avatar ?? null }))
  }

  // Quién ganó en una ronda ya jugada de la ruleta o el cohete (para anunciarlo a todos), de más a menos.
  async function soloWinners(game, round, userId) {
    const { rows } = await db.query(
      `select c.nombre as name, (s.estado->'last'->>'net')::bigint as amount, (s.estado->'last'->>'mult')::int as mult,
              s.usuario_id = $2 as me
       from public.juegos_solo s join public.juegos_cuentas c on c.usuario_id = s.usuario_id
       where s.juego = $3 and s.estado->'last'->>'round' = $1 and (s.estado->'last'->>'net')::bigint > 0
       order by amount desc limit 5`,
      [String(round), userId, game],
    )
    return rows.map((r) => ({ name: r.name, amount: Number(r.amount), mult: r.mult, me: r.me }))
  }

  // Ruleta y cohete en vivo: ponerse al día («sync») no bloquea nada si no hay apuesta que pagar; lo demás pasa por playSolo.
  const LIVE_SOLO = {
    solo_roulette: { game: 'roulette', due: rouletteDue, view: rouletteView },
    solo_crash: { game: 'crash', due: (saved, t) => crashDue(saved, t, secret), view: crashView },
    solo_race: { game: 'race', due: (saved, t) => raceDue(saved, t, secret), view: raceView },
  }

  // Acciones que se aplican a la mesa en la que estás.
  const TABLE_ACTIONS = {
    view: () => null,
    tick: () => null,
    sit: (room, s, msg) => room.sit(s, msg.seat),
    stand_up: (room, s) => room.standUp(s),
    bet: (room, s, msg) => (room.bet ? room.bet(s, msg.amount) : 'BAD_MESSAGE'),
    ready: (room, s) => (room.ready ? room.ready(s) : 'BAD_MESSAGE'),
    action: (room, s, msg) => room.action(s, msg.kind, msg.amount),
    rebuy: () => 'BROKE',
    kick: () => 'NOT_HOST',
    leave_room: (room, s) => room.leave(s),
  }

  // Jugadores de la ronda y, si se piden, ganadores de una ronda ya jugada.
  async function liveExtras(game, msg, reply) {
    reply.solo.players = await soloPlayers(game, reply.solo.round)
    if (game === 'race') reply.solo.seats = await raceSeats(reply.solo.round)
    if (Number.isSafeInteger(msg.winners)) reply.solo.winners = await soloWinners(game, msg.winners, reply.me.id)
  }

  // Punto de entrada: una petición del navegador. Devuelve lo que el cliente debe actualizar.
  async function handle(user, msg) {
    if (!msg || typeof msg.t !== 'string') throw new JuegosError('BAD_MESSAGE')
    await warm()
    const account = await touchAccount(user)
    const me = { id: user.id, name: user.name, avatar: user.avatar, balance: account.saldo, auth: true, privateRooms: false }
    const reply = { me }

    const tableReply = async (outcome, code) => {
      reply.state = outcome.view
      if (outcome.error) reply.error = { code: outcome.error, message: ERRORS[outcome.error] ?? 'Error.' }
      // Chat y aviso de Realtime a la vez. «noChat» (solo en «view») lo manda el cliente al reaccionar a un «cambio»:
      // el chat tiene su propio aviso y su latido. Sin la bandera, el comportamiento de siempre.
      const wantChat = Boolean(outcome.view) && !(msg.t === 'view' && msg.noChat === true)
      const [chat] = await Promise.all([wantChat ? chatSince(code, msg.chatAfter) : null, outcome.sent])
      if (wantChat) reply.chat = chat
      if (outcome.balance !== undefined) me.balance = outcome.balance
      return reply
    }

    switch (msg.t) {
      case 'hello':
        if (account.mesa) {
          try {
            return await tableReply(await withTable(account.mesa, user, () => null), account.mesa)
          } catch (error) {
            if (!(error instanceof JuegosError)) throw error
            await db.query(`update public.juegos_cuentas set mesa = null where usuario_id = $1`, [user.id])
          }
        }
        reply.state = null
        reply.lobby = await lobby(user)
        return reply
      case 'lobby':
        reply.lobby = await lobby(user)
        return reply
      case 'scores':
        reply.scores = await scores(user)
        return reply
      case 'join_public': {
        const outcome = await joinPublic(user, msg, account.mesa)
        return tableReply(outcome, outcome.code)
      }
      case 'chat': {
        if (!account.mesa) throw new JuegosError('BAD_PHASE')
        const error = await postChat(user, account.mesa, msg.text)
        reply.chat = await chatSince(account.mesa, msg.chatAfter)
        if (error) reply.error = { code: error, message: ERRORS[error] }
        return reply
      }
      case 'solo_roulette':
      case 'solo_crash':
      case 'solo_race': {
        const live = LIVE_SOLO[msg.t]
        let play = msg
        // Espera larga del cohete: se responde justo cuando explota (sin tocar la BD mientras tanto), así cada
        // navegador hace una petición por vuelo en vez de preguntar cada poco si ya explotó.
        if (msg.t === 'solo_crash' && msg.a === 'wait') {
          const wait = Math.min(crashWaitMs(secret, now()), CRASH_WAIT_MAX_MS)
          if (wait > 0) await sleep(wait + CRASH_WAIT_PAD_MS)
          play = { ...msg, a: 'sync' }
        }
        if (play.a === 'sync') {
          const saved = (await db.query(`select estado from public.juegos_solo where usuario_id = $1 and juego = $2`, [user.id, live.game])).rows[0]?.estado
          const t = now()
          if (!live.due(saved, t)) {
            reply.solo = live.view(saved, account.saldo, { now: t, secret })
            await liveExtras(live.game, msg, reply)
            return reply
          }
        }
        const out = await playSolo(user, play)
        if (out.error) reply.error = { code: out.error, message: ERRORS[out.error] }
        else reply.solo = out.result
        if (out.power) reply.power = out.power
        me.balance = (await db.query(`select saldo from public.juegos_cuentas where usuario_id = $1`, [user.id])).rows[0].saldo
        if (reply.solo) await liveExtras(live.game, msg, reply)
        return reply
      }
      case 'solo_dungeon':
      case 'solo_bribe':
      case 'solo_plinko':
      case 'solo_frog': {
        const out = await playSolo(user, msg)
        if (out.error) reply.error = { code: out.error, message: ERRORS[out.error] }
        else reply.solo = out.result
        if (out.power) reply.power = out.power
        me.balance = (await db.query(`select saldo from public.juegos_cuentas where usuario_id = $1`, [user.id])).rows[0].saldo
        return reply
      }
      case 'gacha': {
        const out = await gacha.handle(user, msg)
        if (out.error) {
          reply.error = { code: out.error, message: ERRORS[out.error] ?? 'Error.' }
          delete out.error
        }
        reply.gacha = out
        if (out.result || reply.error) me.balance = (await db.query(`select saldo from public.juegos_cuentas where usuario_id = $1`, [user.id])).rows[0].saldo
        return reply
      }
      case 'power': {
        // Poder de mesa de una carta del gacha (póker o blackjack): primero se gasta (una vez al día por carta y juego) y
        // después se aplica a la mano en curso; si la mesa no lo admite, se devuelve.
        if (!account.mesa) throw new JuegosError('POWER_POKER')
        if (msg.game !== 'poker' && msg.game !== 'blackjack') {
          reply.error = { code: 'POWER_GAME', message: ERRORS.POWER_GAME }
          return reply
        }
        const spent = await gacha.spendPower(user.id, msg.card, msg.game, now())
        if (spent.error) {
          reply.error = { code: spent.error, message: ERRORS[spent.error] ?? 'Error.' }
          return reply
        }
        const power = spent.power
        const { name } = power
        let text = ''
        const outcome = await withTable(account.mesa, user, (room) => {
          if (room.game !== msg.game) return 'POWER_GAME'
          const seat = room.seats.find((s) => s?.sid === user.id)
          const current = room.game === 'blackjack' ? room.round : room.hand
          const peeks = Object.fromEntries(Object.entries(room.peeks ?? {}).filter(([, p]) => p.hand === current))
          if (peeks[user.id]) return 'POWER_ACTIVE'
          const peek = { hand: current, power: name, cardName: spent.card.name, cardId: spent.card.id }
          if (room.game === 'blackjack') {
            if (room.phase !== 'playing' || !seat?.cards?.length) return 'POWER_NO_HAND'
            peek.dealer = Boolean(power.dealer)
            peek.live = Boolean(power.live)
            peek.hole = Boolean(power.hole) && !peek.dealer
            peek.nextHint = Boolean(power.nextHint) && !peek.live
            if (power.next && !peek.live) peek.next = room.shoe.at(-1) ?? null
            text = [
              peek.dealer && 've la carta tapada del crupier',
              peek.hole && 'sabe si la tapada del crupier es alta o baja',
              peek.live && 've siempre la próxima carta del mazo',
              peek.next && 've la próxima carta del mazo',
              peek.nextHint && 'sabe si la próxima carta del mazo es alta o baja',
            ]
              .filter(Boolean)
              .join(' y ')
          } else {
            if (!POKER_LIVE.has(room.phase) || !seat?.inHand || seat.folded) return 'POWER_NO_HAND'
            const parts = []
            if (power.rivals) {
              const rivals = room.seats.flatMap((s, i) => (s && s.inHand && !s.folded && s.sid !== user.id ? [i] : []))
              if (rivals.length === 0 && !power.board) return 'POWER_NO_RIVALS'
              let chosen
              if (power.rivals === 'all') chosen = rivals
              else {
                // rico: más fichas; apuesta: más apostado en la mano; azar: cualquiera (desempate al azar también).
                const score = (i) => (power.target === 'rico' ? room.balance(room.seats[i]) : power.target === 'apuesta' ? room.seats[i].total : 0)
                chosen = rivals
                  .map((i) => [i, score(i), randomInt(1000)])
                  .sort((a, b) => b[1] - a[1] || a[2] - b[2])
                  .slice(0, power.rivals)
                  .map(([i]) => i)
              }
              if (power.rivals === 'all' && power.full) peek.picks = 'all'
              else peek.picks = chosen.map((i) => ({ seat: i, card: power.full ? null : randomInt(room.seats[i].cards.length) }))
              if (chosen.length) {
                const names = power.rivals === 'all' ? 'todos' : chosen.map((i) => room.seats[i].name).join(' y ')
                parts.push(power.full ? `ve las cartas de ${names}` : `ve una carta de ${names}`)
              }
            } else peek.picks = []
            if (power.board) {
              peek.board = power.board
              parts.push(
                { hint: 'sabe si la próxima carta de la mesa es alta o baja', next: 've la próxima carta de la mesa', all: 've las cartas que faltan por salir en la mesa' }[
                  power.board
                ],
              )
            }
            text = parts.join(' y ')
          }
          peek.text = text
          room.peeks = { ...peeks, [user.id]: peek }
          room.rev++
          return null
        })
        if (outcome.error) {
          await gacha.refundPower(user.id, spent.card.id, msg.game, spent.before)
          return tableReply(outcome, account.mesa)
        }
        // La carta se gasta: vuelve a quedar libre.
        await gacha.consumePower(user.id, spent.card.id, now())
        // Aviso en el chat de la mesa, para que nadie juegue engañado.
        await db.query(`insert into public.juegos_chat (mesa, usuario_id, nombre, avatar, texto) values ($1, $2, $3, $4, $5)`, [
          account.mesa,
          user.id,
          user.name,
          user.avatar,
          `✦ Gasta a ${spent.card.name} en «${name}»: ${text} en esta mano.`.slice(0, 200),
        ])
        await ping(`juegos-mesa-${account.mesa}`, 'chat')
        return tableReply(outcome, account.mesa)
      }
      case 'chat_poll':
        reply.chat = await chatSince(account.mesa, msg.chatAfter)
        return reply
      default: {
        const action = Object.hasOwn(TABLE_ACTIONS, msg.t) ? TABLE_ACTIONS[msg.t] : null
        if (!action) throw new JuegosError('BAD_MESSAGE')
        if (!account.mesa) {
          reply.state = null
          if (msg.t !== 'leave_room' && msg.t !== 'view' && msg.t !== 'tick') reply.error = { code: 'BAD_PHASE', message: ERRORS.BAD_PHASE }
          reply.lobby = await lobby(user)
          return reply
        }
        const quiet = msg.t === 'view' || msg.t === 'tick'
        const outcome = (quiet && (await peekTable(account.mesa, user))) || (await withTable(account.mesa, user, (room, session) => action(room, session, msg)))
        if (msg.t === 'leave_room') {
          reply.state = null
          ;[reply.lobby] = await Promise.all([lobby(user), outcome.sent])
          return reply
        }
        return tableReply(outcome, account.mesa)
      }
    }
  }

  // La «Mesa 1» de cada juego existe siempre.
  let tablesReady = false
  async function ensurePublicTables() {
    if (tablesReady) return
    const { rows } = await db.query(`select juego, codigo from public.juegos_mesas where persistente`)
    for (const game of GAMES) {
      if (!rows.some((r) => r.juego === game)) await createTable(game, 1, new Set(rows.map((r) => r.codigo)))
    }
    tablesReady = true
  }

  // Arranque (esquema, semana, «Mesa 1»): cacheado por instancia. La función de Vercel lo lanza a la vez que la
  // comprobación del usuario; en caliente no hace ninguna consulta.
  async function warm() {
    await ensureSchema()
    await Promise.all([rollover(weekOf(now())), ensurePublicTables()])
  }

  return { warm, handle }
}
