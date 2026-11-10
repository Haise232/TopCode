import { tinta } from '../../lib/tinta'

export function matiz(nombre: string) {
  return nombre.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
}

/** Color de texto legible del nombre de una persona (el mismo matiz que su avatar). */
export const colorNombre = (nombre: string) => tinta(`hsl(${matiz(nombre)}, 65%, 62%)`)
