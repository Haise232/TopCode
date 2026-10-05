# telegram-bot

Edge Function (Deno) que recibe el webhook de un bot de Telegram para que los
administradores de una clase creen eventos del calendario escribiendo frases
como "examen jueves 22 AED". Siempre pide confirmación con botones antes de
insertar.

Archivos: `index.ts` (punto de entrada, solo `Deno.serve(handler)`), `handler.ts` (flujo del webhook), `telegram.ts` (cliente de la Bot API),
`db.ts` (acceso a Supabase), `parser.ts` y `materias.ts` (interpretación del texto).
Requiere aplicar, en este orden, `supabase/migracion_telegram.sql` y después
`supabase/migracion_telegram_v2.sql` (RPC `crear_evento_telegram`, nueva firma de
`consumir_codigo_telegram` y columna `telegram_username`).

En Vercel (frontend) hay que definir `VITE_TELEGRAM_BOT_USERNAME` con el usuario del
bot (sin `@`) para que el Perfil muestre el enlace al bot.

## 1. Crear el bot en BotFather

1. En Telegram abre @BotFather y envía `/newbot`.
2. Elige nombre y usuario (debe acabar en `bot`).
3. Guarda el token que te da. No lo pegues en el repo ni en chats.

## 2. Secretos

Genera el secreto del webhook (solo letras y números hexadecimales, válido para Telegram):

```bash
openssl rand -hex 32
```

Guárdalos en el proyecto de Supabase:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=<token-de-botfather> TELEGRAM_WEBHOOK_SECRET=<secreto-generado>
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase. Los secretos
deben existir antes de registrar el webhook.

## 3. Despliegue

La función se despliega con **verify_jwt desactivado**: Telegram no envía JWT,
así que la autenticación la hace la cabecera `X-Telegram-Bot-Api-Secret-Token`
(comparada en tiempo constante; si falta o no coincide, responde 401).

```bash
supabase functions deploy telegram-bot --no-verify-jwt
```

## 4. Registrar el webhook

```bash
curl -sS "https://api.telegram.org/bot<token-de-botfather>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<project-ref>.supabase.co/functions/v1/telegram-bot",
    "secret_token": "<secreto-generado>",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Comprueba con `getWebhookInfo` que no aparece `last_error_message`:

```bash
curl -sS "https://api.telegram.org/bot<token-de-botfather>/getWebhookInfo"
```

## Uso

1. Un admin con clase asignada abre Perfil > Telegram en la web y genera un código (caduca en 10 min).
2. En el chat privado con el bot: `/vincular 123456`.
3. Escribe el evento, p. ej. "entrega 7/11 DPL 23:59", y pulsa "Crear".

Es un asistente paso a paso: (1) escribes el título (texto libre), (2) eliges el tipo (actividad, trabajo, examen teórico, examen práctico, presentación, especial), (3) la asignatura o "Sin asignatura", (4) la fecha de fin (botones Hoy/Mañana/Pasado mañana o escribiéndola, p. ej. "viernes", "22/10", "jueves 23:59"), (5) confirmas con "Crear". Hay un botón Cancelar en cada paso. El estado vive en `telegram_pendientes.payload` (`paso`: tipo | materia | fecha | confirmar) y caduca a los 30 min, renovándose en cada paso; los botones de pasos anteriores se ignoran. `/proximos` muestra el tipo de cada evento.

Comandos: `/start`, `/ayuda`, `/vincular <código>`, `/proximos`, `/desvincular`.

## Seguridad

- Solo chats privados; grupos ignorados.
- Al confirmar, la RPC `crear_evento_telegram` (solo `service_role`) revalida vínculo, `admin`, `estado_acceso = 'aprobado'` y clase, e inserta de forma atómica. `clase` y `created_by` salen siempre de la tabla `usuarios`.
- Si un usuario vincula otra cuenta de Telegram, se avisa a la anterior.
- El pendiente se consume con `DELETE ... RETURNING` filtrando por id y por el usuario que pulsa: un doble clic no duplica el evento.
- Tras autenticar la petición se responde siempre 200 para evitar reintentos de Telegram; los errores se registran sin tokens ni mensajes completos.
