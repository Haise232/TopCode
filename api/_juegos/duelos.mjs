// Duelos 1 contra 1 (reglas en packages/web/src/juegos/duel.js). Quien reta pone la apuesta al crear el reto (queda
// retenida); quien acepta pone la misma cantidad y el servidor sortea en esa misma transacción: el ganador cobra las dos.
// Un reto sin aceptar en duel.EXPIRE_MS se cancela y se devuelve. Cuenta en el Score como cualquier jugada.
//
// Mensajes (msg.a): «lista» | «retar» { para: id | null, apuesta, tipo } | «aceptar» { id } | «cancelar» { id }
import * as duel from '../../packages/web/src/juegos/duel.js'
import { abuseExtra } from './banca.mjs'

export const DUEL_TOPIC = 'juegos-duelos' // aviso de Realtime (sin datos): algo cambió en los duelos
const RECENT = 15

export const DUEL_ERRORS = {
  DUEL_GONE: 'Ese reto ya no está: lo aceptó otra persona, se canceló o caducó.',
  DUEL_SELF: 'No puedes aceptar tu propio reto.',
  DUEL_NOT_FOR_YOU: 'Ese reto es para otra persona.',
  DUEL_LIMIT: `Ya tienes ${duel.OPEN_MAX} retos abiertos: espera a que los acepten o cancela alguno.`,
  DUEL_RIVAL: 'Esa persona no está en Juegos.',
}

// move(q, { id: delta }): mueve saldo dentro de la transacción (game.mjs, con el registro del día y del Score).
export function createDuelos({ db, ping, now, randomInt, move, abuse }) {
  // Retos caducados: se cancelan y se devuelve el dinero (se mira al leer, no hace falta un temporizador).
  async function expire(q) {
    const { rows } = await q(
      `update public.juegos_duelos set estado = 'caducado', jugado = now()
       where estado = 'abierto' and creado < now() - make_interval(secs => $1::int) returning reta, apuesta`,
      [duel.EXPIRE_MS / 1000],
    )
    for (const r of rows) await move(q, { [r.reta]: Number(r.apuesta) })
    return rows.length
  }

  const view = (r, me) => ({
    id: Number(r.id),
    tipo: r.tipo,
    apuesta: Number(r.apuesta),
    estado: r.estado,
    reta: { id: r.reta, name: r.reta_nombre, avatar: r.reta_avatar ?? null },
    para: r.para ? { id: r.para, name: r.para_nombre, avatar: r.para_avatar ?? null } : null,
    acepta: r.acepta ? { id: r.acepta, name: r.acepta_nombre, avatar: r.acepta_avatar ?? null } : null,
    ganador: r.ganador ?? null,
    detalle: r.detalle ?? null,
    extra: r.extra ? Number(r.extra) : 0,
    creado: new Date(r.creado).getTime(),
    jugado: r.jugado ? new Date(r.jugado).getTime() : null,
    mio: r.reta === me || r.acepta === me,
  })

  const SELECT = `select d.*, a.nombre as reta_nombre, a.avatar as reta_avatar, b.nombre as para_nombre, b.avatar as para_avatar,
      c.nombre as acepta_nombre, c.avatar as acepta_avatar
    from public.juegos_duelos d
    join public.juegos_cuentas a on a.usuario_id = d.reta
    left join public.juegos_cuentas b on b.usuario_id = d.para
    left join public.juegos_cuentas c on c.usuario_id = d.acepta`

  async function list(user) {
    const expired = await db.tx(expire)
    if (expired) await ping(DUEL_TOPIC)
    const [open, recent, people] = await Promise.all([
      db.query(`${SELECT} where d.estado = 'abierto' and (d.para is null or d.para = $1 or d.reta = $1) order by d.id desc limit 40`, [user.id]),
      db.query(`${SELECT} where d.estado = 'jugado' order by d.jugado desc limit $1`, [RECENT]),
      db.query(`select usuario_id as id, nombre as name, avatar from public.juegos_cuentas where usuario_id <> $1 order by visto desc limit 60`, [user.id]),
    ])
    return {
      now: now(),
      abiertos: open.rows.map((r) => view(r, user.id)),
      recientes: recent.rows.map((r) => view(r, user.id)),
      gente: people.rows.map((r) => ({ id: r.id, name: r.name, avatar: r.avatar ?? null })),
    }
  }

  async function challenge(user, msg) {
    if (!duel.validBet(msg.apuesta) || !duel.KINDS[msg.tipo]) return { error: 'BAD_MESSAGE' }
    const para = msg.para ?? null
    if (para !== null && (typeof para !== 'string' || para === user.id)) return { error: 'BAD_MESSAGE' }
    const out = await db.tx(async (q) => {
      await expire(q)
      if (para && !(await q(`select 1 from public.juegos_cuentas where usuario_id = $1`, [para])).rows.length) return { error: 'DUEL_RIVAL' }
      const open = (await q(`select count(*)::int as n from public.juegos_duelos where reta = $1 and estado = 'abierto'`, [user.id])).rows[0].n
      if (open >= duel.OPEN_MAX) return { error: 'DUEL_LIMIT' }
      if (!(await move(q, { [user.id]: -msg.apuesta }, true))) return { error: 'INSUFFICIENT_FUNDS' }
      const id = (await q(`insert into public.juegos_duelos (reta, para, apuesta, tipo) values ($1, $2, $3, $4) returning id`, [user.id, para, msg.apuesta, msg.tipo])).rows[0].id
      return { id: Number(id) }
    })
    if (!out.error) await ping(DUEL_TOPIC)
    return out
  }

  async function accept(user, msg) {
    const ab = await abuse()
    const out = await db.tx(async (q) => {
      await expire(q)
      const d = (await q(`select * from public.juegos_duelos where id = $1 for update`, [msg.id])).rows[0]
      if (!d || d.estado !== 'abierto') return { error: 'DUEL_GONE' }
      if (d.reta === user.id) return { error: 'DUEL_SELF' }
      if (d.para && d.para !== user.id) return { error: 'DUEL_NOT_FOR_YOU' }
      const stake = Number(d.apuesta)
      if (!(await move(q, { [user.id]: -stake }, true))) return { error: 'INSUFFICIENT_FUNDS' }
      const { winner, detail } = duel.play(d.tipo, (n) => randomInt(n))
      const win = winner === 'reta' ? d.reta : user.id
      const lose = winner === 'reta' ? user.id : d.reta
      // Admin Abuse: la banca multiplica lo ganado (x2/x3) o devuelve lo perdido (gratis).
      const extraWin = abuseExtra(ab, 'duel', stake)
      const extraLose = abuseExtra(ab, 'duel', -stake)
      await move(q, { [win]: stake * 2 + extraWin, ...(extraLose ? { [lose]: extraLose } : {}) })
      await q(`update public.juegos_duelos set estado = 'jugado', acepta = $2, ganador = $3, detalle = $4, extra = $5, jugado = now() where id = $1`, [
        d.id,
        user.id,
        winner,
        detail,
        extraWin,
      ])
      return { id: Number(d.id) }
    })
    if (!out.error) await ping(DUEL_TOPIC)
    return out
  }

  async function cancel(user, msg) {
    const out = await db.tx(async (q) => {
      const d = (await q(`select * from public.juegos_duelos where id = $1 for update`, [msg.id])).rows[0]
      if (!d || d.estado !== 'abierto' || d.reta !== user.id) return { error: 'DUEL_GONE' }
      await q(`update public.juegos_duelos set estado = 'cancelado', jugado = now() where id = $1`, [d.id])
      await move(q, { [user.id]: Number(d.apuesta) })
      return { id: Number(d.id) }
    })
    if (!out.error) await ping(DUEL_TOPIC)
    return out
  }

  async function handle(user, msg) {
    if (msg.a === 'retar') return challenge(user, msg)
    if (msg.a === 'aceptar') return accept(user, msg)
    if (msg.a === 'cancelar') return cancel(user, msg)
    if (msg.a !== 'lista') return { error: 'BAD_MESSAGE' }
    return {}
  }

  // Limpieza semanal (con el reinicio del saldo): los retos abiertos se cancelan sin devolver (el saldo ya se reinició)
  // y se borra el historial de más de 7 días.
  async function sweep(q) {
    await q(`update public.juegos_duelos set estado = 'cancelado', jugado = now() where estado = 'abierto'`)
    await q(`delete from public.juegos_duelos where creado < now() - interval '7 days'`)
  }

  return { handle, list, sweep }
}
