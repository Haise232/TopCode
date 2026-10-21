// Arte procedural de la Carrera de coches (canvas 2D, sin imágenes): circuito, fondo nocturno, sprites de los coches y partículas.
// Todo se precalcula una sola vez (circuito, fondo, sprites) y la escena solo dibuja copias, para mantener 60 fps.
import { CAR_INFO } from './race.js'

export const WORLD_W = 1900
export const WORLD_H = 1160
export const TRACK_W = 230
export const CAR_L = 60
export const LANE_GAP = 34

// ---------- utilidades ----------
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvasOf(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

function rr(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

export function rrPath(g, x, y, w, h, r) {
  rr(g, x, y, w, h, r)
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Mezcla un color con negro (amt<0) o blanco (amt>0).
export function shade(hex, amt) {
  const [r, gg, b] = hexRgb(hex)
  const t = amt < 0 ? 0 : 255
  const k = Math.abs(amt)
  return `rgb(${Math.round(r + (t - r) * k)},${Math.round(gg + (t - gg) * k)},${Math.round(b + (t - b) * k)})`
}

export function rgba(hex, a) {
  const [r, g, b] = hexRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

// ---------- el circuito ----------
const CTRL = [
  [1130, 962], [1440, 945], [1700, 862], [1785, 665], [1705, 470], [1510, 380], [1320, 400], [1170, 515], [985, 590], [800, 525],
  [748, 405], [700, 285], [585, 190], [400, 165], [225, 280], [165, 500], [225, 720], [330, 885], [560, 960],
]

function buildTrack() {
  const n = CTRL.length
  const raw = []
  const STEPS = 24
  for (let i = 0; i < n; i++) {
    const p0 = CTRL[(i - 1 + n) % n]
    const p1 = CTRL[i]
    const p2 = CTRL[(i + 1) % n]
    const p3 = CTRL[(i + 2) % n]
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS
      const t2 = t * t
      const t3 = t2 * t
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      raw.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  const m0 = raw.length
  const cum = new Float64Array(m0 + 1)
  for (let i = 0; i < m0; i++) {
    const a = raw[i]
    const b = raw[(i + 1) % m0]
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  const L = cum[m0]
  const M = Math.round(L / 8)
  const px = new Float32Array(M)
  const py = new Float32Array(M)
  let j = 0
  for (let i = 0; i < M; i++) {
    const d = (i / M) * L
    while (cum[j + 1] < d) j++
    const a = raw[j]
    const b = raw[(j + 1) % m0]
    const f = (d - cum[j]) / (cum[j + 1] - cum[j] || 1)
    px[i] = a[0] + (b[0] - a[0]) * f
    py[i] = a[1] + (b[1] - a[1]) * f
  }
  const tx = new Float32Array(M)
  const ty = new Float32Array(M)
  for (let i = 0; i < M; i++) {
    const a = (i - 1 + M) % M
    const b = (i + 1) % M
    const dx = px[b] - px[a]
    const dy = py[b] - py[a]
    const l = Math.hypot(dx, dy) || 1
    tx[i] = dx / l
    ty[i] = dy / l
  }
  const ds = L / M
  const kr = new Float32Array(M)
  for (let i = 0; i < M; i++) {
    const a = (i - 1 + M) % M
    const b = (i + 1) % M
    let d = Math.atan2(ty[b], tx[b]) - Math.atan2(ty[a], tx[a])
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    kr[i] = d / (2 * ds)
  }
  const k = new Float32Array(M)
  for (let i = 0; i < M; i++) {
    let s = 0
    for (let w = -8; w <= 8; w++) s += kr[(i + w + M) % M]
    k[i] = s / 17
  }
  return { M, L, ds, px, py, tx, ty, k }
}

export const track = buildTrack()
export const LEN = track.L

// Punto del circuito a `u` vueltas (0 = línea de meta) y desplazamiento lateral `lat` (positivo = hacia el exterior).
export function at(u, lat, out) {
  const { M, px, py, tx, ty, k } = track
  const f = (u - Math.floor(u)) * M
  const i0 = Math.floor(f)
  const i = i0 % M
  const j = (i + 1) % M
  const a = f - i0
  let dx = tx[i] + (tx[j] - tx[i]) * a
  let dy = ty[i] + (ty[j] - ty[i]) * a
  const l = Math.hypot(dx, dy) || 1
  dx /= l
  dy /= l
  const x = px[i] + (px[j] - px[i]) * a
  const y = py[i] + (py[j] - py[i]) * a
  out.x = x - dy * lat
  out.y = y + dx * lat
  out.tx = dx
  out.ty = dy
  out.k = k[i] + (k[j] - k[i]) * a
  return out
}

function pathOf(lat, close = true) {
  const p = new Path2D()
  const o = { x: 0, y: 0 }
  const n = track.M
  for (let i = 0; i < n; i++) {
    at(i / n, lat, o)
    if (i === 0) p.moveTo(o.x, o.y)
    else p.lineTo(o.x, o.y)
  }
  if (close) p.closePath()
  return p
}

export const centerPath = pathOf(0)
export const neonInner = pathOf(-(TRACK_W / 2 + 34))
export const neonOuter = pathOf(TRACK_W / 2 + 34)

// Farolas: posición de la cabeza y del pie junto a la pista.
export const poles = (() => {
  const list = []
  const o = { x: 0, y: 0 }
  const n = 34
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1
    at(i / n + 0.004, side * (TRACK_W / 2 + 56), o)
    list.push({ x: o.x, y: o.y, tx: o.tx, ty: o.ty, side })
  }
  return list
})()

function insidePoly(x, y) {
  const { px, py, M } = track
  let inside = false
  for (let i = 0, j = M - 1; i < M; j = i++) {
    if (py[i] > y !== py[j] > y && x < ((px[j] - px[i]) * (y - py[i])) / (py[j] - py[i]) + px[i]) inside = !inside
  }
  return inside
}

function distToTrack(x, y) {
  const { px, py, M } = track
  let best = 1e9
  for (let i = 0; i < M; i += 3) {
    const d = (px[i] - x) ** 2 + (py[i] - y) ** 2
    if (d < best) best = d
  }
  return Math.sqrt(best)
}

// ---------- fondo: ciudad nocturna, césped, árboles, gradas ----------
export function makeBackground() {
  const c = canvasOf(WORLD_W, WORLD_H)
  const g = c.getContext('2d')
  const R = rng(7)
  g.fillStyle = '#071219'
  g.fillRect(0, 0, WORLD_W, WORLD_H)

  // Césped segado a franjas en todo el mundo (la ciudad lo tapará por fuera).
  for (let i = -WORLD_H; i < WORLD_W; i += 46) {
    g.fillStyle = (i / 46) & 1 ? '#0d2a1d' : '#0b2418'
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i + 23, 0)
    g.lineTo(i + 23 + WORLD_H, WORLD_H)
    g.lineTo(i + WORLD_H, WORLD_H)
    g.fill()
  }
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = `rgba(${R() < 0.5 ? '160,255,190' : '0,0,0'},${0.03 + R() * 0.04})`
    g.fillRect(R() * WORLD_W, R() * WORLD_H, 1 + R() * 2, 1 + R() * 2)
  }

  // Ciudad al otro lado de la pista.
  const lights = []
  for (let gy = 0; gy < WORLD_H; gy += 44) {
    for (let gx = 0; gx < WORLD_W; gx += 44) {
      const x = gx + R() * 6
      const y = gy + R() * 6
      const d = distToTrack(x + 20, y + 20)
      if (d < 260 || insidePoly(x + 20, y + 20)) continue
      if (R() < 0.12) continue
      g.fillStyle = '#05090d'
      g.fillRect(gx - 4, gy - 4, 52, 52)
      const w = 28 + R() * 12
      const h = 28 + R() * 12
      const tone = 18 + R() * 20
      g.fillStyle = `rgb(${tone},${tone + 8},${tone + 18})`
      g.fillRect(x, y, w, h)
      g.fillStyle = 'rgba(255,255,255,0.05)'
      g.fillRect(x, y, w, 2)
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.fillRect(x + w - 3, y, 3, h)
      for (let wy = y + 4; wy < y + h - 3; wy += 6) {
        for (let wx = x + 4; wx < x + w - 5; wx += 6) {
          if (R() < 0.42) {
            g.fillStyle = R() < 0.8 ? 'rgba(255,214,120,0.75)' : 'rgba(120,225,255,0.75)'
            g.fillRect(wx, wy, 3, 2)
          }
        }
      }
      if (R() < 0.18) lights.push([x + w / 2, y + h / 2, R() < 0.5 ? '255,60,90' : '70,200,255'])
    }
  }
  g.globalCompositeOperation = 'lighter'
  for (const [x, y, col] of lights) {
    const gr = g.createRadialGradient(x, y, 0, x, y, 40)
    gr.addColorStop(0, `rgba(${col},0.5)`)
    gr.addColorStop(1, `rgba(${col},0)`)
    g.fillStyle = gr
    g.fillRect(x - 40, y - 40, 80, 80)
  }
  g.globalCompositeOperation = 'source-over'

  // Árboles en el campo interior y alrededor.
  for (let i = 0; i < 520; i++) {
    const x = R() * WORLD_W
    const y = R() * WORLD_H
    const d = distToTrack(x, y)
    if (d < TRACK_W / 2 + 120 || d > 330 && !insidePoly(x, y)) continue
    const r = 9 + R() * 11
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.beginPath()
    g.arc(x + 4, y + 5, r, 0, 7)
    g.fill()
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r)
    gr.addColorStop(0, '#2f7d4a')
    gr.addColorStop(1, '#0f3a24')
    g.fillStyle = gr
    g.beginPath()
    g.arc(x, y, r, 0, 7)
    g.fill()
  }

  // Un lago en el interior (reflejos de neón).
  g.save()
  g.translate(640, 400)
  const lake = g.createRadialGradient(0, 0, 10, 0, 0, 120)
  lake.addColorStop(0, '#0f4a63')
  lake.addColorStop(1, '#082a3a')
  g.fillStyle = lake
  g.beginPath()
  g.ellipse(0, 0, 150, 70, -0.2, 0, 7)
  g.fill()
  g.strokeStyle = 'rgba(120,230,255,0.25)'
  g.lineWidth = 2
  for (let i = -3; i <= 3; i++) {
    g.beginPath()
    g.ellipse(i * 14, i * 4, 70 - Math.abs(i) * 14, 14, -0.2, 0, 7)
    g.stroke()
  }
  g.restore()

  // Boxes (interior de la recta) y gradas (exterior), a lo largo de la recta de meta.
  const o = { x: 0, y: 0 }
  const strip = (u0, u1, l0, l1, fill, steps = 40) => {
    g.beginPath()
    for (let i = 0; i <= steps; i++) {
      at(u0 + ((u1 - u0) * i) / steps, l0, o)
      if (i === 0) g.moveTo(o.x, o.y)
      else g.lineTo(o.x, o.y)
    }
    for (let i = steps; i >= 0; i--) {
      at(u0 + ((u1 - u0) * i) / steps, l1, o)
      g.lineTo(o.x, o.y)
    }
    g.closePath()
    g.fillStyle = fill
    g.fill()
  }
  const hw = TRACK_W / 2
  // pit lane + edificio de boxes (interior)
  strip(-0.05, 0.07, -(hw + 28), -(hw + 62), '#1a232b')
  strip(-0.05, 0.07, -(hw + 62), -(hw + 104), '#2a3640')
  strip(-0.05, 0.07, -(hw + 66), -(hw + 100), '#34434f')
  for (let i = 0; i < 12; i++) {
    const u = -0.047 + i * 0.01
    strip(u, u + 0.0075, -(hw + 28), -(hw + 40), CAR_INFO[i % 6].color, 4)
    strip(u, u + 0.0075, -(hw + 64), -(hw + 72), 'rgba(255,255,255,0.25)', 4)
  }
  // gradas (exterior)
  strip(-0.065, 0.09, hw + 70, hw + 190, '#121a22')
  for (let r = 0; r < 7; r++) {
    const l0 = hw + 78 + r * 15
    strip(-0.063, 0.088, l0, l0 + 9, r & 1 ? '#1d2832' : '#18222b', 60)
    const steps = 150
    for (let i = 0; i < steps; i++) {
      if (R() < 0.18) continue
      at(-0.062 + (0.148 * i) / steps, l0 + 4.5, o)
      g.fillStyle = ['#ff5a5a', '#ffd35a', '#5ad2ff', '#f1e9d6', '#a97bff', '#ffffff'][Math.floor(R() * 6)]
      g.globalAlpha = 0.55 + R() * 0.4
      g.beginPath()
      g.arc(o.x, o.y, 2.4, 0, 7)
      g.fill()
      g.globalAlpha = 1
    }
  }
  strip(-0.065, 0.09, hw + 188, hw + 204, '#05090c')

  // Letreros publicitarios neón en la valla exterior de la recta.
  g.globalCompositeOperation = 'lighter'
  const names = ['TOPCODE', 'RAYO', 'TURBO', 'NITRO', 'BOLT']
  for (let i = 0; i < 9; i++) {
    const u = -0.05 + i * 0.0165
    strip(u, u + 0.012, hw + 46, hw + 58, rgba(CAR_INFO[i % 6].color, 0.5), 4)
  }
  g.globalCompositeOperation = 'source-over'
  void names

  // Oscurecer los bordes del mundo.
  const vg = g.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.45, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.62)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.55)')
  g.fillStyle = vg
  g.fillRect(0, 0, WORLD_W, WORLD_H)
  return c
}

// ---------- sprites ----------
function glowSprite(size, stops) {
  const c = canvasOf(size, size)
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [o, col] of stops) gr.addColorStop(o, col)
  g.fillStyle = gr
  g.fillRect(0, 0, size, size)
  return c
}

const K = 5 // píxeles del sprite por unidad de mundo
function carSprite(info, num) {
  const w = 70 * K
  const h = 40 * K
  const c = canvasOf(w, h)
  const g = c.getContext('2d')
  g.translate(w / 2, h / 2)
  g.scale(K, K)
  const col = info.color
  const acc = info.accent
  const dark = shade(col, -0.55)
  const mid = shade(col, -0.2)
  const light = shade(col, 0.4)

  // suelo / difusor
  g.fillStyle = '#080a0d'
  rr(g, -27, -8.5, 52, 17, 4)
  g.fill()

  // alerón trasero
  g.fillStyle = '#12151a'
  rr(g, -31, -13.5, 8, 27, 1.5)
  g.fill()
  g.fillStyle = shade('#222a33', 0.1)
  g.fillRect(-29.5, -13, 2.2, 26)
  g.fillStyle = col
  rr(g, -31.5, -14, 9, 2.4, 1)
  g.fill()
  rr(g, -31.5, 11.6, 9, 2.4, 1)
  g.fill()
  g.fillStyle = acc
  g.globalAlpha = 0.85
  g.fillRect(-26.5, -12.6, 1, 25.2)
  g.globalAlpha = 1

  // pontones laterales
  for (const s of [-1, 1]) {
    const gr = g.createLinearGradient(0, s * 4, 0, s * 11)
    gr.addColorStop(0, light)
    gr.addColorStop(0.5, col)
    gr.addColorStop(1, dark)
    g.fillStyle = gr
    rr(g, -17, s < 0 ? -11 : 3, 24, 8, 4)
    g.fill()
    g.fillStyle = '#05070a'
    rr(g, 3.5, s < 0 ? -9.6 : 5.6, 3.2, 4, 1.2)
    g.fill()
  }

  // fuselaje
  const body = new Path2D()
  body.moveTo(-26, -3.6)
  body.bezierCurveTo(-18, -6, -10, -6.6, -2, -6)
  body.bezierCurveTo(6, -5.6, 12, -3.8, 20, -2.8)
  body.lineTo(31.5, -1.5)
  body.lineTo(31.5, 1.5)
  body.lineTo(20, 2.8)
  body.bezierCurveTo(12, 3.8, 6, 5.6, -2, 6)
  body.bezierCurveTo(-10, 6.6, -18, 6, -26, 3.6)
  body.closePath()
  const bg = g.createLinearGradient(0, -7, 0, 7)
  bg.addColorStop(0, dark)
  bg.addColorStop(0.28, mid)
  bg.addColorStop(0.5, light)
  bg.addColorStop(0.72, mid)
  bg.addColorStop(1, dark)
  g.fillStyle = bg
  g.fill(body)
  // franja central
  g.fillStyle = acc
  g.globalAlpha = 0.9
  g.fillRect(-25, -0.9, 38, 1.8)
  g.fillRect(-25, -2.4, 38, 0.5)
  g.fillRect(-25, 1.9, 38, 0.5)
  g.globalAlpha = 1
  // brillo del barniz
  const sh = g.createLinearGradient(-26, -5, 28, 2)
  sh.addColorStop(0, 'rgba(255,255,255,0)')
  sh.addColorStop(0.35, 'rgba(255,255,255,0.3)')
  sh.addColorStop(0.6, 'rgba(255,255,255,0.05)')
  sh.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sh
  g.fill(body)
  g.strokeStyle = 'rgba(255,255,255,0.3)'
  g.lineWidth = 0.35
  g.stroke(body)

  // toma de aire y cubierta del motor
  g.fillStyle = '#06080b'
  rr(g, -12, -2.2, 6, 4.4, 2)
  g.fill()
  // cabina + piloto
  g.fillStyle = '#05070a'
  g.beginPath()
  g.ellipse(4, 0, 7.5, 4.4, 0, 0, 7)
  g.fill()
  g.fillStyle = acc
  g.beginPath()
  g.arc(3.6, 0, 3.3, 0, 7)
  g.fill()
  g.fillStyle = '#0a1620'
  g.beginPath()
  g.ellipse(5.1, 0, 1.8, 2.6, 0, 0, 7)
  g.fill()
  g.fillStyle = 'rgba(160,230,255,0.55)'
  g.beginPath()
  g.ellipse(5.6, -0.8, 0.8, 1.2, 0, 0, 7)
  g.fill()
  g.strokeStyle = '#1b2026'
  g.lineWidth = 0.9
  g.beginPath()
  g.arc(4, 0, 6.2, -1.9, 1.9)
  g.stroke()

  // dorsal en el morro
  g.fillStyle = '#fdfdf8'
  g.beginPath()
  g.arc(19.5, 0, 3.7, 0, 7)
  g.fill()
  g.fillStyle = '#10161c'
  g.font = '700 5.6px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(num), 19.5, 0.4)

  // alerón delantero
  g.fillStyle = '#10141a'
  rr(g, 24, -14, 6.5, 28, 1.4)
  g.fill()
  g.fillStyle = shade('#222a33', 0.15)
  g.fillRect(25.4, -13.2, 1.6, 26.4)
  g.fillStyle = col
  rr(g, 23, -14.6, 8.5, 2.4, 1)
  g.fill()
  rr(g, 23, 12.2, 8.5, 2.4, 1)
  g.fill()
  g.fillStyle = acc
  g.fillRect(28.6, -12.6, 1, 25.2)
  return c
}

function coneSprite() {
  const c = canvasOf(256, 128)
  const g = c.getContext('2d')
  for (const [spread, a] of [[1, 0.16], [0.66, 0.2], [0.34, 0.26]]) {
    const gr = g.createLinearGradient(0, 0, 256, 0)
    gr.addColorStop(0, `rgba(255,248,215,${a * 2.2})`)
    gr.addColorStop(1, 'rgba(255,248,215,0)')
    g.fillStyle = gr
    g.beginPath()
    g.moveTo(0, 64 - 4)
    g.lineTo(256, 64 - 62 * spread)
    g.lineTo(256, 64 + 62 * spread)
    g.lineTo(0, 64 + 4)
    g.closePath()
    g.fill()
  }
  return c
}

function flameSprite() {
  const c = canvasOf(96, 32)
  const g = c.getContext('2d')
  const gr = g.createLinearGradient(0, 0, 96, 0)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.2, 'rgba(160,210,255,0.95)')
  gr.addColorStop(0.5, 'rgba(255,150,40,0.7)')
  gr.addColorStop(1, 'rgba(255,60,0,0)')
  g.fillStyle = gr
  g.beginPath()
  g.moveTo(0, 12)
  g.quadraticCurveTo(40, 2, 96, 16)
  g.quadraticCurveTo(40, 30, 0, 20)
  g.closePath()
  g.fill()
  return c
}

function asphaltTile() {
  const c = canvasOf(160, 160)
  const g = c.getContext('2d')
  const R = rng(3)
  for (let i = 0; i < 2600; i++) {
    const v = R() < 0.5 ? 255 : 0
    g.fillStyle = `rgba(${v},${v},${v},${0.04 + R() * 0.08})`
    g.fillRect(R() * 160, R() * 160, 1 + R() * 1.5, 1 + R() * 1.5)
  }
  return c
}

function shadowSprite() {
  const c = canvasOf(180, 100)
  const g = c.getContext('2d')
  g.translate(90, 50)
  g.scale(1.9, 1)
  const gr = g.createRadialGradient(0, 0, 4, 0, 0, 48)
  gr.addColorStop(0, 'rgba(0,0,0,0.65)')
  gr.addColorStop(0.6, 'rgba(0,0,0,0.35)')
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr
  g.beginPath()
  g.arc(0, 0, 48, 0, 7)
  g.fill()
  return c
}

export function makeSprites() {
  return {
    cars: CAR_INFO.map((info, i) => carSprite(info, i + 1)),
    shadow: shadowSprite(),
    cone: coneSprite(),
    flame: flameSprite(),
    asphalt: asphaltTile(),
    smoke: glowSprite(64, [[0, 'rgba(225,230,238,0.9)'], [0.5, 'rgba(200,208,220,0.4)'], [1, 'rgba(190,200,215,0)']]),
    lamp: glowSprite(128, [[0, 'rgba(210,235,255,0.55)'], [0.35, 'rgba(120,180,255,0.2)'], [1, 'rgba(60,120,255,0)']]),
    warm: glowSprite(64, [[0, 'rgba(255,240,200,1)'], [0.3, 'rgba(255,200,110,0.5)'], [1, 'rgba(255,160,60,0)']]),
    red: glowSprite(64, [[0, 'rgba(255,90,70,1)'], [0.3, 'rgba(255,40,30,0.55)'], [1, 'rgba(255,0,0,0)']]),
    green: glowSprite(64, [[0, 'rgba(150,255,170,1)'], [0.3, 'rgba(60,230,110,0.55)'], [1, 'rgba(0,200,60,0)']]),
    car: CAR_INFO.map((info) => glowSprite(96, [[0, rgba(info.color, 0.55)], [0.5, rgba(info.color, 0.18)], [1, rgba(info.color, 0)]])),
  }
}
export const SPRITE_K = K

// ---------- partículas ----------
export const P_SMOKE = 0
export const P_SPARK = 1
export const P_CONFETTI = 2
export const P_FIRE = 3
export const P_FLAME = 4
export const P_STREAK = 5

export class Pool {
  constructor(n, palette) {
    this.n = n
    this.palette = palette
    this.x = new Float32Array(n)
    this.y = new Float32Array(n)
    this.vx = new Float32Array(n)
    this.vy = new Float32Array(n)
    this.age = new Float32Array(n)
    this.max = new Float32Array(n)
    this.size = new Float32Array(n)
    this.rot = new Float32Array(n)
    this.vr = new Float32Array(n)
    this.kind = new Uint8Array(n)
    this.col = new Uint8Array(n)
    this.head = 0
    this.sprite = null
    this.age.fill(9)
    this.max.fill(1)
  }

  spawn(kind, x, y, vx, vy, life, size, col = 0, rot = 0, vr = 0) {
    const i = this.head
    this.head = (i + 1) % this.n
    this.kind[i] = kind
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.age[i] = 0
    this.max[i] = life
    this.size[i] = size
    this.col[i] = col
    this.rot[i] = rot
    this.vr[i] = vr
  }

  clear() {
    this.age.fill(9)
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.max[i]) continue
      this.age[i] += dt
      const k = this.kind[i]
      const drag = k === P_SMOKE ? 0.9 : k === P_CONFETTI ? 0.985 : k === P_FIRE ? 0.975 : 0.98
      this.vx[i] *= drag
      this.vy[i] *= drag
      if (k === P_CONFETTI) this.vy[i] += 120 * dt
      else if (k === P_FIRE) this.vy[i] += 90 * dt
      this.x[i] += this.vx[i] * dt
      this.y[i] += this.vy[i] * dt
      this.rot[i] += this.vr[i] * dt
    }
  }

  // Dibuja un tipo de partículas con el contexto ya transformado.
  draw(g, kind) {
    const { n, age, max, kind: kd } = this
    if (kind === P_SMOKE) {
      for (let i = 0; i < n; i++) {
        if (kd[i] !== kind || age[i] >= max[i]) continue
        const a = age[i] / max[i]
        g.globalAlpha = 0.3 * (1 - a) * (1 - a)
        const r = this.size[i] * (1.6 + a * 3.2)
        g.drawImage(this.sprite, this.x[i] - r, this.y[i] - r, r * 2, r * 2)
      }
    } else if (kind === P_SPARK) {
      g.lineCap = 'round'
      for (let i = 0; i < n; i++) {
        if (kd[i] !== kind || age[i] >= max[i]) continue
        const a = age[i] / max[i]
        g.globalAlpha = 1 - a
        g.strokeStyle = a < 0.4 ? '#fff4c2' : '#ffa23a'
        g.lineWidth = this.size[i]
        g.beginPath()
        g.moveTo(this.x[i], this.y[i])
        g.lineTo(this.x[i] - this.vx[i] * 0.035, this.y[i] - this.vy[i] * 0.035)
        g.stroke()
      }
    } else if (kind === P_CONFETTI) {
      for (let i = 0; i < n; i++) {
        if (kd[i] !== kind || age[i] >= max[i]) continue
        const a = age[i] / max[i]
        g.globalAlpha = a > 0.8 ? (1 - a) * 5 : 1
        g.fillStyle = this.palette[this.col[i]]
        g.save()
        g.translate(this.x[i], this.y[i])
        g.rotate(this.rot[i])
        g.scale(1, Math.sin(age[i] * 9 + i))
        g.fillRect(-this.size[i], -this.size[i] * 0.5, this.size[i] * 2, this.size[i])
        g.restore()
      }
    } else if (kind === P_FIRE) {
      for (let i = 0; i < n; i++) {
        if (kd[i] !== kind || age[i] >= max[i]) continue
        const a = age[i] / max[i]
        g.globalAlpha = (1 - a) * (1 - a)
        g.fillStyle = this.palette[this.col[i]]
        g.beginPath()
        g.arc(this.x[i], this.y[i], this.size[i] * (1 - a * 0.5), 0, 7)
        g.fill()
      }
    } else if (kind === P_FLAME) {
      g.fillStyle = '#ff9a3c'
      for (let i = 0; i < n; i++) {
        if (kd[i] !== kind || age[i] >= max[i]) continue
        const a = age[i] / max[i]
        g.globalAlpha = (1 - a) * 0.8
        g.beginPath()
        g.arc(this.x[i], this.y[i], this.size[i] * (1 - a * 0.6), 0, 7)
        g.fill()
      }
    } else if (kind === P_STREAK) {
      g.lineCap = 'round'
      g.strokeStyle = '#dff3ff'
      g.lineWidth = 1.5
      for (let i = 0; i < n; i++) {
        if (kd[i] !== kind || age[i] >= max[i]) continue
        const a = age[i] / max[i]
        g.globalAlpha = Math.sin(a * Math.PI) * 0.35
        g.beginPath()
        g.moveTo(this.x[i], this.y[i])
        g.lineTo(this.x[i] - this.vx[i] * this.size[i], this.y[i] - this.vy[i] * this.size[i])
        g.stroke()
      }
    }
    g.globalAlpha = 1
  }
}
