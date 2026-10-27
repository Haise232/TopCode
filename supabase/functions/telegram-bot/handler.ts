// Logica del webhook de Telegram (el punto de entrada es index.ts).
// Webhook de Telegram para crear eventos del calendario de TopCode.
// Se despliega con verify_jwt desactivado: la autenticacion es el secret_token.

import { parseFechaHora, TEXTO_MAX, TITULO_MAX } from './parser.ts'
import { MATERIAS } from './materias.ts'
import {
  avanzarPendiente,
  claseDeVinculado,
  consumirCodigo,
  consumirPendiente,
  crearEventoTelegram,
  desvincular,
  descartarPendiente,
  iniciarAsistente,
  obtenerAutorizacion,
  pendienteEsperandoTexto,
  proximosEventos,
} from './db.ts'
import type { EventoResumen, Paso, PayloadPendiente } from './db.ts'
import { esTipoEvento, etiquetaTipo, TIPOS_EVENTO } from './tipos.ts'
import { editarMensaje, enviarMensaje, responderCallback } from './telegram.ts'
import type { TgCallbackQuery, TgMessage, TgUpdate } from './telegram.ts'

const MAX_BODY_BYTES = 64 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ZONA = 'Europe/Madrid'
const DESCRIPCION_MAX = 1000

const TEXTO_VINCULAR =
  'Hola, soy el bot de TopCode. Para usarlo debes vincular tu cuenta:\n\n' +
  '1. Entra en la web de TopCode como administrador, en Perfil > Telegram.\n' +
  '2. Pulsa "Vincular Telegram" (el código caduca en 10 minutos).\n' +
  '3. Envíame aquí: /vincular 123456 (con tu código).'

const AVISO_VINCULO_NUEVO =
  'Tu cuenta de TopCode se ha vinculado a otra cuenta de Telegram. ' +
  'Si no has sido tú, desvincula desde el Perfil de la web'

const TEXTO_AYUDA =
  'Te guío paso a paso para crear un evento en el calendario de tu clase:\n\n' +
  '1. Escríbeme el título del evento (texto libre, p. ej. "Entrega proyecto final").\n' +
  '2. Elige el tipo con los botones (actividad, trabajo, examen teórico, examen práctico, presentación o especial).\n' +
  '3. Elige la asignatura (o "Sin asignatura").\n' +
  '4. Indica la fecha de fin: pulsa Hoy / Mañana / Pasado mañana o escríbela (p. ej. "viernes", "22/10", "jueves 23:59", "mañana a las 10").\n' +
  '5. Revisa el resumen y pulsa Crear. Si quieres, antes pulsa "Añadir descripción" y escríbela (opcional).\n\n' +
  'En cualquier paso puedes pulsar Cancelar. El asistente caduca a los 30 minutos sin actividad.\n\n' +
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

function emojiTipo(t: string | null | undefined): string {
  return TIPOS_EVENTO.find((x) => x.id === t)?.emoji ?? ''
}

function lineaEvento(e: { titulo: string; fecha: string; hora: string | null; materia: string | null }): string {
  const partes = [e.titulo, fechaLegible(e.fecha)]
  if (e.hora) partes.push(e.hora)
  if (e.materia) partes.push(e.materia)
  return partes.join(' · ')
}

/** Prefijo "<emoji> <Etiqueta>" del tipo (vacio si el tipo no es valido). */
function prefijoTipo(t: string | null | undefined): string {
  if (!esTipoEvento(t)) return ''
  return `${emojiTipo(t)} ${etiquetaTipo(t)}`
}

function lineaConTipo(e: { titulo: string; fecha: string; hora: string | null; materia: string | null; tipo?: string | null }): string {
  const p = prefijoTipo(e.tipo)
  return p ? `${p} · ${lineaEvento(e)}` : lineaEvento(e)
}

const BTN_CANCELAR = (id: string) => ({ text: '❌ Cancelar', callback_data: `no:${id}` })

function fila<T>(items: T[], n: number): T[][] {
  const filas: T[][] = []
  for (let i = 0; i < items.length; i += n) filas.push(items.slice(i, i + n))
  return filas
}

function tecladoTipo(id: string) {
  const botones = TIPOS_EVENTO.map((t, i) => ({ text: `${t.emoji} ${t.label}`, callback_data: `t:${id}:${i}` }))
  return { inline_keyboard: [...fila(botones, 2), [BTN_CANCELAR(id)]] }
}

function tecladoMateria(id: string) {
  const botones = MATERIAS.map((m, i) => ({ text: m.nombreCorto, callback_data: `m:${id}:${i}` }))
  botones.push({ text: 'Sin asignatura', callback_data: `m:${id}:${MATERIAS.length}` })
  return { inline_keyboard: [...fila(botones, 2), [BTN_CANCELAR(id)]] }
}

function tecladoFecha(id: string) {
  return {
    inline_keyboard: [
      [
        { text: 'Hoy', callback_data: `f:${id}:0` },
        { text: 'Mañana', callback_data: `f:${id}:1` },
        { text: 'Pasado mañana', callback_data: `f:${id}:2` },
      ],
      [BTN_CANCELAR(id)],
    ],
  }
}

function tecladoConfirmar(id: string, p: PayloadPendiente) {
  return {
    inline_keyboard: [
      [{ text: p.descripcion ? '✏️ Cambiar descripción' : '🗒️ Añadir descripción', callback_data: `d:${id}` }],
      [{ text: '✅ Crear', callback_data: `ok:${id}` }, BTN_CANCELAR(id)],
    ],
  }
}

function tecladoDescripcion(id: string) {
  return {
    inline_keyboard: [
      [{ text: 'Sin descripción', callback_data: `sd:${id}` }],
      [BTN_CANCELAR(id)],
    ],
  }
}

function resumenCompleto(p: PayloadPendiente, avisos: string[] = []): string {
  const fecha = p.fecha ? fechaLegible(p.fecha) + (p.hora ? ` · ${p.hora}` : '') : ''
  let t = `${p.tipo ? prefijoTipo(p.tipo) : ''}\n📝 ${p.titulo}\n📚 ${p.materia ?? 'Sin asignatura'}\n📅 ${fecha}`
  if (p.descripcion) t += `\n🗒️ ${p.descripcion}`
  if (avisos.length > 0) t += '\n\n' + avisos.map((a) => '⚠️ ' + a).join('\n')
  return t + '\n\n¿Lo creo en el calendario?'
}

const TEXTO_DESCRIPCION =
  `🗒️ Escribe la descripción del evento (máximo ${DESCRIPCION_MAX} caracteres) o pulsa «Sin descripción».`

const TEXTO_FECHA =
  '📅 ¿Fecha de fin? Escríbela (p. ej. «viernes», «22/10», «jueves 23:59», «mañana a las 10») o pulsa un botón.'

/** Pregunta (texto + teclado) correspondiente al paso del pendiente. */
function preguntaPaso(id: string, p: PayloadPendiente): { texto: string; teclado: ReturnType<typeof tecladoTipo> } {
  switch (p.paso) {
    case 'tipo':
      return { texto: `📝 Título: ${p.titulo}\n\n¿Qué es?`, teclado: tecladoTipo(id) }
    case 'materia':
      return { texto: `📝 ${p.titulo}\n${prefijoTipo(p.tipo)}\n\n📚 ¿De qué asignatura?`, teclado: tecladoMateria(id) }
    case 'fecha':
      return { texto: `📝 ${p.titulo}\n${prefijoTipo(p.tipo)}\n📚 ${p.materia ?? 'Sin asignatura'}\n\n${TEXTO_FECHA}`, teclado: tecladoFecha(id) }
    case 'descripcion':
      return { texto: `📝 ${p.titulo}\n\n${TEXTO_DESCRIPCION}`, teclado: tecladoDescripcion(id) }
    default:
      return { texto: resumenCompleto(p), teclado: tecladoConfirmar(id, p) }
  }
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(y, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Titulo desde texto libre: trim, espacios colapsados, sin control, primera en mayuscula. */
function normalizarTitulo(texto: string): string {
  const t = texto.replace(/\p{C}/gu, ' ').replace(/\s+/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Descripcion desde texto libre: conserva saltos de linea, quita otros caracteres de control. */
function normalizarDescripcion(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[^\P{C}\n]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
          : 'Próximos eventos:\n\n' + eventos.map((e) => '• ' + lineaConTipo(e)).join('\n'),
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

  const esperando = await pendienteEsperandoTexto(telegramId)

  // Si hay un asistente esperando la descripcion, el texto es la descripcion.
  if (esperando?.payload.paso === 'descripcion') {
    const descripcion = normalizarDescripcion(texto)
    if (descripcion.length > DESCRIPCION_MAX) {
      await enviarMensaje(
        chatId,
        `La descripción es demasiado larga (${descripcion.length} caracteres, máximo ${DESCRIPCION_MAX}). Acórtala y vuelve a enviarla.`,
        tecladoDescripcion(esperando.id),
      )
      return
    }
    const nuevo = await avanzarPendiente(esperando.id, telegramId, 'descripcion', {
      descripcion: descripcion || null,
      paso: 'confirmar',
    })
    if (nuevo === null || nuevo === 'otro_paso') {
      await enviarMensaje(chatId, 'Caducado, vuelve a escribirlo.')
      return
    }
    await enviarMensaje(chatId, resumenCompleto(nuevo), tecladoConfirmar(esperando.id, nuevo))
    return
  }

  if (texto.length > TEXTO_MAX) {
    await enviarMensaje(chatId, `El mensaje es demasiado largo (máximo ${TEXTO_MAX} caracteres).`)
    return
  }

  // Si hay un asistente esperando la fecha, el texto es la fecha.
  const enFecha = esperando?.payload.paso === 'fecha' ? esperando : null
  if (enFecha) {
    const r = parseFechaHora(texto, new Date())
    if (!r.ok) {
      await enviarMensaje(chatId, r.error + '\n\nEscribe otra fecha o pulsa Cancelar.', { inline_keyboard: [[BTN_CANCELAR(enFecha.id)]] })
      return
    }
    const nuevo = await avanzarPendiente(enFecha.id, telegramId, 'fecha', {
      fecha: r.fecha,
      hora: r.hora,
      paso: 'confirmar',
    })
    if (nuevo === null || nuevo === 'otro_paso') {
      await enviarMensaje(chatId, 'Caducado, vuelve a escribirlo.')
      return
    }
    await enviarMensaje(chatId, resumenCompleto(nuevo, r.avisos), tecladoConfirmar(enFecha.id, nuevo))
    return
  }

  // Nuevo asistente: el texto es el titulo.
  const titulo = normalizarTitulo(texto)
  if (!titulo) return
  if (titulo.length > TITULO_MAX) {
    await enviarMensaje(chatId, `El título es demasiado largo (máximo ${TITULO_MAX} caracteres).`)
    return
  }
  const id = await iniciarAsistente(telegramId, titulo)
  const q = preguntaPaso(id, { titulo, tipo: null, materia: null, fecha: null, hora: null, descripcion: null, paso: 'tipo' })
  await enviarMensaje(chatId, q.texto, q.teclado)
}

async function manejarCallback(cb: TgCallbackQuery): Promise<void> {
  // Siempre se responde al callback para quitar el "reloj" del cliente.
  await responderCallback(cb.id)

  const msg = cb.message
  if (!msg || msg.chat.type !== 'private') return
  const chatId = msg.chat.id
  const mensajeId = msg.message_id
  const telegramId = cb.from.id

  // Pasos: t:<uuid>:<i> (tipo), m:<uuid>:<i> (materia), f:<uuid>:<0|1|2> (fecha rapida).
  const paso = /^([tmf]):([^:]+):(\d{1,2})$/.exec(cb.data ?? '')
  if (paso) {
    const [, clase, id, idxTxt] = paso
    const idx = Number(idxTxt)
    if (!UUID_RE.test(id)) return
    let esperado: Paso
    let cambios: Partial<Omit<PayloadPendiente, 'titulo'>>
    if (clase === 't') {
      if (idx >= TIPOS_EVENTO.length) return
      esperado = 'tipo'
      cambios = { tipo: TIPOS_EVENTO[idx].id, paso: 'materia' }
    } else if (clase === 'm') {
      if (idx > MATERIAS.length) return
      esperado = 'materia'
      cambios = { materia: idx === MATERIAS.length ? null : MATERIAS[idx].nombreCorto, paso: 'fecha' }
    } else {
      if (idx > 2) return
      esperado = 'fecha'
      cambios = { fecha: sumarDias(hoyMadrid(), idx), hora: null, paso: 'confirmar' }
    }
    const nuevo = await avanzarPendiente(id, telegramId, esperado, cambios)
    if (nuevo === 'otro_paso') return
    if (!nuevo) {
      await editarMensaje(chatId, mensajeId, 'Caducado, vuelve a escribirlo.')
      return
    }
    const q = preguntaPaso(id, nuevo)
    await editarMensaje(chatId, mensajeId, q.texto, q.teclado)
    return
  }

  // Descripcion: d:<uuid> (pedirla desde el resumen), sd:<uuid> (volver sin descripcion).
  const desc = /^(d|sd):([^:]+)$/.exec(cb.data ?? '')
  if (desc) {
    const [, accion, id] = desc
    if (!UUID_RE.test(id)) return
    const nuevo = accion === 'd'
      ? await avanzarPendiente(id, telegramId, 'confirmar', { paso: 'descripcion' })
      : await avanzarPendiente(id, telegramId, 'descripcion', { descripcion: null, paso: 'confirmar' })
    if (nuevo === 'otro_paso') return
    if (!nuevo) {
      await editarMensaje(chatId, mensajeId, 'Caducado, vuelve a escribirlo.')
      return
    }
    const q = preguntaPaso(id, nuevo)
    await editarMensaje(chatId, mensajeId, q.texto, q.teclado)
    return
  }

  const m = /^(ok|no):(.+)$/.exec(cb.data ?? '')
  if (!m || !UUID_RE.test(m[2])) return
  const [, accion, id] = m

  if (accion === 'no') {
    await descartarPendiente(id, telegramId)
    await editarMensaje(chatId, mensajeId, 'Cancelado.')
    return
  }

  // Consumo atomico (solo en paso 'confirmar'): un doble clic solo lo obtiene una vez.
  const pendiente = await consumirPendiente(id, telegramId)
  if (!pendiente) {
    await editarMensaje(chatId, mensajeId, 'Caducado, vuelve a escribirlo.')
    return
  }

  // Revalidacion del payload completo antes de crear.
  const { titulo, tipo, fecha, hora, materia, descripcion } = pendiente
  const materiaOk = materia === null || MATERIAS.some((x) => x.nombreCorto === materia)
  if (
    !titulo || titulo.length > TITULO_MAX || !esTipoEvento(tipo) || !materiaOk ||
    !fecha || !FECHA_RE.test(fecha) || (hora !== null && !HORA_RE.test(hora)) ||
    (descripcion !== null && descripcion.length > DESCRIPCION_MAX)
  ) {
    await editarMensaje(chatId, mensajeId, 'Faltan datos del evento. Vuelve a escribirlo.')
    return
  }

  // La RPC revalida admin, clase y aprobado e inserta de forma atomica.
  let eventoId: string | null
  try {
    eventoId = await crearEventoTelegram(telegramId, { titulo, tipo, fecha, hora, materia, descripcion })
  } catch (err) {
    console.error('Error al insertar evento:', msgError(err))
    await editarMensaje(chatId, mensajeId, 'No se ha podido crear el evento. Vuelve a escribirlo.')
    return
  }
  if (!eventoId) {
    await editarMensaje(chatId, mensajeId, 'No tienes permiso para crear eventos')
    return
  }
  let creado = '✅ Evento creado:\n' + lineaConTipo({ titulo, tipo, fecha, hora, materia })
  if (descripcion) creado += `\n🗒️ ${descripcion}`
  await editarMensaje(chatId, mensajeId, creado)
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
