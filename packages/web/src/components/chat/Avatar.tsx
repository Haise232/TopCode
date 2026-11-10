import { colorNombre, matiz } from './color'

/**
 * Avatar circular. Sin foto: inicial sobre un fondo suave del matiz del nombre; el texto se
 * oscurece en modo claro (tinta) para mantener el contraste en los dos modos.
 */
export function Avatar({ nombre, url, size = 36 }: { nombre: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className="object-cover shrink-0 rounded-full border border-ov/[0.1]"
        style={{ width: size, height: size }}
      />
    )
  }
  const h = matiz(nombre)
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center shrink-0 rounded-full font-bold select-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: `hsl(${h} 60% 50% / 0.18)`,
        border: `1px solid hsl(${h} 60% 50% / 0.32)`,
        color: colorNombre(nombre),
      }}
    >
      {nombre[0]?.toUpperCase() ?? '?'}
    </span>
  )
}
