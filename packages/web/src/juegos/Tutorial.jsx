import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { eur } from './money.js'
import './tutorial.css'

// Guía de Juegos: la primera vez que entras en la temporada se abre sola (y luego con el botón «Tutorial»). Cada paso
// ilumina una zona del selector (data-tour="…") y la explica con un dibujo. Si la zona no existe (p. ej. la banca, que
// solo ve el master), el paso se salta.
export const TUTORIAL_KEY = 'juegos-tutorial-season2'
export const START = 15000

const Art = {
  // Bienvenida: trofeo con «2» y estrellas.
  season: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="tut-gold" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="1" stopColor="#e0a21b" />
        </linearGradient>
      </defs>
      <path d="M36 22h48v18c0 18-10 30-24 30S36 58 36 40z" fill="url(#tut-gold)" />
      <path d="M36 28H22c0 14 8 22 18 22M84 28h14c0 14-8 22-18 22" fill="none" stroke="#e0a21b" strokeWidth="6" />
      <rect x="52" y="70" width="16" height="16" fill="#e0a21b" />
      <rect x="38" y="86" width="44" height="12" rx="4" fill="url(#tut-gold)" />
      <text x="60" y="56" textAnchor="middle" fontSize="28" fontWeight="900" fill="#7a4a06">2</text>
      {[
        [14, 18],
        [104, 14],
        [100, 70],
        [16, 76],
      ].map(([x, y], i) => (
        <path key={i} className="tut-twinkle" style={{ animationDelay: `${i * 0.3}s` }} d={`M${x} ${y - 7}L${x + 2} ${y - 2}L${x + 7} ${y}L${x + 2} ${y + 2}L${x} ${y + 7}L${x - 2} ${y + 2}L${x - 7} ${y}L${x - 2} ${y - 2}Z`} fill="#fff6d6" />
      ))}
    </svg>
  ),
  money: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <g key={i} className="tut-stack" style={{ animationDelay: `${i * 0.12}s` }}>
          <ellipse cx="60" cy={92 - i * 14} rx="34" ry="11" fill="#b97c0e" />
          <ellipse cx="60" cy={88 - i * 14} rx="34" ry="11" fill="#f2c14e" stroke="#b97c0e" strokeWidth="2" />
        </g>
      ))}
      <text x="60" y="51" textAnchor="middle" fontSize="16" fontWeight="900" fill="#7a4a06">€</text>
    </svg>
  ),
  podium: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <rect x="44" y="40" width="32" height="60" rx="4" fill="#f2c14e" />
      <rect x="10" y="60" width="32" height="40" rx="4" fill="#c9d3db" />
      <rect x="78" y="72" width="32" height="28" rx="4" fill="#d38a55" />
      <text x="60" y="76" textAnchor="middle" fontSize="22" fontWeight="900" fill="#7a4a06">1</text>
      <text x="26" y="86" textAnchor="middle" fontSize="18" fontWeight="900" fill="#3a434e">2</text>
      <text x="94" y="92" textAnchor="middle" fontSize="16" fontWeight="900" fill="#5a2c10">3</text>
      <path className="tut-bob" d="M52 30l4-10 4 8 4-8 4 10z" fill="#f2c14e" />
    </svg>
  ),
  games: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle className="tut-spin" cx="40" cy="44" r="24" fill="none" stroke="#e2463c" strokeWidth="10" strokeDasharray="8 6" />
      <circle cx="40" cy="44" r="8" fill="#f2c14e" />
      <path className="tut-rocket" d="M78 86 L96 30 L104 50 Z" fill="#f1e9d6" />
      <circle cx="84" cy="96" r="6" fill="#ff8a3d" className="tut-flame" />
      <ellipse cx="34" cy="96" rx="22" ry="7" fill="#3fbf75" />
      <circle cx="34" cy="86" r="9" fill="#7cd36a" />
    </svg>
  ),
  duel: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <g className="tut-clash-l">
        <path d="M20 100 L74 46" stroke="#c9d3db" strokeWidth="8" strokeLinecap="round" />
        <path d="M14 94 L26 106" stroke="#f2c14e" strokeWidth="8" strokeLinecap="round" />
      </g>
      <g className="tut-clash-r">
        <path d="M100 100 L46 46" stroke="#c9d3db" strokeWidth="8" strokeLinecap="round" />
        <path d="M106 94 L94 106" stroke="#f2c14e" strokeWidth="8" strokeLinecap="round" />
      </g>
      <circle className="tut-spark" cx="60" cy="58" r="10" fill="#ff6b7d" />
    </svg>
  ),
  tables: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="66" rx="50" ry="30" fill="#14394f" stroke="#c8a24b" strokeWidth="4" />
      <rect className="tut-card1" x="40" y="48" width="18" height="26" rx="3" fill="#fff" />
      <rect className="tut-card2" x="62" y="48" width="18" height="26" rx="3" fill="#fff" />
      <text x="49" y="66" textAnchor="middle" fontSize="11" fontWeight="900" fill="#c8102e">A</text>
      <text x="71" y="66" textAnchor="middle" fontSize="11" fontWeight="900" fill="#10141a">K</text>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={20 + i * 20} cy={i % 2 ? 100 : 30} r="7" fill="#3d9f89" />
      ))}
    </svg>
  ),
  gacha: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      {[-16, 0, 16].map((r, i) => (
        <g key={i} transform={`rotate(${r} 60 100)`}>
          <rect x="44" y="24" width="32" height="48" rx="5" fill={['#8a4fd6', '#f2c14e', '#2f7be0'][i]} stroke="#fff" strokeWidth="3" />
        </g>
      ))}
      <path className="tut-twinkle" d="M60 34l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fff" />
    </svg>
  ),
  bank: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M60 14 L104 36 H16 Z" fill="#f2c14e" />
      {[26, 46, 66, 86].map((x) => (
        <rect key={x} x={x} y="42" width="10" height="44" fill="#e9cf86" />
      ))}
      <rect x="14" y="88" width="92" height="12" rx="3" fill="#f2c14e" />
      <text x="60" y="33" textAnchor="middle" fontSize="12" fontWeight="900" fill="#7a4a06">€</text>
    </svg>
  ),
  go: (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="44" fill="#3fbf75" className="tut-pulse" />
      <path d="M48 38 L84 60 L48 82 Z" fill="#fff" />
    </svg>
  ),
}

const STEPS = [
  {
    art: 'season',
    title: '¡Bienvenidos a la Season 2!',
    text: `Empieza una temporada nueva: todos volvéis a la casilla de salida con ${eur(START)}. Te enseñamos todo lo que hay en Juegos en un minuto.`,
    hero: true,
  },
  {
    target: 'me',
    art: 'money',
    title: 'Tu saldo de la semana',
    text: `Aquí ves tu dinero. Empiezas con ${eur(START)} y lo usas en todos los juegos. Cada domingo a las 23:59 todos vuelven a ${eur(START)}.`,
  },
  {
    target: 'score',
    art: 'podium',
    title: 'La clasificación',
    text: 'Quien más dinero tenga el domingo gana la semana. Toca aquí para ver el podio, tu puesto, cuánto te falta para subir y la gráfica de cada uno.',
  },
  {
    target: 'solo',
    art: 'games',
    title: 'Juegos para jugar solo',
    text: 'Ruleta, Cohete y Carrera son en vivo (la misma ronda para todos); Laberinto, Plinko y Rana, a tu ritmo. Cada uno tiene su botón de Ayuda arriba a la derecha.',
  },
  {
    target: 'duel',
    art: 'duel',
    title: 'Duelos 1 contra 1',
    text: 'Reta a alguien a cara o cruz, dados o carta alta. Pones la apuesta, el otro pone lo mismo y quien gana se lo lleva todo. Te avisamos cuando alguien te reta.',
  },
  {
    target: 'live',
    art: 'tables',
    title: 'Mesas en vivo',
    text: 'Blackjack y póker con la gente de TopCode. Siéntate a jugar o entra a mirar, chatea en la mesa e invita a tus amigos con un enlace.',
  },
  {
    target: 'gacha',
    art: 'gacha',
    title: 'El gacha',
    text: 'Colecciona cartas de personajes de videojuegos: coge gratis las que salen en la mesa o invoca pagando. Cada carta tiene poderes para los juegos. Hay una sola Mítica…',
  },
  {
    target: 'bank',
    art: 'bank',
    title: 'La banca (solo tú)',
    text: 'Como master, desde aquí das dinero, mandas mensajes a todos y activas el Admin Abuse.',
  },
  {
    art: 'go',
    title: '¡A jugar!',
    text: 'Puedes volver a ver esta guía cuando quieras con el botón «Tutorial» de arriba. ¡Suerte en la Season 2!',
    hero: true,
  },
]

const PAD = 10

export default function Tutorial({ onClose }) {
  const steps = STEPS.filter((s) => !s.target || document.querySelector(`[data-tour="${s.target}"]`))
  const [i, setI] = useState(0)
  const [box, setBox] = useState(null)
  const step = steps[i]

  const close = useCallback(() => {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1')
    } catch {
      // sin almacenamiento: volverá a salir la próxima vez
    }
    onClose()
  }, [onClose])

  // Lleva la zona a la vista y mide dónde está (también al cambiar el tamaño de la ventana).
  useLayoutEffect(() => {
    if (!step.target) {
      setBox(null)
      return
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 })
    }
    measure()
    const timer = setInterval(measure, 120) // sigue al scroll suave
    const stop = setTimeout(() => clearInterval(timer), 900)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearInterval(timer)
      clearTimeout(stop)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step.target])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight' || e.key === 'Enter') setI((n) => Math.min(steps.length - 1, n + 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, steps.length])

  const last = i === steps.length - 1
  // La tarjeta va debajo de la zona si cabe; si no, encima. Sin zona, en el centro.
  // Si no cabe ni debajo ni encima (zona muy alta), se pega abajo de la pantalla.
  const vh = window.innerHeight
  const CARD_H = 320
  const left = box ? Math.max(12, Math.min(box.x, window.innerWidth - 392)) : 0
  let cardStyle = null
  if (box) {
    if (box.y + box.h + CARD_H < vh) cardStyle = { top: box.y + box.h + 16, left }
    else if (box.y > CARD_H) cardStyle = { top: 'auto', bottom: vh - box.y + 16, left }
    else cardStyle = { top: 'auto', bottom: 16, left }
  }

  return createPortal(
    <div className={`tut ${step.hero ? 'tut--hero' : ''}`} role="dialog" aria-modal="true" aria-labelledby="tut-title">
      {box ? (
        <span className="tut__hole" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden="true" />
      ) : (
        <span className="tut__veil" aria-hidden="true" />
      )}
      {step.hero && (
        <span className="tut__confetti" aria-hidden="true">
          {Array.from({ length: 40 }, (_, k) => (
            <i key={k} style={{ '--x': `${(k * 37) % 100}vw`, '--t': `${((k * 0.21) % 2.4).toFixed(2)}s`, '--c': ['#ffe08a', '#ff6b7d', '#6dffb4', '#7fb8ff', '#c99bff'][k % 5] }} />
          ))}
        </span>
      )}
      <div key={i} className={`tut__card ${box ? 'is-pinned' : ''}`} style={cardStyle ?? undefined}>
        <div className="tut__art">{Art[step.art]}</div>
        {step.hero && i === 0 && <p className="tut__kicker">Juegos de TopCode</p>}
        <h2 id="tut-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="tut__dots" aria-label={`Paso ${i + 1} de ${steps.length}`}>
          {steps.map((_, k) => (
            <button key={k} type="button" className={k === i ? 'is-on' : ''} aria-label={`Ir al paso ${k + 1}`} onClick={() => setI(k)} />
          ))}
        </div>
        <div className="tut__btns">
          {i > 0 ? (
            <button type="button" className="tut__ghost" onClick={() => setI(i - 1)}>
              Atrás
            </button>
          ) : (
            <button type="button" className="tut__ghost" onClick={close}>
              Saltar
            </button>
          )}
          <button type="button" className="tut__next" onClick={() => (last ? close() : setI(i + 1))} autoFocus>
            {last ? '¡A jugar!' : i === 0 ? 'Empezar el tour' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
