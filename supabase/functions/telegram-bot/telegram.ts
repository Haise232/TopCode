// Cliente minimo de la Bot API de Telegram con fetch. Sin parse_mode: el texto
// se envia siempre como texto plano, asi que no hace falta escapar nada.

export interface TgUser {
  id: number
  username?: string
}

export interface TgChat {
  id: number
  type: string
}

export interface TgMessage {
  message_id: number
  from?: TgUser
  chat: TgChat
  text?: string
}

export interface TgCallbackQuery {
  id: string
  from: TgUser
  data?: string
  message?: TgMessage
}

export interface TgUpdate {
  update_id?: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}

export interface BotonInline {
  text: string
  callback_data: string
}

type Teclado = { inline_keyboard: BotonInline[][] }

async function llamar(metodo: string, cuerpo: Record<string, unknown>): Promise<void> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN no configurado')
    return
  }
  try {
    // La URL contiene el token: nunca se registra.
    const resp = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) {
      console.error(`Telegram ${metodo} fallo con estado ${resp.status}`)
    }
  } catch (err) {
    console.error(`Telegram ${metodo} error de red:`, err instanceof Error ? err.name : 'desconocido')
  }
}

export function enviarMensaje(chatId: number, texto: string, teclado?: Teclado): Promise<void> {
  return llamar('sendMessage', {
    chat_id: chatId,
    text: texto,
    ...(teclado ? { reply_markup: teclado } : {}),
  })
}

/** Edita el mensaje; sin teclado, quita los botones (inline_keyboard vacio). */
export function editarMensaje(chatId: number, messageId: number, texto: string, teclado?: Teclado): Promise<void> {
  return llamar('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: texto,
    reply_markup: teclado ?? { inline_keyboard: [] },
  })
}

export function responderCallback(callbackId: string, texto?: string): Promise<void> {
  return llamar('answerCallbackQuery', {
    callback_query_id: callbackId,
    ...(texto ? { text: texto } : {}),
  })
}
