# Chat

**Ruta real:** `src/pages/Chat.tsx` · **Ruta de la app:** `/chat`

## Qué es / qué hace

Página de mensajería con dos modos, gestionados con `subTab: 'publico' | 'privado'`:

- **`PublicChat`**: sala general en tiempo real, usa [[useMensajes]]→`usePublicMensajes`. Incluye `DateSeparator` (separadores de fecha), `LoadingDots`, `BubbleRow` (burbuja de mensaje agrupable), `MessageInput`, `EmptyPublicChat`.
- **`PrivateChat`**: conversación 1-a-1 con un `peer: UsuarioPublico` seleccionado, usa [[useMensajes]]→`usePrivateMensajes`.
- **`UserList`**: buscador/listado de usuarios (`usuarios_publicos`) para iniciar un chat privado, con filtro por `query`.
- **`DesktopSidebar`** / **`MobileTabBar`**: navegación entre lista de usuarios y conversación, adaptada a layout responsive.
- `Avatar`: componente de avatar reutilizado dentro de la página (con iniciales y color HSL determinista si no hay `avatar_url`).

El estado `selectedUser: UsuarioPublico | null` controla qué conversación privada está abierta.

## Exporta

- `export default function Chat()`

## Depende de

- [[useAuth]]
- [[useMensajes]] (`usePublicMensajes`, `usePrivateMensajes`)
- [[lib-supabase]] (`supabase` — para cargar `usuarios_publicos` en `UserList`)
- [[lib-types]] (`Usuario`, `UsuarioPublico`)

## Lo usan

- [[App]] — ruta protegida `/chat`, enlazada desde [[Layout]] (icono `MessageCircle`).
- [[PrivateMessageToast]] navega aquí (`navigate('/chat')`) al pulsar un toast de mensaje privado.

## Notas

- `UserList` consulta la **vista pública** `usuarios_publicos` (sin `email` ni `es_superadmin` — ver [[../Base-de-datos/supabase-setup|supabase-setup]] y [[../../claude-notes/Seguridad|Seguridad]]), no la tabla `usuarios` directamente.
- El layout de esta página es notablemente complejo: si necesitas tocar el responsive (mobile/desktop), revisa juntos `DesktopSidebar` y `MobileTabBar`.

#pagina #chat #realtime #mensajeria
