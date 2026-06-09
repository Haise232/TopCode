# useAuth

**Ruta real:** `src/hooks/useAuth.ts`

## Qué es / qué hace

Fichero de **re-exportación**: todo el contenido es

```ts
export { useAuth } from '../contexts/AuthContext'
```

Existe para que el resto del código pueda importar `useAuth` desde `hooks/useAuth` (siguiendo la convención "un hook por dominio") sin acoplarse directamente a la ruta del contexto. La implementación real vive en [[AuthContext]].

## Exporta

- `useAuth` (re-export de `contexts/AuthContext`)

## Depende de

- [[AuthContext]]

## Lo usan

Casi todas las páginas y varios componentes: [[Layout]], [[AnuncioModal]], [[PrivateMessageToast]], [[Home]], [[Profile]], [[Chat]], [[Apuntes]], [[Actividades]], [[Calendar]], [[Admin]], [[News]], etc. — siempre vía `import { useAuth } from '../hooks/useAuth'`.

## Notas

- Si necesitas modificar el comportamiento de autenticación (sesión, perfil, caché), edita [[AuthContext]], no este fichero.

#hook #auth
