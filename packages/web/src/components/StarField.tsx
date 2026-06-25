import { useEffect, useRef } from 'react'
import './StarField.css'

/* Genera una cadena de box-shadows con `count` puntos aleatorios */
function makeShadows(count: number): string {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 2000)
    const y = Math.floor(Math.random() * 2000)
    out.push(`${x}px ${y}px var(--star-color)`)
  }
  return out.join(',')
}

export default function StarField() {
  const small   = useRef<HTMLDivElement>(null)
  const medium  = useRef<HTMLDivElement>(null)
  const large   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const s1 = makeShadows(700)
    const s2 = makeShadows(200)
    const s3 = makeShadows(100)

    if (small.current)  { small.current.style.boxShadow = s1 }
    if (medium.current) { medium.current.style.boxShadow = s2 }
    if (large.current)  { large.current.style.boxShadow = s3 }

    /* Los pseudo-elements ::after duplican exactamente los mismos shadows
       para que la animación translateY(-2000px) cree un loop infinito  */
    const style = document.createElement('style')
    style.textContent = `
      .starfield-small::after  { box-shadow: ${s1} !important; }
      .starfield-medium::after { box-shadow: ${s2} !important; }
      .starfield-large::after  { box-shadow: ${s3} !important; }
    `
    document.head.appendChild(style)
    return () => { style.remove() }
  }, [])

  return (
    <div className="starfield" aria-hidden="true">
      <div ref={small}  className="starfield-layer starfield-small"  />
      <div ref={medium} className="starfield-layer starfield-medium" />
      <div ref={large}  className="starfield-layer starfield-large"  />
    </div>
  )
}
