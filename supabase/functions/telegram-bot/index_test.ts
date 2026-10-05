// Se prueba el handler exportado directamente. Sin red ni BD: fetch se sustituye
// por un espia y no se definen SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (getDb()
// lanza, y el try/catch de handler.ts lo convierte en 200).

import { assertEquals } from 'jsr:@std/assert@1'
import { handler } from './handler.ts'

const SECRETO = 'secreto-de-prueba-0123456789'
const CABECERA = 'X-Telegram-Bot-Api-Secret-Token'

type Handler = (req: Request) => Response | Promise<Response>

const llamadasFetch: string[] = []

/** Ejecuta fn con fetch espiado, sin credenciales de BD y con el secreto configurado. */
async function conEntorno(fn: (h: Handler) => Promise<void>, secreto: string | null = SECRETO): Promise<void> {
  const h: Handler = handler
  const fetchOriginal = globalThis.fetch
  const guardado = {
    s: Deno.env.get('TELEGRAM_WEBHOOK_SECRET'),
    u: Deno.env.get('SUPABASE_URL'),
    k: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    t: Deno.env.get('TELEGRAM_BOT_TOKEN'),
  }
  llamadasFetch.length = 0
  globalThis.fetch = (input: Request | URL | string) => {
    llamadasFetch.push(String(input instanceof Request ? input.url : input))
    return Promise.reject(new Error('red bloqueada en tests'))
  }
  if (secreto === null) Deno.env.delete('TELEGRAM_WEBHOOK_SECRET')
  else Deno.env.set('TELEGRAM_WEBHOOK_SECRET', secreto)
  Deno.env.delete('SUPABASE_URL')
  Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
  Deno.env.delete('TELEGRAM_BOT_TOKEN')
  const origError = console.error
  console.error = () => {}
  try {
    await fn(h)
  } finally {
    console.error = origError
    globalThis.fetch = fetchOriginal
    for (const [k, v] of [
      ['TELEGRAM_WEBHOOK_SECRET', guardado.s],
      ['SUPABASE_URL', guardado.u],
      ['SUPABASE_SERVICE_ROLE_KEY', guardado.k],
      ['TELEGRAM_BOT_TOKEN', guardado.t],
    ] as const) {
      if (v === undefined) Deno.env.delete(k)
      else Deno.env.set(k, v)
    }
  }
}

function post(body: unknown, cabeceras: Record<string, string> = {}): Request {
  return new Request('http://localhost/telegram-bot', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...cabeceras },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

Deno.test('POST sin cabecera secreta -> 401', async () => {
  await conEntorno(async (h) => {
    const r = await h(post({}))
    assertEquals(r.status, 401)
    await r.body?.cancel()
  })
})

Deno.test('POST con cabecera secreta incorrecta -> 401', async () => {
  await conEntorno(async (h) => {
    for (const mal of ['otro', SECRETO + 'x', SECRETO.slice(0, -1), SECRETO.toUpperCase()]) {
      const r = await h(post({}, { [CABECERA]: mal }))
      assertEquals(r.status, 401, `valor «${mal}»`)
      await r.body?.cancel()
    }
  })
})

Deno.test('POST con cabecera vacia -> 401', async () => {
  await conEntorno(async (h) => {
    const r = await h(post({}, { [CABECERA]: '' }))
    assertEquals(r.status, 401)
    await r.body?.cancel()
  })
})

Deno.test('secreto no configurado en el entorno -> 401 incluso con cabecera', async () => {
  await conEntorno(async (h) => {
    const r = await h(post({}, { [CABECERA]: SECRETO }))
    assertEquals(r.status, 401)
    const r2 = await h(post({}, { [CABECERA]: '' }))
    assertEquals(r2.status, 401)
    await r.body?.cancel()
    await r2.body?.cancel()
  }, null)
})

Deno.test('401 no ejecuta nada: ni red ni lectura del body', async () => {
  await conEntorno(async (h) => {
    const r = await h(post({ message: { chat: { id: 1, type: 'private' }, from: { id: 1 }, text: '/ayuda' } }))
    assertEquals(r.status, 401)
    await r.body?.cancel()
    assertEquals(llamadasFetch.length, 0)
  })
})

Deno.test('GET, PUT, DELETE, HEAD y OPTIONS -> 405 con Allow: POST (incluso con secreto correcto)', async () => {
  await conEntorno(async (h) => {
    for (const metodo of ['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']) {
      const r = await h(new Request('http://localhost/telegram-bot', { method: metodo, headers: { [CABECERA]: SECRETO } }))
      assertEquals(r.status, 405, metodo)
      assertEquals(r.headers.get('Allow'), 'POST', metodo)
      await r.body?.cancel()
    }
  })
})

Deno.test('secreto correcto y update vacio -> 200', async () => {
  await conEntorno(async (h) => {
    const r = await h(post({}, { [CABECERA]: SECRETO }))
    assertEquals(r.status, 200)
    await r.body?.cancel()
    assertEquals(llamadasFetch.length, 0)
  })
})

Deno.test('secreto correcto y update de grupo -> 200 sin red ni BD', async () => {
  await conEntorno(async (h) => {
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: -100, type: 'group' }, from: { id: 5 }, text: 'examen mañana' },
    }
    for (const tipo of ['group', 'supergroup', 'channel']) {
      update.message.chat.type = tipo
      const r = await h(post(update, { [CABECERA]: SECRETO }))
      assertEquals(r.status, 200, tipo)
      await r.body?.cancel()
    }
    assertEquals(llamadasFetch.length, 0)
  })
})

Deno.test('mensaje privado sin texto o con texto en blanco -> 200 sin red', async () => {
  await conEntorno(async (h) => {
    const base = { message_id: 1, chat: { id: 5, type: 'private' }, from: { id: 5 } }
    for (const m of [base, { ...base, text: '   ' }, { ...base, photo: [] }, { chat: base.chat, text: 'hola' }]) {
      const r = await h(post({ update_id: 1, message: m }, { [CABECERA]: SECRETO }))
      assertEquals(r.status, 200)
      await r.body?.cancel()
    }
    assertEquals(llamadasFetch.length, 0)
  })
})

Deno.test('JSON invalido, body vacio y tipos raros -> 200 (Telegram no debe reintentar)', async () => {
  await conEntorno(async (h) => {
    for (const cuerpo of ['{no es json', '', 'null', '[]', '"texto"', '123']) {
      const r = await h(post(cuerpo, { [CABECERA]: SECRETO }))
      assertEquals(r.status, 200, `cuerpo «${cuerpo}»`)
      await r.body?.cancel()
    }
  })
})

Deno.test('body mayor de 64 KiB (por content-length o real) -> 200 sin procesar', async () => {
  await conEntorno(async (h) => {
    const enorme = JSON.stringify({ update_id: 1, pad: 'x'.repeat(70 * 1024) })
    const r1 = await h(post(enorme, { [CABECERA]: SECRETO }))
    assertEquals(r1.status, 200)
    await r1.body?.cancel()
    const r2 = await h(post('{}', { [CABECERA]: SECRETO, 'content-length': String(70 * 1024) }))
    assertEquals(r2.status, 200)
    await r2.body?.cancel()
    assertEquals(llamadasFetch.length, 0)
  })
})

Deno.test('fallo de BD (sin credenciales) en mensaje privado -> 200 y sin escribir nada', async () => {
  await conEntorno(async (h) => {
    const upd = {
      update_id: 2,
      message: { message_id: 3, chat: { id: 5, type: 'private' }, from: { id: 5 }, text: 'examen jueves 22 AED' },
    }
    const r = await h(post(upd, { [CABECERA]: SECRETO }))
    assertEquals(r.status, 200)
    await r.body?.cancel()
    // Ninguna llamada a la API de Supabase (REST) por falta de credenciales.
    assertEquals(llamadasFetch.filter((u) => u.includes('supabase')).length, 0)
  })
})

Deno.test('callback_query con datos invalidos -> 200', async () => {
  await conEntorno(async (h) => {
    for (const data of ['ok:no-es-uuid', 'zz:00000000-0000-0000-0000-000000000000', undefined]) {
      const upd = {
        update_id: 3,
        callback_query: {
          id: 'c1',
          from: { id: 5 },
          data,
          message: { message_id: 9, chat: { id: 5, type: 'private' } },
        },
      }
      const r = await h(post(upd, { [CABECERA]: SECRETO }))
      assertEquals(r.status, 200)
      await r.body?.cancel()
    }
    assertEquals(llamadasFetch.filter((u) => u.includes('supabase')).length, 0)
  })
})

Deno.test('callbacks "t:", "m:" y "f:" malformados -> 200 sin tocar la BD', async () => {
  await conEntorno(async (h) => {
    const uuid = '00000000-0000-0000-0000-000000000000'
    const malos: string[] = []
    for (const c of ['t', 'm', 'f']) {
      malos.push(`${c}:no-es-uuid:1`, `${c}:${uuid}:99`, `${c}:${uuid}:-1`, `${c}:${uuid}:x`, `${c}:${uuid}`)
    }
    malos.push(`t:${uuid}:6`, `m:${uuid}:10`, `f:${uuid}:3`)
    for (const data of malos) {
      const upd = {
        update_id: 4,
        callback_query: {
          id: 'c2',
          from: { id: 5 },
          data,
          message: { message_id: 9, chat: { id: 5, type: 'private' } },
        },
      }
      const r = await h(post(upd, { [CABECERA]: SECRETO }))
      assertEquals(r.status, 200, data)
      await r.body?.cancel()
    }
    assertEquals(llamadasFetch.filter((u) => u.includes('supabase')).length, 0)
  })
})
