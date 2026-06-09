# PrivateMessageToast

**Ruta real:** `src/components/PrivateMessageToast.tsx`

## Qué es / qué hace

Toast flotante (esquina inferior izquierda) que aparece cuando el usuario recibe un **mensaje privado** nuevo, mientras no está en la pantalla de chat (`/chat`). Se suscribe a un canal Realtime de Supabase (`private-msg-toast-{userId}`) filtrando `INSERT` en `mensajes_privados` donde `para_id = miId`.

Comportamiento:
- Si la pestaña no está visible, dispara además una **notificación nativa del navegador** vía [[useNotifications]] (`notify`), con click que navega a `/chat`.
- Si el usuario ya está en `/chat`, no muestra el toast en pantalla (usa `pathnameRef` para no re-suscribirse al cambiar de ruta).
- El toast se autodestruye a los 5 segundos (`timerRef`) o se puede cerrar manualmente / pulsar "Abrir" para ir al chat.
- `getHue(nombre)` calcula un color HSL determinista a partir del nombre del remitente, para el avatar.

## Exporta

- `export default function PrivateMessageToast()` — sin props.

## Depende de

- [[useAuth]], [[useNotifications]]
- [[lib-supabase]] (canal realtime `postgres_changes`)
- [[lib-types]] (`MensajePrivado`)
- `react-router-dom` (`useNavigate`, `useLocation`)

## Lo usan

- [[Layout]] — montado una vez, visible en cualquier ruta protegida.

## Notas

- Solicita permiso de notificaciones del navegador en cuanto detecta un usuario autenticado (`requestPermission()`).
- Filtra explícitamente `msg.de_id === uid` para nunca notificarse a sí mismo (defensa extra, aunque el filtro de servidor `para_id=eq.${uid}` ya debería excluirlo).
- Tabla relacionada: `mensajes_privados` (ver [[../Base-de-datos/supabase-setup|supabase-setup]]).

#componente #realtime #notificaciones #chat
