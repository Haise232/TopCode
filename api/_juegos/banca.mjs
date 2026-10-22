// La banca de Juegos: el master de TopCode (usuarios.es_superadmin, solo hay uno) da dinero, manda mensajes a nombre de
// la banca y activa el Admin Abuse. Todo lo comprueba el servidor: el botón del navegador solo lo enseña.
//
// Mensajes (msg.t):
//   banca         cualquiera: tus avisos sin ver, el Admin Abuse activo y si eres el master
//   banca_visto   cualquiera: { hasta } marca vistos tus avisos hasta ese id
//   banca_gente   master: jugadores a los que dar dinero o escribir
//   banca_dar     master: { para: id | 'todos', importe, texto? }
//   banca_mensaje master: { para: id | 'todos', texto }
//   banca_abuso   master: { modo: 'x2' | 'x3' | 'gratis' | null, ambito: 'todo' | 'poker', minutos }
//
// Admin Abuse (juegos_meta.abuso): x2 y x3 multiplican lo que ganas en una jugada (la banca paga la diferencia) y dan
// más suerte en las tiradas del gacha; «gratis» devuelve lo que pierdes. Ámbito: todos los juegos o solo el póker.
// Lo que da la banca es saldo normal: cuenta en el Score.

export const BANK_TOPIC = 'juegos-banca' // aviso de Realtime: «la banca tiene algo nuevo» (sin datos)
export const ABUSE_MODES = new Set(['x2', 'x3', 'gratis'])
export const ABUSE_MINUTES = [5, 10, 30, 60]
const MAX_GIFT = 1_000_000
const MAX_TEXT = 300
const ABUSE_TTL_MS = 3000 // cada instancia de la función relee el Admin Abuse como mucho cada este rato
const MASTER_TTL_MS = 60000

// ¿Afecta el Admin Abuse a este juego? (póker, blackjack, roulette, crash, race, plinko, frog, dungeon, duel, gacha)
export const abuseOn = (abuse, game) => Boolean(abuse) && (abuse.ambito === 'todo' || game === 'poker')

// Lo que pone la banca encima de una jugada que acaba con `net` (ganancia neta; negativa si pierdes).
export function abuseExtra(abuse, game, net) {
  if (!abuseOn(abuse, game) || !Number.isFinite(net)) return 0
  if (abuse.modo === 'gratis') return net < 0 ? -net : 0
  const mult = abuse.modo === 'x3' ? 3 : 2
  return net > 0 ? Math.floor(net * (mult - 1)) : 0
}

// Suerte del gacha: 1, 2 o 3 (multiplica el peso de las rarezas buenas).
export const abuseLuck = (abuse) => (abuseOn(abuse, 'gacha') && abuse.modo !== 'gratis' ? (abuse.modo === 'x3' ? 3 : 2) : 1)

const cleanText = (text) =>
  typeof text === 'string'
    ? text
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .trim()
        .slice(0, MAX_TEXT)
    : ''

export function createBanca({ db, ping, now, credit }) {
  let abuseCache = { at: -Infinity, value: null }
  const masters = new Map()

  // El Admin Abuse activo (o null), con una caché corta: lo miran todas las jugadas.
  async function abuse() {
    const t = now()
    if (t - abuseCache.at > ABUSE_TTL_MS) {
      const { rows } = await db.query(`select abuso from public.juegos_meta where id = 1`)
      abuseCache = { at: t, value: rows[0]?.abuso ?? null }
    }
    const value = abuseCache.value
    return value && value.hasta > t ? value : null
  }

  // El último Admin Abuse leído, sin consultar (para usarlo dentro de una transacción: una consulta aparte ahí podría
  // quedarse esperando por una conexión libre). handle() de game.mjs lo refresca con abuse() al empezar cada petición.
  function cached() {
    const value = abuseCache.value
    return value && value.hasta > now() ? value : null
  }

  async function isMaster(userId) {
    const hit = masters.get(userId)
    if (hit && hit.until > Date.now()) return hit.value
    const { rows } = await db.query(`select es_superadmin from public.usuarios where id = $1`, [userId])
    const value = rows[0]?.es_superadmin === true
    masters.set(userId, { value, until: Date.now() + MASTER_TTL_MS })
    return value
  }

  // Avisos sin ver: los tuyos y los de todos, de los últimos 2 días, como mucho 10.
  async function status(user) {
    const [vistos, ab, master] = await Promise.all([
      db.query(`select ultimo from public.juegos_avisos_vistos where usuario_id = $1`, [user.id]),
      abuse(),
      isMaster(user.id),
    ])
    const after = Number(vistos.rows[0]?.ultimo ?? 0)
    const { rows } = await db.query(
      `select id, tipo, importe, texto, usuario_id is null as todos from public.juegos_avisos
       where id > $2 and (usuario_id = $1 or usuario_id is null) and creado > now() - interval '2 days'
       order by id limit 10`,
      [user.id, after],
    )
    return {
      banca: {
        avisos: rows.map((r) => ({ id: Number(r.id), tipo: r.tipo, importe: r.importe === null ? null : Number(r.importe), texto: r.texto, todos: r.todos })),
        abuso: ab,
        master,
        ahora: now(),
      },
    }
  }

  async function seen(user, msg) {
    const hasta = Number(msg.hasta)
    if (!Number.isSafeInteger(hasta) || hasta <= 0) return { error: 'BAD_MESSAGE' }
    await db.query(
      `insert into public.juegos_avisos_vistos (usuario_id, ultimo) values ($1, $2)
       on conflict (usuario_id) do update set ultimo = greatest(juegos_avisos_vistos.ultimo, excluded.ultimo)`,
      [user.id, hasta],
    )
    return { banca: { visto: hasta } }
  }

  // Destinatarios: todos los aprobados de TopCode o uno concreto (que tiene que existir y estar aprobado).
  async function recipients(q, para) {
    if (para === 'todos') {
      return (await q(`select id, nombre, avatar_url from public.usuarios where estado_acceso = 'aprobado'`)).rows
    }
    if (typeof para !== 'string' || !/^[0-9a-f-]{36}$/i.test(para)) return null
    const rows = (await q(`select id, nombre, avatar_url from public.usuarios where id = $1 and estado_acceso = 'aprobado'`, [para])).rows
    return rows.length ? rows : null
  }

  // Jugadores (para elegir a quién) y los últimos movimientos de la banca.
  async function people() {
    const [gente, hist] = await Promise.all([
      db.query(
        `select u.id, u.nombre as name, u.avatar_url as avatar, c.saldo as balance
         from public.usuarios u left join public.juegos_cuentas c on c.usuario_id = u.id
         where u.estado_acceso = 'aprobado' order by u.nombre`,
      ),
      db.query(
        `select a.id, a.tipo, a.importe, a.texto, extract(epoch from a.creado) * 1000 as at, u.nombre as name
         from public.juegos_avisos a left join public.usuarios u on u.id = a.usuario_id
         order by a.id desc limit 8`,
      ),
    ])
    return {
      banca: {
        gente: gente.rows.map((r) => ({ id: r.id, name: r.name, avatar: r.avatar ?? null, balance: r.balance === null ? null : Number(r.balance) })),
        historial: hist.rows.map((r) => ({
          id: Number(r.id),
          tipo: r.tipo,
          importe: r.importe === null ? null : Number(r.importe),
          texto: r.texto,
          at: Math.round(Number(r.at)),
          para: r.name ?? null, // null: para todos
        })),
      },
    }
  }

  async function give(user, msg) {
    const importe = Number(msg.importe)
    if (!Number.isSafeInteger(importe) || importe <= 0 || importe > MAX_GIFT) return { error: 'BAD_MESSAGE' }
    const texto = cleanText(msg.texto) || null
    const sent = await db.tx(async (q) => {
      const list = await recipients(q, msg.para)
      if (!list) return null
      await credit(q, list, importe)
      await q(`insert into public.juegos_avisos (usuario_id, tipo, importe, texto) values ($1, 'dinero', $2, $3)`, [msg.para === 'todos' ? null : list[0].id, importe, texto])
      return list.length
    })
    if (sent === null) return { error: 'BAD_MESSAGE' }
    await Promise.all([ping(BANK_TOPIC), ping('juegos-lobby')])
    return { banca: { hecho: 'dinero', personas: sent, importe } }
  }

  async function message(user, msg) {
    const texto = cleanText(msg.texto)
    if (!texto) return { error: 'BAD_MESSAGE' }
    const sent = await db.tx(async (q) => {
      const list = await recipients(q, msg.para)
      if (!list) return null
      await q(`insert into public.juegos_avisos (usuario_id, tipo, texto) values ($1, 'mensaje', $2)`, [msg.para === 'todos' ? null : list[0].id, texto])
      return list.length
    })
    if (sent === null) return { error: 'BAD_MESSAGE' }
    await ping(BANK_TOPIC)
    return { banca: { hecho: 'mensaje', personas: sent } }
  }

  async function setAbuse(user, msg) {
    let value = null
    if (msg.modo !== null) {
      if (!ABUSE_MODES.has(msg.modo)) return { error: 'BAD_MESSAGE' }
      if (msg.ambito !== 'todo' && msg.ambito !== 'poker') return { error: 'BAD_MESSAGE' }
      if (!ABUSE_MINUTES.includes(msg.minutos)) return { error: 'BAD_MESSAGE' }
      const t = now()
      value = { modo: msg.modo, ambito: msg.ambito, desde: t, hasta: t + msg.minutos * 60000 }
    }
    await db.query(`update public.juegos_meta set abuso = $1 where id = 1`, [value])
    abuseCache = { at: now(), value }
    await Promise.all([ping(BANK_TOPIC), ping('juegos-lobby')])
    return { banca: { abuso: value } }
  }

  const MASTER_ONLY = { banca_gente: people, banca_dar: give, banca_mensaje: message, banca_abuso: setAbuse }

  async function handle(user, msg) {
    if (msg.t === 'banca') return status(user)
    if (msg.t === 'banca_visto') return seen(user, msg)
    const fn = MASTER_ONLY[msg.t]
    if (!fn) return { error: 'BAD_MESSAGE' }
    if (!(await isMaster(user.id))) return { error: 'NOT_MASTER' }
    return fn(user, msg)
  }

  // Limpieza: avisos de hace más de 7 días (se llama en el reinicio semanal).
  const sweep = (q) => q(`delete from public.juegos_avisos where creado < now() - interval '7 days'`)

  return { handle, abuse, cached, sweep }
}
