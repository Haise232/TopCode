// Logica del webhook de Telegram (el punto de entrada es index.ts).
// Webhook de Telegram para crear eventos del calendario de TopCode.
// Se despliega con verify_jwt desactivado: la autenticacion es el secret_token.

import { parseEvento, TEXTO_MAX } from './parser.ts'
import {
  claseDeVinculado,
  consumirCodigo,
  consumirPendiente,
  crearEventoTelegram,
  desvincular,
  descartarPendiente,
  guardarPendiente,
  obtenerAutorizacion,
  proximosEventos,
} from './db.ts'
import type { EventoResumen, PayloadPendiente } from './db.ts'
import { editarMensaje, enviarMensaje, responderCallback } from './telegram.ts'
import type { TgCallbackQuery, TgMessage, TgUpdate } from './telegram.ts'

const MAX_BODY_BYTES = 64 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ZONA = 'Europe/Madrid'

const TEXTO_VINCULAR =
  'Hola, soy el bot de TopCode. Para usarlo debes vincular tu cuenta:\n\n' +
  '1. Entra en la web de TopCode como administrador, en Perfil > Telegram.\n' +
  '2. Pulsa "Vincular Telegram" (el código caduca en 10 minutos).\n' +
  '3. Envíame aquí: /vincular 123456 (con tu código).'

const AVISO_VINCULO_NUEVO =
  'Tu cuenta de TopCode se ha vinculado a otra cuenta de Telegram. ' +
  'Si no has sido tú, desvincula desde el Perfil de la web'

const TEXTO_AYUDA =
  'Puedo crear eventos en el calendario de tu clase. Escríbeme una frase y te pediré confirmación.\n\n' +
  'Ejemplos:\n' +
  '• examen jueves 22 AED\n' +
  '• entrega 7/11 DPL 23:59\n' +
  '• tutoría mañana a las 10\n' +
  '• examen lunes que viene\n\n' +
  'Comandos:\n' +
  '/proximos - próximos 10 eventos de tu clase\n' +
  '/vincular <código> - vincular tu cuenta\n' +
  '/desvincular - desvincular tu cuenta\n' +
  '/ayuda - este mensaje'

// ------------------------------------------------------------ seguridad

async function sha256(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))
}

/** Comparacion en tiempo constante (se comparan hashes de longitud fija). */
async function secretoValido(recibido: string | null, esperado: string): Promise<boolean> {
  if (!recibido) return false
  const [a, b] = await Promise.all([sha256(recibido), sha256(esperado)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function leerBodyLimitado(req: Request): Promise<string | null> {
  const declarado = Number(req.headers.get('content-length') ?? '0')
  if (declarado > MAX_BODY_BYTES) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    partes.push(value)
  }
  const todo = new Uint8Array(total)
  let pos = 0
  for (const p of partes) {
    todo.set(p, pos)
    pos += p.length
  }
  return new TextDecoder().decode(todo)
}

/** Mensaje de error sin volcar objetos completos (PostgrestError no es Error). */
function msgError(err: unknown): string {
  const m = (err as { message?: unknown } | null)?.message
  return typeof m === 'string' ? m.slice(0, 200) : 'desconocido'
}

// ------------------------------------------------------------ formato

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dia = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

function lineaEvento(e: { titulo: string; fecha: string; hora: string | null; materia: string | null }): string {
  const partes = [e.titulo, fechaLegible(e.fecha)]
  if (e.hora) partes.push(e.hora)
  if (e.materia) partes.push(e.materia)
  return partes.join(' · ')
}

function hoyMadrid(): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? ''
  return `${v('year')}-${v('month')}-${v('day')}`
}

// ------------------------------------------------------------ handlers

async function manejarComando(
  chatId: number,
  telegramId: number,
  username: string | null,
  comando: string,
  args: string,
): Promise<void> {
  if (comando === '/vincular') {
    const res = args ? await consumirCodigo(args.trim(), telegramId, username) : null
    const ok = res !== null
    await enviarMensaje(
      chatId,
      ok
        ? 'Cuenta vinculada. Ya puedes escribirme eventos; usa /ayuda para ver ejemplos.'
        : 'No se ha podido vincular. Genera un código nuevo en la web e inténtalo de nuevo.',
    )
    if (res && res.telegramAnterior !== null) {
      // En un chat privado, chat_id == user id. Los errores de envio se ignoran.
      try {
        await enviarMensaje(res.telegramAnterior, AVISO_VINCULO_NUEVO)
      } catch { /* ignorado */ }
    }
    return
  }

  const auth = await obtenerAutorizacion(telegramId)
  if (auth.estado === 'no_vinculado') {
    await enviarMensaje(chatId, TEXTO_VINCULAR)
    return
  }

  switch (comando) {
    case '/start':
    case '/ayuda':
      await enviarMensaje(chatId, TEXTO_AYUDA)
      return
    case '/desvincular':
      await desvincular(telegramId)
      await enviarMensaje(chatId, 'Cuenta desvinculada. Puedes volver a vincularla cuando quieras.')
      return
    case '/proximos': {
      const clase = await claseDeVinculado(telegramId)
      if (!clase) {
        await enviarMensaje(chatId, 'Tu cuenta no tiene una clase activa asignada.')
        return
      }
      const eventos: EventoResumen[] = await proximosEventos(clase, hoyMadrid(), 10)
      await enviarMensaje(
        chatId,
        eventos.length === 0
          ? 'No hay eventos próximos en tu clase.'
          : 'Próximos eventos:\n\n' + eventos.map((e) => '• ' + lineaEvento(e)).join('\n'),
      )
      return
    }
    default:
      await enviarMensaje(chatId, 'Comando no reconocido. Usa /ayuda.')
  }
}

async function manejarTexto(chatId: number, telegramId: number, texto: string): Promise<void> {
  const auth = await obtenerAutorizacion(telegramId)
  if (auth.estado === 'no_vinculado') {
    await enviarMensaje(chatId, TEXTO_VINCULAR)
    return
  }
  if (auth.estado === 'sin_permiso') {
    await enviarMensaje(chatId, 'Tu cuenta no tiene permiso para crear eventos (hace falta ser administrador con clase asignada).')
    return
  }
  if (texto.length > TEXTO_MAX) {
    await enviarMensaje(chatId, `El mensaje es demasiado largo (máximo ${TEXTO_MAX} caracteres).`)
    return
  }

  const r = parseEvento(texto, new Date())
  if (!r.ok) {
    await enviarMensaje(chatId, r.error)
    return
  }

  const payload: PayloadPendiente = { titulo: r.titulo, fecha: r.fecha, hora: r.hora, materia: r.materia }
  const id = await guardarPendiente(telegramId, payload)

  let resumen = '📅 ' + lineaEvento(payload)
  if (r.avisos.length > 0) resumen += '\n\n' + r.avisos.map((a) => '⚠️ ' + a).join('\n')
  resumen += '\n\n¿Lo creo en el calendario?'

  await enviarMensaje(chatId, resumen, {
    inline_keyboard: [[
      { text: '✅ Crear', callback_data: `ok:${id}` },
      { text: '❌ Cancelar', callback_data: `no:${id}` },
    ]],
  })
}

async function manejarCallback(cb: TgCallbackQuery): Promise<void> {
  // Siempre se responde al callback para quitar el "reloj" del cliente.
  await responderCallback(cb.id)

  const msg = cb.message
  if (!msg || msg.chat.type !== 'private') return
  const chatId = msg.chat.id
  const mensajeId = msg.message_id
  const telegramId = cb.from.id

  const m = /^(ok|no):(.+)$/.exec(cb.data ?? '')
  if (!m || !UUID_RE.test(m[2])) return
  const [, accion, id] = m

  if (accion === 'no') {
    await descartarPendiente(id, telegramId)
    await editarMensaje(chatId, mensajeId, 'Cancelado.')
    return
  }

  // Consumo atomico: un doble clic solo obtiene el pendiente una vez.
  const pendiente = await consumirPendiente(id, telegramId)
  if (!pendiente) {
    await editarMensaje(chatId, mensajeId, 'Caducado, vuelve a escribirlo.')
    return
  }

  // La RPC revalida admin, clase y aprobado e inserta de forma atomica.
  let eventoId: string | null
  try {
    eventoId = await crearEventoTelegram(telegramId, pendiente)
  } catch (err) {
    console.error('Error al insertar evento:', msgError(err))
    await editarMensaje(chatId, mensajeId, 'No se ha podido crear el evento. Vuelve a escribirlo.')
    return
  }
  if (!eventoId) {
    await editarMensaje(chatId, mensajeId, 'No tienes permiso para crear eventos')
    return
  }
  await editarMensaje(chatId, mensajeId, '✅ Evento creado:\n' + lineaEvento(pendiente))
}

async function manejarMensaje(msg: TgMessage): Promise<void> {
  if (msg.chat.type !== 'private' || !msg.from || typeof msg.text !== 'string') return
  const chatId = msg.chat.id
  const telegramId = msg.from.id
  const texto = msg.text.trim()
  if (!texto) return

  if (texto.startsWith('/')) {
    const [primero, ...resto] = texto.split(/\s+/)
    const comando = primero.split('@')[0].toLowerCase()
    await manejarComando(chatId, telegramId, msg.from.username ?? null, comando, resto.join(' '))
    return
  }
  await manejarTexto(chatId, telegramId, texto)
}

async function procesar(update: TgUpdate): Promise<void> {
  if (update.callback_query) await manejarCallback(update.callback_query)
  else if (update.message) await manejarMensaje(update.message)
}

// ------------------------------------------------------------ servidor

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })

  const esperado = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (!esperado) {
    console.error('TELEGRAM_WEBHOOK_SECRET no configurado')
    return new Response('Unauthorized', { status: 401 })
  }
  if (!(await secretoValido(req.headers.get('X-Telegram-Bot-Api-Secret-Token'), esperado))) {
    return new Response('Unauthorized', { status: 401 })
  }

  // A partir de aqui siempre 200 para que Telegram no reintente en bucle.
  try {
    const cuerpo = await leerBodyLimitado(req)
    if (cuerpo === null) {
      console.error('Body demasiado grande')
      return new Response('ok')
    }
    await procesar(JSON.parse(cuerpo) as TgUpdate)
  } catch (err) {
    console.error('Error procesando update:', msgError(err))
  }
  return new Response('ok')
}
