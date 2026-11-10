function getHue(s: string) {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
}

/**
 * Chip con la inicial del autor. El tono sale del nombre; el fondo es una mezcla
 * translúcida y la letra se oscurece en modo claro (--oscurecer) para mantener el contraste.
 */
export function Avatar({ nombre, size = 36 }: { nombre: string; size?: number }) {
  const hue = getHue(nombre)
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center shrink-0 font-bold select-none"
      style={{
        width: size, height: size,
        borderRadius: size > 36 ? 12 : 10,
        background: `hsl(${hue} 60% 55% / 0.16)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 60% 55% / 0.28)`,
        color: `color-mix(in srgb, hsl(${hue} 80% 72%), black calc(var(--oscurecer) * 1.6))`,
        fontSize: size * 0.4,
      }}
    >
      {nombre[0]?.toUpperCase() ?? '?'}
    </span>
  )
}
