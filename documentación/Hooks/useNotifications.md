# useNotifications

**Ruta real:** `src/hooks/useNotifications.ts`

## Qué es / qué hace

Wrapper ligero sobre la **Notification API** del navegador:

- `requestPermission()`: pide permiso de notificaciones si aún no se ha concedido/denegado; cachea el resultado en una `ref` (`permissionRef`) para no volver a preguntar.
- `notify(title, options)`: crea una notificación nativa **solo si** ya hay permiso concedido **y** la pestaña no está visible (`document.visibilityState !== 'visible'`) — evita notificar cuando el usuario ya está mirando la app. Acepta un `onClick` extra en las opciones que enfoca la ventana y cierra la notificación al pulsarla.

## Exporta

- `export function useNotifications()` → `{ requestPermission, notify }`

## Depende de

- Solo de la `Notification` API global del navegador y `react` (`useCallback`, `useEffect`, `useRef`)

## Lo usan

- [[PrivateMessageToast]] — único consumidor: pide permiso al detectar usuario autenticado y notifica al recibir un mensaje privado mientras la pestaña está oculta.

## Notas

- Maneja con cuidado entornos donde `Notification` no existe (`typeof Notification !== 'undefined'`), para no romper SSR/navegadores antiguos.

#hook #notificaciones #navegador
