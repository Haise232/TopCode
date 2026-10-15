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
import { SOLO_GAMES, SOLO_PLAY } from './solo.mjs'

export const STARTING_BALANCE = 10000
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_PUBLIC_PER_GAME = 6
const AWAY_MS = 45000 // sin noticias del navegador: se le da por desconectado
const GONE_MS = 3 * 60000 // y pasado este rato, fuera de la mesa
const SEEN_SAVE_MS = 15000 // el latido se guarda aunque la mesa no cambie, como mucho una vez cada este rato
const ONLINE_MS = 60000
const CHAT_KEEP = 50
const CHAT_GAP_MS = 700
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

// db: { query(sql, params), tx(fn) } · ping(topic) avisa por Realtime · now() reloj
export function createJuegos({ db, ping = async () => {}, now = Date.now }) {
  let schemaReady = null
  let knownWeek = null

  function ensureSchema() {
    schemaReady ??= (async () => {
      const { rows } = await db.query(`select to_regclass('public.juegos_solo') is not null as ok`)
      if (!rows[0].ok) await db.query(SCHEMA_SQL)
      await db.query(`insert into public.juegos_meta (id, semana) values (1, $1) on conflict (id) do nothing`, [weekOf(now()).key])
    })().catch((error) => {
      schemaReady = null
      throw error
    })
    return schemaReady
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

  async function touchAccount(user) {
    const { rows } = await db.query(
      `insert into public.juegos_cuentas (usuario_id, nombre, avatar) values ($1, $2, $3)
       on conflict (usuario_id) do update set nombre = excluded.nombre, avatar = excluded.avatar, visto = now()
       returning saldo, mesa`,
      [user.id, user.name, user.avatar],
    )
    return rows[0]
  }

  // Abre la mesa con bloqueo, aplica fn(room, session) y la guarda si cambió algo.
  async function withTable(code, user, fn) {
    const t = now()
    const week = weekOf(t)
    const outcome = await db.tx(async (q) => {
      const row = (await q(`select * from public.juegos_mesas where codigo = $1 for update`, [code])).rows[0]
      if (!row) throw new JuegosError('ROOM_NOT_FOUND')
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
      if (changed || touch) {
        await q(`update public.juegos_mesas set estado = $2, version = version + 1, actualizado = now() where codigo = $1`, [code, serialize(room)])
        for (const token of accounts.dirty) {
          const acc = accounts.get(token)
          await q(`update public.juegos_cuentas set saldo = $2, dias = $3::bigint[], jugado = $4 where usuario_id = $1`, [token, acc.balance, pgArray(acc.days), acc.played])
        }
      }
      if (gone.length) await q(`update public.juegos_cuentas set mesa = null where usuario_id = any($1::uuid[]) and mesa = $2`, [gone, code])
      const inRoom = room.members.has(user.id)
      if (inRoom !== wasIn) await q(`update public.juegos_cuentas set mesa = $2 where usuario_id = $1`, [user.id, inRoom ? code : null])
      // Mesas extra vacías: se borran (la «Mesa 1» de cada juego se queda siempre).
      if (!row.persistente && room.members.size === 0 && room.seats.every((s) => !s)) {
        await q(`delete from public.juegos_mesas where codigo = $1`, [code])
      }
      return { error, changed, view: inRoom ? viewFor(room, user.id) : null }
    })
    if (outcome.changed) {
      await Promise.all([ping(`juegos-mesa-${code}`), ping('juegos-lobby')])
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
    const room = restore(row, new TxAccounts(accRows, weekOf(t).day), () => now())
    return { error: null, changed: false, view: viewFor(room, user.id) }
  }

  function viewFor(room, userId) {
    const state = room.view(userId)
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
    if (current) await withTable(current, user, (room, session) => room.leave(session)).catch(() => {})
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

  // Una jugada en solitario: se bloquea tu cuenta, se sortea en el servidor y se guarda el saldo (cuenta en el Score).
  async function playSolo(user, msg) {
    const game = SOLO_GAMES[msg.t]
    const week = weekOf(now())
    return db.tx(async (q) => {
      const accRows = (await q(`select usuario_id, saldo, dias, jugado from public.juegos_cuentas where usuario_id = $1 for update`, [user.id])).rows
      const accounts = new TxAccounts(accRows, week.day)
      const balance = accounts.get(user.id).balance
      const saved =
        game === 'slots'
          ? null
          : ((await q(`select estado from public.juegos_solo where usuario_id = $1 and juego = $2 for update`, [user.id, game])).rows[0]?.estado ?? null)
      const out = SOLO_PLAY[game](msg, balance, saved, randomInt)
      if (out.error) return out
      // Toda jugada cuenta para el Score, también la que te deja igual (entras en la clasificación y se anota el día).
      accounts.adjust(user.id, out.delta)
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

  // Punto de entrada: una petición del navegador. Devuelve lo que el cliente debe actualizar.
  async function handle(user, msg) {
    if (!msg || typeof msg.t !== 'string') throw new JuegosError('BAD_MESSAGE')
    await ensureSchema()
    await rollover(weekOf(now()))
    const account = await touchAccount(user)
    const me = { id: user.id, name: user.name, avatar: user.avatar, balance: account.saldo, auth: true, privateRooms: false }
    const reply = { me }

    const tableReply = async (outcome, code) => {
      reply.state = outcome.view
      if (outcome.error) reply.error = { code: outcome.error, message: ERRORS[outcome.error] ?? 'Error.' }
      if (outcome.view) reply.chat = await chatSince(code, msg.chatAfter)
      const acc = (await db.query(`select saldo from public.juegos_cuentas where usuario_id = $1`, [user.id])).rows[0]
      me.balance = acc.saldo
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
        const code = (await db.query(`select mesa from public.juegos_cuentas where usuario_id = $1`, [user.id])).rows[0].mesa
        return tableReply(outcome, code)
      }
      case 'chat': {
        if (!account.mesa) throw new JuegosError('BAD_PHASE')
        const error = await postChat(user, account.mesa, msg.text)
        reply.chat = await chatSince(account.mesa, msg.chatAfter)
        if (error) reply.error = { code: error, message: ERRORS[error] }
        return reply
      }
      case 'solo_roulette':
      case 'solo_slots':
      case 'solo_blackjack': {
        const out = await playSolo(user, msg)
        if (out.error) reply.error = { code: out.error, message: ERRORS[out.error] }
        else reply.solo = out.result
        me.balance = (await db.query(`select saldo from public.juegos_cuentas where usuario_id = $1`, [user.id])).rows[0].saldo
        return reply
      }
      case 'solo_state': {
        // Racha de la ruleta y mano de blackjack a medias, para retomarlas al entrar en la pantalla.
        const { rows } = await db.query(`select juego, estado from public.juegos_solo where usuario_id = $1`, [user.id])
        const saved = Object.fromEntries(rows.map((r) => [r.juego, r.estado]))
        reply.soloState = {
          streak: saved.roulette?.streak ?? 0,
          blackjack: saved.blackjack ? SOLO_PLAY.blackjack({ a: 'view' }, account.saldo, saved.blackjack, randomInt).result : null,
        }
        return reply
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
          reply.lobby = await lobby(user)
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

  return {
    async handle(user, msg) {
      await ensureSchema()
      await ensurePublicTables()
      return handle(user, msg)
    },
  }
}
