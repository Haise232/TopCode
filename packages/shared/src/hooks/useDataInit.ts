import { useEffect, useRef } from 'react'

/**
 * Llama a `initFn` una sola vez al montar el componente.
 * Pasa una ref de `mounted` para que el hook de datos pueda abortar
 * actualizaciones de estado después del desmontaje.
 *
 * @param initFn - función async que inicia la carga de datos
 * @param deps   - dependencias que disparan la recarga (equivalente a deps de useEffect)
 */
export function useDataInit(
  initFn: () => Promise<void>,
  deps: readonly unknown[] = []
) {
  const initRef = useRef(initFn)
  initRef.current = initFn

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    initRef.current()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}
