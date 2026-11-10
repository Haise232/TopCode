import { useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import './Pattern.css'

/** Fondo de la app. En Navidad añade una nevada suave dibujada en canvas. */
export default function Pattern() {
  const { navidad } = useTheme()
  return (
    <div className="pattern-container" aria-hidden="true">
      {navidad && <Nieve />}
    </div>
  )
}

interface Copo { x: number; y: number; r: number; vy: number; fase: number; amp: number; alfa: number }

export function Nieve({ densidad = 1 }: { densidad?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let ancho = 0
    let alto = 0
    let copos: Copo[] = []
    let raf = 0
    let ultimo = performance.now()

    const nuevoCopo = (yAleatoria: boolean): Copo => {
      const r = Math.random() * 1.8 + 0.6
      return {
        x: Math.random() * ancho,
        y: yAleatoria ? Math.random() * alto : -4,
        r,
        vy: 12 + r * 14,               // px/s: los copos grandes caen más rápido (parecen más cerca)
        fase: Math.random() * Math.PI * 2,
        amp: 6 + Math.random() * 14,
        alfa: 0.25 + Math.random() * 0.55,
      }
    }

    const redimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ancho = canvas.clientWidth
      alto = canvas.clientHeight
      canvas.width = ancho * dpr
      canvas.height = alto * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const total = Math.round(Math.min(140, (ancho * alto) / 14000) * densidad)
      copos = Array.from({ length: total }, () => nuevoCopo(true))
      if (quieto) dibujar(0)
    }

    const dibujar = (dt: number) => {
      ctx.clearRect(0, 0, ancho, alto)
      ctx.fillStyle = '#ffffff'
      for (const c of copos) {
        c.y += c.vy * dt
        c.fase += dt * 0.8
        if (c.y > alto + 4) Object.assign(c, nuevoCopo(false))
        ctx.globalAlpha = c.alfa
        ctx.beginPath()
        ctx.arc(c.x + Math.sin(c.fase) * c.amp, c.y, c.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const bucle = (t: number) => {
      const dt = Math.min((t - ultimo) / 1000, 0.05)
      ultimo = t
      dibujar(dt)
      raf = requestAnimationFrame(bucle)
    }

    const visibilidad = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !quieto) {
        ultimo = performance.now()
        raf = requestAnimationFrame(bucle)
      }
    }

    redimensionar()
    const ro = new ResizeObserver(redimensionar)
    ro.observe(canvas)
    document.addEventListener('visibilitychange', visibilidad)
    visibilidad()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', visibilidad)
    }
  }, [densidad])

  return <canvas ref={ref} />
}
