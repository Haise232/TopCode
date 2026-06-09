# useDataInit

**Ruta real:** `src/hooks/useDataInit.ts`

## Qué es / qué hace

Hook utilitario muy pequeño: envuelve un `useEffect` para ejecutar una función de inicialización asíncrona (`initFn`) **una sola vez al montar** (o cuando cambian las `deps`), evitando los problemas de cierre (closures) sobre funciones que cambian en cada render — guarda siempre la versión más reciente en una `ref` (`initRef`) y la llama desde dentro del efecto.

```ts
useDataInit(() => fetchAlgo(), [usuarioId])
```

## Exporta

- `export function useDataInit(initFn: () => Promise<void>, deps?: readonly unknown[])`

## Depende de

- Solo de `react` (`useEffect`, `useRef`)

## Lo usan

Es un hook genérico de soporte; revisa los `useEffect` de inicialización en las páginas y otros hooks de datos para ver patrones equivalentes (muchos implementan la misma idea manualmente con `useCallback` + `useEffect`).

## Notas

- El comentario JSDoc del propio fichero explica el propósito: pasar una `ref` de `mounted` para que el hook de datos pueda abortar actualizaciones tras el desmontaje (patrón usado de forma manual — con `mountedRef` — en [[useNotas]], [[useApuntes]], [[useActividades]], [[useEventos]], [[useHomeDatos]], [[useMensajes]]).
- Las reglas de ESLint sobre `exhaustive-deps` están deshabilitadas a propósito en este fichero porque `deps` se pasa dinámicamente.

#hook #utilidad
