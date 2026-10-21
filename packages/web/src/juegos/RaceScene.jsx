// La escena de la Carrera de coches: un circuito nocturno visto desde arriba, pintado entero en un canvas 2D.
//
// <RaceScene
//   getNow={() => ms}                 reloj del servidor (Date.now() + diferencia medida); la escena se anima sola con él
//   round={number}                    ronda actual (cada ROUND_MS = 55 s: apuestas 20 s, parrilla 6 s, carrera ≤ 24 s, resultado)
//   race={{ start, finish[6], wobble[6][3], winner, order? } | null}   null mientras hay apuestas abiertas; `start` = salida (ms del servidor)
//   seats={[{ car, name, avatar }]}   pilotos humanos de esta carrera; el resto de coches los lleva la IA
//   bets={[{ car, amount }]}          tus apuestas (marca tus coches)
//   mySeat={number | null}            el coche que pilotas tú
//   podium={number[]}                 opcional: premios por puesto en centésimas (por defecto race.PODIUM = [340, 170, 66])
//   muted={boolean}  reduced={boolean}
//   onEvent={(e) => void}             { type: 'lights', n } | { type: 'start' } | { type: 'finish', car, place } | { type: 'winner', car, photo }
//                                     (`place` va desde 0: 0 = ganador, como en race.PODIUM; `n` de 1 a 5 luces)
// />
//
// Las posiciones salen SIEMPRE de progress(finish, wobble, getNow() - start): la escena solo anima, nunca decide.
import { useEffect, useRef } from 'react'
import './RaceScene.css'
import { CAR_INFO, CARS, GRID_MS, LAPS, PODIUM, progress, startOf } from './race.js'
import {
  LANE_GAP,
  LEN,
  P_CONFETTI,
  P_FIRE,
  P_FLAME,
  P_SMOKE,
  P_SPARK,
  P_STREAK,
  Pool,
  TRACK_W,
  WORLD_H,
  WORLD_W,
  at,
  centerPath,
  makeBackground,
  makeSprites,
  neonInner,
  neonOuter,
  poles,
  rgba,
  rrPath,
  shade,
} from './raceArt.js'
import { playBeep, playCheer, playGo, playPass, startEngine } from './sound.js'

const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif'
const LAUNCH_MS = 1800 // arrancada: aceleración suave en vez de salir ya a toda velocidad
const BRAKE_TAU = 900 // frenada tras la meta
const PARADE_V = 150 // unidades/s de la vuelta de formación
const LANE = [0, 3, 1, 4, 2, 5] // carril de cada coche (los de la columna izquierda de la parrilla, a un lado)
const GRID_BACK = [0, 1, 2, 3, 4, 5].map((i) => 70 + Math.floor(i / 2) * 125 + (i & 1) * 52)
const GOLD = '#ffd75a'
const SILVER = '#d5dde6'
const BRONZE = '#d98b52'
const PLACE_COL = [GOLD, SILVER, BRONZE]
const PALETTE = [...CAR_INFO.map((c) => c.color), GOLD, '#ffffff', '#ff7ac8']
const FIRE_PALETTE = [...CAR_INFO.map((c) => c.color), GOLD, '#ffffff', '#ffb36b']
const TAU = Math.PI * 2

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const smooth = (x) => x * x * (3 - 2 * x)
const fmtMult = (cents) => `×${(cents / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })}`

// ---------- posiciones (todo sale de progress()) ----------
// Progreso mostrado de un coche (fracción de la distancia total). Es progress() tal cual, salvo dos suavizados que no mueven la
// meta: una arrancada progresiva al salir y una frenada que se prolonga tras cruzar la meta (la vuelta de honor).
function shownProgress(race, i, ms) {
  if (ms <= 0) return 0
  const f = race.finish[i]
  const w = race.wobble[i]
  if (ms <= f) {
    let p = progress(f, w, ms)
    const x = ms / LAUNCH_MS
    if (x < 1) {
      const v0 = (1 + Math.PI * (w[0] + 2 * w[1] + 3 * w[2])) / f
      p -= v0 * ms * (1 - x) * (1 - x)
    }
    return Math.max(0, p)
  }
  const ve = Math.max(0, (1 - Math.PI * w[0] + 2 * Math.PI * w[1] - 3 * Math.PI * w[2]) / f)
  const vc = 0.4 / f
  const t = ms - f
  return 1 + vc * t + (ve - vc) * BRAKE_TAU * (1 - Math.exp(-t / BRAKE_TAU))
}

// Vueltas recorridas por el coche `i` a los `ms` de la salida (negativo = aún detrás de la meta, en la parrilla o desfilando).
function carU(race, i, ms) {
  const back = GRID_BACK[i] / LEN
  if (ms < 0) {
    const tau = -ms - GRID_MS // ms que faltan para llegar a su plaza de parrilla
    let dist = 0
    if (tau > 0) {
      const T = 1500
      const v = PARADE_V / 1000
      dist = tau < T ? (v * tau * tau) / (2 * T) : (v * T) / 2 + v * (tau - T)
    }
    return -back - dist / LEN
  }
  if (!race) return -back
  const d = shownProgress(race, i, ms) * LAPS
  return d - back * (1 - smooth(Math.min(1, d / 0.12)))
}

const _o = { x: 0, y: 0, tx: 1, ty: 0, k: 0 }

function makeState() {
  return {
    x: new Float64Array(CARS),
    y: new Float64Array(CARS),
    h: new Float64Array(CARS),
    spd: new Float64Array(CARS),
    brake: new Float64Array(CARS),
    thr: new Float64Array(CARS),
    slip: new Float64Array(CARS),
    u: new Float64Array(CARS),
    k: new Float64Array(CARS),
    lat: new Float64Array(CARS),
    tx: new Float64Array(CARS),
    ty: new Float64Array(CARS),
  }
}

function computeCars(S, race, ms) {
  for (let i = 0; i < CARS; i++) {
    const u1 = carU(race, i, ms)
    const u2 = carU(race, i, ms - 40)
    const u3 = carU(race, i, ms - 160)
    const u4 = carU(race, i, ms - 200)
    const spd = Math.max(0, ((u1 - u2) * LEN) / 0.04)
    const spdB = Math.max(0, ((u3 - u4) * LEN) / 0.04)
    const decel = (spdB - spd) / 0.16
    const gl = i & 1 ? 26 : -26
    const ll = (LANE[i] - 2.5) * LANE_GAP
    const d = ms > 0 && race ? shownProgress(race, i, ms) * LAPS : 0
    const blend = smooth(Math.min(1, d / 0.1))
    const lat = gl + (ll - gl) * blend + Math.sin(ms / 900 + i * 2.1) * 2 * blend
    at(u1, lat, _o)
    const slip = Math.abs(_o.k) * spd
    S.x[i] = _o.x
    S.y[i] = _o.y
    S.tx[i] = _o.tx
    S.ty[i] = _o.ty
    S.k[i] = _o.k
    S.u[i] = u1
    S.lat[i] = lat
    S.spd[i] = spd
    S.slip[i] = slip
    S.brake[i] = clamp(decel / 800, 0, 1)
    S.thr[i] = clamp(-decel / 700, 0, 1)
    S.h[i] = Math.atan2(_o.ty, _o.tx) + clamp(_o.k * spd * 0.07, -0.3, 0.3) + Math.sin(ms / 330 + i * 1.7) * 0.025 * Math.min(1, spd / 900)
  }
}

// Información derivada de una carrera (se calcula una vez por objeto `race`).
function raceInfo(race) {
  const idx = [0, 1, 2, 3, 4, 5].sort((a, b) => race.finish[a] - race.finish[b])
  const order = Array.isArray(race.order) && race.order.length === CARS ? race.order.slice() : idx
  const place = new Int8Array(CARS)
  order.forEach((c, p) => (place[c] = p))
  const t0 = race.finish[order[0]]
  const photo = race.finish[order[1]] - t0 < 150
  return { order, place, t0, photo }
}

function lightsAt(ms) {
  return clamp(Math.floor((ms + GRID_MS) / 1000), 0, 5) * (ms < 0 ? 1 : 0)
}

function initials(name) {
  const s = String(name || '?').trim()
  return (s[0] || '?').toUpperCase()
}

// ---------- la escena ----------
function mount(canvas, P) {
  const g = canvas.getContext('2d', { alpha: false })
  const bg = makeBackground()
  const spr = makeSprites()
  const asphaltPattern = g.createPattern(spr.asphalt, 'repeat')
  const marks = document.createElement('canvas')
  marks.width = WORLD_W
  marks.height = WORLD_H
  const mg = marks.getContext('2d')
  mg.lineCap = 'round'
  const world = new Pool(420, [])
  const screen = new Pool(320, PALETTE)
  const fire = new Pool(520, FIRE_PALETTE)
  world.sprite = spr.smoke

  const S = makeState()
  const S2 = makeState()
  const TR = 14
  const trail = new Float32Array(CARS * TR * 2)
  let trailHead = 0
  let trailN = 0
  const prevMark = new Float32Array(CARS * 4).fill(NaN)

  let dpr = 1
  let cw = 1
  let ch = 1
  let u = 1 // escala de la interfaz (0.8 en móvil)
  let vignette = null
  const cam = { x: WORLD_W / 2, y: WORLD_H / 2, z: 1, vx: 0, vy: 0 }
  let snap = true
  let shake = 0
  let flash = 0
  let fade = 0
  let key = null
  let last = 0
  let raf = 0
  let rinfo = null
  let rinfoFor = null
  let ev = null
  let lastPass = 0
  let engine = null
  let engineTry = 0
  let lastAria = 0
  let lastAriaText = ''
  let fireworkAt = 0
  let dead = false
  const rowY = new Float64Array(CARS).fill(NaN)
  const order = [0, 1, 2, 3, 4, 5]
  const prevOrder = [0, 1, 2, 3, 4, 5]
  const keys = new Float64Array(CARS)
  const pilot = new Array(CARS).fill(null)
  const betOn = new Float64Array(CARS)
  const o = { x: 0, y: 0, tx: 1, ty: 0, k: 0 }
  const o2 = { x: 0, y: 0, tx: 1, ty: 0, k: 0 }
  let camVelX = 0
  let camVelY = 0

  const resize = () => {
    const r = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    cw = Math.max(1, Math.round(r.width))
    ch = Math.max(1, Math.round(r.height))
    canvas.width = Math.round(cw * dpr)
    canvas.height = Math.round(ch * dpr)
    u = cw < 560 ? 0.8 : 1
    const v = document.createElement('canvas')
    v.width = Math.max(2, Math.round(cw / 2))
    v.height = Math.max(2, Math.round(ch / 2))
    const vg = v.getContext('2d')
    const gr = vg.createRadialGradient(v.width / 2, v.height / 2, Math.min(v.width, v.height) * 0.38, v.width / 2, v.height / 2, Math.hypot(v.width, v.height) * 0.55)
    gr.addColorStop(0, 'rgba(0,0,8,0)')
    gr.addColorStop(1, 'rgba(0,0,8,0.62)')
    vg.fillStyle = gr
    vg.fillRect(0, 0, v.width, v.height)
    vignette = v
  }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)

  const emit = (e) => P.current.onEvent?.(e)

  // ----- cámara -----
  const camTarget = (ms, race, info, p, out) => {
    const minDim = Math.min(cw, ch)
    const reduced = p.reduced
    let need
    if (ms < -GRID_MS) {
      let mx = 0
      let my = 0
      for (let i = 0; i < CARS; i++) {
        mx += S.x[i]
        my += S.y[i]
      }
      out.x = mx / CARS
      out.y = my / CARS
      need = u < 1 ? 880 : 1000
      out.dx = 0
      out.dy = 0
    } else if (ms < 0) {
      at(-(190 / LEN), 0, o)
      const f = smooth(clamp((ms + GRID_MS) / GRID_MS, 0, 1))
      out.x = o.x + o.tx * 40
      out.y = o.y + o.ty * 40
      need = (u < 1 ? 700 : 760) - (reduced ? 0 : 140 * f)
      out.dx = 0
      out.dy = 0
    } else {
      const lead = order[0]
      const a = order[1]
      const b = order[2]
      const won = info && ms >= info.t0
      const c4 = won ? order[2] : order[3]
      out.x = S.x[lead] * 0.6 + (S.x[lead] + S.x[a] + S.x[b]) * (0.4 / 3)
      out.y = S.y[lead] * 0.6 + (S.y[lead] + S.y[a] + S.y[b]) * (0.4 / 3)
      const spread = Math.hypot(S.x[lead] - S.x[c4], S.y[lead] - S.y[c4])
      need = clamp(spread * 1.1 + 330, u < 1 ? 520 : 600, u < 1 ? 680 : 800)
      if (won) need = Math.max(u < 1 ? 520 : 600, need - clamp((ms - info.t0) / 1500, 0, 1) * 160)
      const l = Math.min(200, S.spd[lead] * 0.17)
      out.dx = S.tx[lead] * l
      out.dy = S.ty[lead] * l
    }
    if (reduced) need = Math.round(need / 120) * 120
    out.z = Math.max(minDim / need, cw / WORLD_W, ch / WORLD_H)
  }
  const tgt = { x: 0, y: 0, z: 1, dx: 0, dy: 0 }

  const drawStatic = (g) => {
    const o = { x: 0, y: 0, tx: 1, ty: 0, k: 0 }
    const o2 = { x: 0, y: 0, tx: 1, ty: 0, k: 0 }
    g.drawImage(bg, 0, 0)
    // pista: resplandor de neón, runoff, pianos, asfalto con textura
    g.lineJoin = 'round'
    g.lineCap = 'butt'
    g.strokeStyle = 'rgba(70,190,255,0.05)'
    g.lineWidth = TRACK_W + 110
    g.stroke(centerPath)
    g.strokeStyle = 'rgba(70,190,255,0.07)'
    g.lineWidth = TRACK_W + 70
    g.stroke(centerPath)
    g.strokeStyle = '#0d1a20'
    g.lineWidth = TRACK_W + 44
    g.stroke(centerPath)
    g.strokeStyle = '#c42f35'
    g.lineWidth = TRACK_W + 22
    g.stroke(centerPath)
    g.setLineDash([24, 24])
    g.strokeStyle = '#f4f1ea'
    g.stroke(centerPath)
    g.setLineDash([])
    g.strokeStyle = '#f2f4f6'
    g.lineWidth = TRACK_W + 2
    g.stroke(centerPath)
    g.strokeStyle = '#2a2f36'
    g.lineWidth = TRACK_W - 5
    g.stroke(centerPath)
    g.strokeStyle = asphaltPattern
    g.stroke(centerPath)
    g.strokeStyle = 'rgba(0,0,0,0.20)'
    g.lineWidth = 120
    g.stroke(centerPath)
    g.strokeStyle = 'rgba(255,255,255,0.025)'
    g.lineWidth = 28
    g.stroke(centerPath)

    // valla de neón
    g.globalCompositeOperation = 'lighter'
    for (const path of [neonInner, neonOuter]) {
      g.strokeStyle = 'rgba(40,220,255,0.18)'
      g.lineWidth = 9
      g.stroke(path)
    }
    g.globalCompositeOperation = 'source-over'

    // línea de meta y casillas de parrilla
    at(0, 0, o)
    g.save()
    g.translate(o.x, o.y)
    g.rotate(Math.atan2(o.ty, o.tx))
    const n = Math.floor((TRACK_W - 8) / 12)
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < n; c++) {
        g.fillStyle = (r + c) & 1 ? '#10141a' : '#f7f7f2'
        g.fillRect(-12 + r * 12, -(n * 6) + c * 12, 12, 12)
      }
    }
    g.restore()
    g.strokeStyle = 'rgba(255,255,255,0.4)'
    g.lineWidth = 2
    for (let i = 0; i < CARS; i++) {
      at(-(GRID_BACK[i] / LEN), i & 1 ? 26 : -26, o2)
      g.save()
      g.translate(o2.x, o2.y)
      g.rotate(Math.atan2(o2.ty, o2.tx))
      g.beginPath()
      g.moveTo(-34, -18)
      g.lineTo(-34, 18)
      g.moveTo(34, -18)
      g.lineTo(34, -12)
      g.moveTo(34, 18)
      g.lineTo(34, 12)
      g.stroke()
      g.restore()
    }

    // charcos de luz de las farolas
    g.globalCompositeOperation = 'lighter'
    for (const pl of poles) {
      const nx = -pl.ty
      const ny = pl.tx
      g.globalAlpha = 0.85
      g.drawImage(spr.lamp, pl.x - pl.side * nx * 70 - 190, pl.y - pl.side * ny * 70 - 190, 380, 380)
    }
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
  }


  // Capa estática (fondo, pista, líneas, charcos de luz): se pinta una sola vez y luego es un solo drawImage.
  const SS = window.devicePixelRatio > 1.5 && window.innerWidth >= 700 ? 2 : 1.5
  const stat = document.createElement('canvas')
  stat.width = Math.round(WORLD_W * SS)
  stat.height = Math.round(WORLD_H * SS)
  const sg = stat.getContext('2d')
  sg.scale(SS, SS)
  drawStatic(sg)

  // ----- dibujo del mundo (también para la repetición) -----
  const worldDraw = (vp, St, ms, race, main, now, p) => {
    const { ox, oy, w, h, x: cx, y: cy, z } = vp
    const set = () => g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (ox + w / 2 - cx * z), dpr * (oy + h / 2 - cy * z))
    set()
    g.drawImage(stat, 0, 0, WORLD_W, WORLD_H)
    if (main) g.drawImage(marks, 0, 0)

    // valla de neón (los destellos van animados)
    g.globalCompositeOperation = 'lighter'
    for (const path of [neonInner, neonOuter]) {
      g.strokeStyle = 'rgba(120,240,255,0.7)'
      g.lineWidth = 2.2
      g.setLineDash([46, 28])
      g.lineDashOffset = -now / 40
      g.stroke(path)
      g.setLineDash([])
    }
    g.globalCompositeOperation = 'source-over'

    // conos de los faros
    for (let i = 0; i < CARS; i++) {
      g.save()
      g.translate(St.x[i], St.y[i])
      g.rotate(St.h[i])
      g.globalAlpha = 0.9
      g.drawImage(spr.cone, 26, -50, 190, 100)
      g.restore()
    }
    g.globalAlpha = 1

    // estela de luz
    if (main && !p.reduced) {
      g.lineCap = 'round'
      for (let i = 0; i < CARS; i++) {
        if (St.spd[i] < 300) continue
        g.strokeStyle = rgba(CAR_INFO[i].color, 0.5)
        for (let s = 0; s < trailN - 1; s++) {
          const a = ((trailHead - 1 - s + TR * 2) % TR) * 2
          const b = ((trailHead - 2 - s + TR * 2) % TR) * 2
          g.globalAlpha = (1 - s / TR) * 0.7
          g.lineWidth = 7 * (1 - s / TR)
          g.beginPath()
          g.moveTo(trail[(i * TR * 2) + a], trail[(i * TR * 2) + a + 1])
          g.lineTo(trail[(i * TR * 2) + b], trail[(i * TR * 2) + b + 1])
          g.stroke()
        }
      }
      g.globalAlpha = 1
    }
    g.globalCompositeOperation = 'source-over'

    // sombras
    for (let i = 0; i < CARS; i++) {
      g.save()
      g.translate(St.x[i] + 5, St.y[i] + 7)
      g.rotate(St.h[i])
      g.drawImage(spr.shadow, -45, -26, 90, 52)
      g.restore()
    }

    // halo de tus apuestas y del coche que pilotas
    for (let i = 0; i < CARS; i++) {
      const mine = p.mySeat === i
      const bet = betOn[i] > 0
      if (!mine && !bet) continue
      g.save()
      g.translate(St.x[i], St.y[i])
      g.globalCompositeOperation = 'lighter'
      g.globalAlpha = 0.55 + 0.25 * Math.sin(now / 260)
      g.drawImage(spr.car[i], -62, -62, 124, 124)
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      g.lineWidth = 3
      g.setLineDash([12, 9])
      g.lineDashOffset = -now / 28
      g.strokeStyle = mine ? '#5ff0ff' : GOLD
      g.beginPath()
      g.arc(0, 0, 43, 0, TAU)
      g.stroke()
      if (mine && bet) {
        g.strokeStyle = GOLD
        g.lineDashOffset = now / 28
        g.beginPath()
        g.arc(0, 0, 49, 0, TAU)
        g.stroke()
      }
      g.setLineDash([])
      g.restore()
    }

    // coches
    for (let i = 0; i < CARS; i++) {
      g.save()
      g.translate(St.x[i], St.y[i])
      g.rotate(St.h[i])
      const steer = clamp(St.k[i] * 90, -0.38, 0.38)
      const ph = (St.u[i] * LEN) % 9
      for (const s of [-1, 1]) {
        for (const front of [true, false]) {
          const ww = front ? 13 : 15
          const wh = front ? 6.4 : 7.6
          const wx = front ? 18 : -17
          const wy = s * (front ? 11.2 : 11.6)
          g.save()
          g.translate(wx, wy)
          if (front) g.rotate(steer)
          g.fillStyle = '#0c0e11'
          rrPath(g, -ww / 2, -wh / 2, ww, wh, 2)
          g.fill()
          g.fillStyle = 'rgba(255,255,255,0.13)'
          for (let t = 0; t < 3; t++) g.fillRect(-ww / 2 + ((ph + t * 3) % 9) * (ww / 9) , -wh / 2 + 0.6, 1, wh - 1.2)
          g.fillStyle = 'rgba(255,255,255,0.08)'
          g.fillRect(-ww / 2 + 1, s * -0.5 - 0.5 + (s > 0 ? -wh / 2 + 0.3 : wh / 2 - 1.3), ww - 2, 1)
          g.restore()
        }
      }
      g.drawImage(spr.cars[i], -35, -20, 70, 40)
      // luces
      g.globalCompositeOperation = 'lighter'
      for (const s of [-1, 1]) {
        g.drawImage(spr.warm, 28 - 8, s * 5 - 8, 16, 16)
        g.globalAlpha = 0.4 + 0.6 * St.brake[i]
        const sz = 14 + 22 * St.brake[i]
        g.drawImage(spr.red, -30 - sz / 2, s * 8 - sz / 2, sz, sz)
        g.globalAlpha = 1
      }
      // llama del escape al acelerar
      const fl = Math.max(St.thr[i], ms > 0 && ms < 2600 ? 0.9 * (1 - ms / 2600) : 0, ms < 0 && St.spd[i] < 40 && !(p.reduced) ? 0.15 * (0.5 + 0.5 * Math.sin(now / 55 + i * 3)) : 0)
      if (fl > 0.08) {
        const len = (14 + 22 * fl) * (0.8 + 0.2 * Math.sin(now / 35 + i * 5))
        g.save()
        g.scale(-1, 1)
        g.globalAlpha = Math.min(1, fl * 1.6)
        g.drawImage(spr.flame, 31, -5, len, 10)
        g.restore()
      }
      g.globalCompositeOperation = 'source-over'
      g.restore()
    }

    if (main) {
      g.globalCompositeOperation = 'source-over'
      world.draw(g, P_SMOKE)
      g.globalCompositeOperation = 'lighter'
      world.draw(g, P_SPARK)
      world.draw(g, P_FLAME)
      g.globalCompositeOperation = 'source-over'
    }

    // farolas (cabezas) y pórtico de salida, por encima de los coches
    const r2 = (w / z + 700) ** 2
    g.globalCompositeOperation = 'lighter'
    for (const pl of poles) {
      if ((pl.x - cx) ** 2 + (pl.y - cy) ** 2 > r2) continue
      const nx = -pl.ty
      const ny = pl.tx
      g.drawImage(spr.warm, pl.x - pl.side * nx * 70 - 22, pl.y - pl.side * ny * 70 - 22, 44, 44)
    }
    g.globalCompositeOperation = 'source-over'
    for (const pl of poles) {
      if ((pl.x - cx) ** 2 + (pl.y - cy) ** 2 > r2) continue
      const nx = -pl.ty
      const ny = pl.tx
      g.strokeStyle = 'rgba(38,48,58,0.85)'
      g.lineWidth = 2.5
      g.beginPath()
      g.moveTo(pl.x + pl.side * nx * 6, pl.y + pl.side * ny * 6)
      g.lineTo(pl.x - pl.side * nx * 70, pl.y - pl.side * ny * 70)
      g.stroke()
      g.fillStyle = '#fff6d8'
      g.beginPath()
      g.arc(pl.x - pl.side * nx * 70, pl.y - pl.side * ny * 70, 5, 0, TAU)
      g.fill()
    }

    // pórtico del semáforo
    at(0.0025, 0, o)
    g.save()
    g.translate(o.x, o.y)
    g.rotate(Math.atan2(o.ty, o.tx))
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.fillRect(-4, -TRACK_W / 2 - 18, 22, TRACK_W + 36)
    g.fillStyle = '#161c23'
    rrPath(g, -12, -TRACK_W / 2 - 16, 20, TRACK_W + 32, 4)
    g.fill()
    g.strokeStyle = '#3a4653'
    g.lineWidth = 1.5
    g.stroke()
    g.fillStyle = '#0c1015'
    g.fillRect(-14, -TRACK_W / 2 - 22, 24, 14)
    g.fillRect(-14, TRACK_W / 2 + 8, 24, 14)
    const nl = ms < 0 ? lightsAt(ms) : 0
    const green = ms >= 0 && ms < 900
    for (let k = 0; k < 5; k++) {
      const ly = (k - 2) * 34
      const lit = green || k < nl
      g.fillStyle = lit ? (green ? '#8bffa8' : '#ff3b30') : '#3a0d0d'
      g.beginPath()
      g.arc(-2, ly, 10, 0, TAU)
      g.fill()
      if (lit) {
        g.globalCompositeOperation = 'lighter'
        g.drawImage(green ? spr.green : spr.red, -2 - 36, ly - 36, 72, 72)
        g.globalCompositeOperation = 'source-over'
      }
    }
    g.restore()
  }

  // ----- partículas, huellas y rastro (solo la vista principal) -----
  const simulate = (dt, ms, race, info, p) => {
    const reduced = p.reduced
    // estela
    const dest = trailHead * 2
    for (let i = 0; i < CARS; i++) {
      trail[i * TR * 2 + dest] = S.x[i]
      trail[i * TR * 2 + dest + 1] = S.y[i]
    }
    trailHead = (trailHead + 1) % TR
    trailN = Math.min(TR, trailN + 1)
    for (let i = 0; i < CARS; i++) {
      const spd = S.spd[i]
      const hx = S.tx[i]
      const hy = S.ty[i]
      const ch0 = Math.cos(S.h[i])
      const sh0 = Math.sin(S.h[i])
      const rx = S.x[i] - ch0 * 22
      const ry = S.y[i] - sh0 * 22
      const launching = ms > 0 && ms < 1500
      const sliding = S.slip[i] > 1.9 && spd > 350
      // huellas y humo en los neumáticos traseros
      for (const s of [-1, 1]) {
        const wx = S.x[i] - ch0 * 17 - sh0 * s * 11.4
        const wy = S.y[i] - sh0 * 17 + ch0 * s * 11.4
        const idx = i * 4 + (s > 0 ? 2 : 0)
        if (sliding || launching) {
          if (!Number.isNaN(prevMark[idx])) {
            mg.strokeStyle = `rgba(0,0,0,${launching ? 0.28 : 0.2})`
            mg.lineWidth = 3
            mg.beginPath()
            mg.moveTo(prevMark[idx], prevMark[idx + 1])
            mg.lineTo(wx, wy)
            mg.stroke()
          }
          prevMark[idx] = wx
          prevMark[idx + 1] = wy
          if (!reduced && Math.random() < (launching ? 0.7 : 0.45)) {
            world.spawn(P_SMOKE, wx, wy, (Math.random() - 0.5) * 30 - hx * 40, (Math.random() - 0.5) * 30 - hy * 40, 0.7 + Math.random() * 0.5, 6 + Math.random() * 4)
          }
        } else prevMark[idx] = NaN
      }
      if (reduced) continue
      // llama y chispas
      if (S.thr[i] > 0.25 && Math.random() < 0.6) {
        world.spawn(P_FLAME, rx - ch0 * 8, ry - sh0 * 8, -hx * 120 + (Math.random() - 0.5) * 40, -hy * 120 + (Math.random() - 0.5) * 40, 0.18, 4 + Math.random() * 3)
      }
      if (spd > 500 && Math.random() < 0.05 + S.slip[i] * 0.01) {
        const sx = S.x[i] - ch0 * 24
        const sy = S.y[i] - sh0 * 24
        world.spawn(P_SPARK, sx, sy, -hx * 280 + (Math.random() - 0.5) * 240, -hy * 280 + (Math.random() - 0.5) * 240, 0.28 + Math.random() * 0.2, 1.4)
      }
    }
    world.update(dt)
    screen.update(dt)
    fire.update(dt)
  }

  // ----- bucle -----
  const frame = (t) => {
    raf = requestAnimationFrame(frame)
    if (dead) return
    if (document.hidden) {
      last = 0
      return
    }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016
    const gapMs = last ? t - last : 0
    last = t
    const p = P.current
    const reduced = !!p.reduced
    const now = p.getNow()
    const race = p.race || null
    const startMs = race ? race.start : startOf(Number.isFinite(p.round) ? p.round : Math.floor(now / 55000))
    const ms = now - startMs
    const nowReal = t

    if (race && rinfoFor !== race) {
      rinfo = raceInfo(race)
      rinfoFor = race
    }
    const info = race ? rinfo : null
    const rkey = startMs

    // nueva ronda: cortamos con un fundido
    const newRound = key !== rkey
    if (newRound) {
      if (key !== null && !reduced) fade = 1
      key = rkey
      ev = null
      snap = true
      marks.width = WORLD_W
      world.clear()
      screen.clear()
      fire.clear()
      trailN = 0
      prevMark.fill(NaN)
      rowY.fill(NaN)
      lastPass = 0
    }

    // pilotos y apuestas
    pilot.fill(null)
    for (const s of p.seats || []) if (s && s.car >= 0 && s.car < CARS) pilot[s.car] = s
    betOn.fill(0)
    for (const b of p.bets || []) if (b && b.car >= 0 && b.car < CARS) betOn[b.car] = b.amount

    computeCars(S, race, ms)

    // posiciones
    for (let i = 0; i < CARS; i++) {
      if (!race || ms < 0) keys[i] = -GRID_BACK[i]
      else keys[i] = ms >= race.finish[i] ? 10 + (1e6 - race.finish[i]) / 1e6 : shownProgress(race, i, ms) * 0.9 + progress(race.finish[i], race.wobble[i], ms) * 0.1
    }
    for (let i = 0; i < CARS; i++) prevOrder[i] = order[i]
    for (let i = 0; i < CARS; i++) order[i] = i
    order.sort((a, b) => keys[b] - keys[a])

    // eventos (solo los que vemos ocurrir; al entrar tarde no se repiten)
    const live = !!race
    if (!ev) {
      ev = { lights: lightsAt(ms), started: ms >= 0, fin: new Uint8Array(CARS), winner: false, raceSeen: live }
      if (race) {
        for (let i = 0; i < CARS; i++) ev.fin[i] = ms >= race.finish[i] ? 1 : 0
        ev.winner = ms >= info.t0
      }
    } else {
      const n = lightsAt(ms)
      if (n !== ev.lights) {
        if (n > ev.lights && gapMs < 1500) {
          emit({ type: 'lights', n })
          if (!p.muted) playBeep(n)
        }
        ev.lights = n
      }
      if (!ev.started && ms >= 0) {
        ev.started = true
        if (live && gapMs < 2500) {
          emit({ type: 'start' })
          if (!p.muted) playGo()
          if (!reduced) shake = Math.max(shake, 5)
        }
      }
      if (race) {
        if (!ev.raceSeen) {
          ev.raceSeen = true
          for (let i = 0; i < CARS; i++) ev.fin[i] = ms >= race.finish[i] ? 1 : 0
          ev.winner = ms >= info.t0
        }
        for (let pl = 0; pl < CARS; pl++) {
          const car = info.order[pl]
          if (!ev.fin[car] && ms >= race.finish[car]) {
            ev.fin[car] = 1
            emit({ type: 'finish', car, place: pl })
            if (pl === 0) {
              ev.winner = true
              emit({ type: 'winner', car, photo: info.photo })
              if (!p.muted) playCheer()
              if (!reduced) {
                shake = Math.max(shake, 9)
                flash = 0.22
                fireworkAt = nowReal
                for (let k = 0; k < 110; k++) {
                  screen.spawn(P_CONFETTI, Math.random() * cw, -10 - Math.random() * 60, (Math.random() - 0.5) * 140, 40 + Math.random() * 120, 3.2 + Math.random() * 2, 3 + Math.random() * 2.5, Math.floor(Math.random() * PALETTE.length), Math.random() * TAU, (Math.random() - 0.5) * 9)
                }
              }
            } else if (!reduced) shake = Math.max(shake, 3)
          }
        }
      }
    }

    // adelantamientos: un silbido
    if (race && ms > 800 && ms < (info?.t0 || 1e9) && nowReal - lastPass > 1400 && !p.muted) {
      for (let i = 0; i < 3; i++) {
        if (order[i] !== prevOrder[i] && prevOrder[i] !== undefined) {
          playPass()
          lastPass = nowReal
          break
        }
      }
    }

    // cámara
    camTarget(ms, race, info, p, tgt)
    const tx = tgt.x + tgt.dx
    const ty = tgt.y + tgt.dy
    if (snap || dt > 0.2) {
      cam.x = tx
      cam.y = ty
      cam.z = tgt.z
      snap = false
      camVelX = 0
      camVelY = 0
    } else {
      const kp = 1 - Math.exp(-dt * 6)
      const kz = 1 - Math.exp(-dt * 1.8)
      const ox = cam.x
      const oy = cam.y
      cam.x += (tx - cam.x) * kp
      cam.y += (ty - cam.y) * kp
      cam.z += (tgt.z - cam.z) * kz
      camVelX = (cam.x - ox) / Math.max(dt, 0.001)
      camVelY = (cam.y - oy) / Math.max(dt, 0.001)
    }
    // mantener la vista dentro del mundo cuando cabe
    const hx = cw / (2 * cam.z)
    const hy = ch / (2 * cam.z)
    const vx = hx * 2 < WORLD_W ? clamp(cam.x, hx, WORLD_W - hx) : WORLD_W / 2
    const vy = hy * 2 < WORLD_H ? clamp(cam.y, hy, WORLD_H - hy) : WORLD_H / 2
    shake *= Math.exp(-dt * 3.2)
    const spdLead = S.spd[order[0]]
    const shk = reduced ? 0 : shake + (ms > 0 ? Math.min(1, spdLead / 1100) * 0.9 : 0)
    const sx = shk ? (Math.sin(nowReal * 0.091) + Math.sin(nowReal * 0.053 + 1.3) * 0.6) * shk : 0
    const sy = shk ? (Math.sin(nowReal * 0.077 + 2) + Math.sin(nowReal * 0.067) * 0.6) * shk : 0

    simulate(dt, ms, race, info, p)

    // velocidad percibida: rayitas que cruzan la pantalla
    if (!reduced && ms > 0) {
      const sp = Math.hypot(camVelX, camVelY) * cam.z
      if (sp > 260 && Math.random() < 0.85) {
        const k = 1.1
        screen.spawn(P_STREAK, Math.random() * cw, Math.random() * ch, -camVelX * cam.z * k, -camVelY * cam.z * k, 0.28, 0.07)
      }
    }

    // fuegos artificiales de la celebración
    if (!reduced && info && ms >= info.t0 && ms < info.t0 + 5200 && nowReal - fireworkAt > 380) {
      fireworkAt = nowReal
      const fx = cw * (0.15 + Math.random() * 0.7)
      const fy = ch * (0.12 + Math.random() * 0.3)
      const c = Math.floor(Math.random() * FIRE_PALETTE.length)
      for (let k = 0; k < 34; k++) {
        const a = (k / 34) * TAU + Math.random() * 0.2
        const v = 90 + Math.random() * 110
        fire.spawn(P_FIRE, fx, fy, Math.cos(a) * v, Math.sin(a) * v, 0.9 + Math.random() * 0.5, 3.4 + Math.random() * 2.2, (c + (k % 3 === 0 ? 1 : 0)) % FIRE_PALETTE.length)
      }
    }

    // ------- pintar -------
    const vpMain = { ox: 0, oy: 0, w: cw, h: ch, x: vx + sx / cam.z, y: vy + sy / cam.z, z: cam.z }
    worldDraw(vpMain, S, ms, race, true, nowReal, p)

    // repetición en cámara lenta del cruce de meta (foto-finish)
    const replayAt = info ? ms - (info.t0 + 900) : -1
    let replayShown = false
    if (info && info.photo && replayAt >= 0 && replayAt < 3400) {
      replayShown = true
      if (!reduced) drawReplay(race, info, replayAt, nowReal, p)
    }

    // ------- interfaz en píxeles CSS -------
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
    g.drawImage(vignette, 0, 0, cw, ch)

    g.globalCompositeOperation = 'lighter'
    fire.draw(g, P_FIRE)
    g.globalCompositeOperation = 'source-over'
    screen.draw(g, P_STREAK)
    screen.draw(g, P_CONFETTI)

    drawLabels(race, info, ms, p, nowReal)
    drawBoard(race, info, ms, p, dt)
    drawSemaphore(race, ms, nowReal, p)
    drawMinimap(ms, info, p)
    drawBanner(race, info, ms, nowReal, p)
    if (!(replayShown && u < 1 && !reduced)) drawPodium(race, info, ms, nowReal, p)

    if (flash > 0.01) {
      g.fillStyle = `rgba(255,255,255,${flash})`
      g.fillRect(0, 0, cw, ch)
      flash *= Math.exp(-dt * 5)
    }
    if (fade > 0.01) {
      g.fillStyle = `rgba(3,8,12,${Math.min(1, fade)})`
      g.fillRect(0, 0, cw, ch)
      fade = Math.max(0, fade - dt * 1.6)
    }

    // sonido del motor
    audioTick(ms, info, p, nowReal)
    // etiqueta accesible, de vez en cuando
    if (nowReal - lastAria > 2500) {
      lastAria = nowReal
      const text = describe(race, info, ms)
      if (text !== lastAriaText) {
        lastAriaText = text
        canvas.setAttribute('aria-label', text)
      }
    }
  }

  const describe = (race, info, ms) => {
    const nm = (c) => CAR_INFO[c].name
    if (ms < -GRID_MS || !race) return ms < 0 ? 'Circuito nocturno: los coches desfilan hacia la parrilla de salida' : 'Carrera a punto de empezar'
    if (ms < 0) return 'Parrilla de salida: cuenta atrás del semáforo'
    if (ms >= info.t0) {
      const done = info.order.filter((c) => ms >= race.finish[c])
      return `Meta: gana ${nm(info.order[0])}. ${done.slice(0, 3).map((c, i) => `${i + 1}.º ${nm(c)}`).join(', ')}`
    }
    const lap = clamp(Math.floor(shownProgress(race, order[0], ms) * LAPS) + 1, 1, LAPS)
    return `Carrera en curso, vuelta ${lap} de ${LAPS}: ${order.slice(0, 3).map((c, i) => `${i + 1}.º ${nm(c)}`).join(', ')}`
  }

  // ----- sonido -----
  const audioTick = (ms, info, p, nowReal) => {
    if (p.muted || document.hidden) {
      if (engine) {
        engine.stop()
        engine = null
      }
      return
    }
    if (!engine && nowReal - engineTry > 1500) {
      engineTry = nowReal
      engine = startEngine()
    }
    if (!engine) return
    const car = p.mySeat != null && p.mySeat >= 0 ? p.mySeat : order[0]
    const spd = S.spd[car]
    const gear = spd / 330
    const pitch = clamp(0.18 + 0.5 * (spd / 1100) + 0.32 * (gear - Math.floor(gear)), 0, 1)
    let vol = ms < -GRID_MS ? 0.28 : ms < 0 ? 0.45 : 0.9
    if (info) vol *= 1 - smooth(clamp((ms - info.t0 - 1000) / 5000, 0, 1)) * 0.85
    engine.set(pitch, vol)
  }

  // ----- repetición -----
  const drawReplay = (race, info, el, nowReal, p) => {
    const mob = u < 1
    const bw = mob ? cw - 24 : Math.round(Math.min(cw * 0.4, 520 * u))
    const bh = Math.round(bw * (mob ? 0.5 : 0.6))
    const bx = cw - bw - 12 * u
    const bb = bannerBox(info, p)
    const by = mob ? bb.cy + bb.bh / 2 + 6 : 12 * u
    const t2 = info.t0 - 280 + el * 0.2
    computeCars(S2, race, t2)
    at(0, 0, o)
    const z = bw / 520
    const alpha = Math.min(1, el / 300, (3400 - el) / 400)
    g.save()
    g.globalAlpha = alpha
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.beginPath()
    rrPath(g, bx, by, bw, bh, 10)
    g.clip()
    worldDraw({ ox: bx, oy: by, w: bw, h: bh, x: o.x + o.tx * 34, y: o.y + o.ty * 34, z: z * (mob ? 1.4 : 1.15) }, S2, t2, race, false, nowReal, p)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.globalAlpha = alpha
    // franja de la línea y etiquetas de los dos primeros
    const zz = z * (mob ? 1.4 : 1.15)
    const toX = (wx) => bx + bw / 2 + (wx - (o.x + o.tx * 34)) * zz
    const toY = (wy) => by + bh / 2 + (wy - (o.y + o.ty * 34)) * zz
    g.strokeStyle = 'rgba(255,60,60,0.9)'
    g.lineWidth = 1.5
    g.setLineDash([5, 4])
    g.beginPath()
    g.moveTo(toX(o.x), by)
    g.lineTo(toX(o.x), by + bh)
    g.stroke()
    g.setLineDash([])
    g.font = `800 ${11 * u}px ${FONT}`
    g.textAlign = 'center'
    for (let pl = 0; pl < 2; pl++) {
      const c = info.order[pl]
      const lx = toX(S2.x[c])
      const ly = toY(S2.y[c]) - 26 * zz
      g.fillStyle = PLACE_COL[pl]
      g.fillText(`${pl + 1}.º`, lx, ly)
    }
    g.textAlign = 'left'
    const grd = g.createLinearGradient(0, by, 0, by + 24 * u)
    grd.addColorStop(0, 'rgba(0,0,0,0.75)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(bx, by, bw, 24 * u)
    g.fillStyle = '#ff5e5e'
    g.beginPath()
    g.arc(bx + 14 * u, by + 12 * u, 4 * u * (0.8 + 0.2 * Math.sin(nowReal / 150)), 0, TAU)
    g.fill()
    g.fillStyle = '#fff'
    g.font = `800 ${11 * u}px ${FONT}`
    g.fillText('FOTO FINISH · CÁMARA LENTA ×0,2', bx + 24 * u, by + 16 * u)
    g.restore()
    g.save()
    g.globalAlpha = alpha
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.strokeStyle = 'rgba(255,215,90,0.85)'
    g.lineWidth = 2
    rrPath(g, bx, by, bw, bh, 10)
    g.stroke()
    g.restore()
  }

  // ----- interfaz -----
  const pill = (x, y, w, h, fill, stroke) => {
    rrPath(g, x, y, w, h, Math.min(h / 2, 10))
    g.fillStyle = fill
    g.fill()
    if (stroke) {
      g.strokeStyle = stroke
      g.lineWidth = 1.2
      g.stroke()
    }
  }

  const toScreen = (wx, wy, out) => {
    const hx = cw / (2 * cam.z)
    const hy = ch / (2 * cam.z)
    const vx = hx * 2 < WORLD_W ? clamp(cam.x, hx, WORLD_W - hx) : WORLD_W / 2
    const vy = hy * 2 < WORLD_H ? clamp(cam.y, hy, WORLD_H - hy) : WORLD_H / 2
    out.x = cw / 2 + (wx - vx) * cam.z
    out.y = ch / 2 + (wy - vy) * cam.z
  }

  const sp = { x: 0, y: 0 }
  const drawLabels = (race, info, ms, p, nowReal) => {
    g.textBaseline = 'alphabetic'
    for (let i = 0; i < CARS; i++) {
      toScreen(S.x[i], S.y[i], sp)
      if (sp.x < -20 || sp.x > cw + 20 || sp.y < -20 || sp.y > ch + 20) {
        // fuera de plano: una flecha en el borde con su color y su número
        const m = 20 * u
        const ex = clamp(sp.x, m, cw - m)
        const ey = clamp(sp.y, m + (ex < 260 * u ? 150 * u : 0), ch - m - (ex > cw - 190 * u ? 100 * u : 0))
        const ang = Math.atan2(sp.y - ey, sp.x - ex)
        g.save()
        g.translate(ex, ey)
        g.fillStyle = 'rgba(6,14,20,0.8)'
        g.beginPath()
        g.arc(0, 0, 13 * u, 0, TAU)
        g.fill()
        g.fillStyle = CAR_INFO[i].color
        g.beginPath()
        g.arc(0, 0, 10 * u, 0, TAU)
        g.fill()
        if (p.mySeat === i || betOn[i] > 0) {
          g.strokeStyle = p.mySeat === i ? '#5ff0ff' : GOLD
          g.lineWidth = 2
          g.beginPath()
          g.arc(0, 0, 13 * u, 0, TAU)
          g.stroke()
        }
        g.fillStyle = '#0b1218'
        g.font = `800 ${11 * u}px ${FONT}`
        g.textAlign = 'center'
        g.fillText(String(i + 1), 0, 4 * u)
        g.rotate(ang)
        g.fillStyle = CAR_INFO[i].color
        g.beginPath()
        g.moveTo(17 * u, 0)
        g.lineTo(11 * u, -5 * u)
        g.lineTo(11 * u, 5 * u)
        g.fill()
        g.restore()
        g.textAlign = 'left'
        continue
      }
      const mine = p.mySeat === i
      const s = pilot[i]
      const txt = mine ? 'TÚ' : s ? String(s.name).slice(0, 12) : 'IA'
      const fs = clamp(cam.z * 9.5, 10, 13) * (u < 1 ? 0.92 : 1)
      g.font = `700 ${fs}px ${FONT}`
      const tw = g.measureText(txt).width
      const hasBet = betOn[i] > 0
      const w = tw + fs * 2.2 + (hasBet ? fs * 1.6 : 0)
      const h = fs * 1.7
      const x = sp.x - w / 2
      const y = sp.y - 34 * cam.z - h
      pill(x, y, w, h, 'rgba(6,14,20,0.72)', mine ? '#5ff0ff' : rgba(CAR_INFO[i].color, 0.9))
      g.fillStyle = CAR_INFO[i].color
      g.beginPath()
      g.arc(x + h / 2, y + h / 2, h * 0.36, 0, TAU)
      g.fill()
      g.fillStyle = '#0b1218'
      g.textAlign = 'center'
      g.font = `800 ${fs * 0.85}px ${FONT}`
      g.fillText(s ? initials(s.name) : String(i + 1), x + h / 2, y + h / 2 + fs * 0.3)
      g.textAlign = 'left'
      g.font = `700 ${fs}px ${FONT}`
      g.fillStyle = s ? '#f1e9d6' : 'rgba(241,233,214,0.7)'
      g.fillText(txt, x + h + fs * 0.35, y + h / 2 + fs * 0.35)
      if (hasBet) {
        g.fillStyle = GOLD
        g.fillText('$', x + w - fs * 1.1, y + h / 2 + fs * 0.35)
      }
    }
    void race
    void info
    void ms
    void nowReal
  }

  const drawBoard = (race, info, ms, p, dt) => {
    const bu = u < 1 ? 0.78 : 1
    const rowH = 25 * bu
    const w = (u < 1 ? 190 : 236) * bu
    const x = 10 * bu
    const y = 10 * bu
    const hdrH = 25 * bu
    const total = hdrH + rowH * CARS + 6 * bu
    pill(x, y, w, total, 'rgba(6,14,20,0.66)', 'rgba(200,162,75,0.35)')
    // cabecera
    let head
    if (!race || ms < -GRID_MS) head = 'VUELTA DE FORMACIÓN'
    else if (ms < 0) head = 'PARRILLA DE SALIDA'
    else if (info && ms >= info.t0) head = 'META'
    else head = `VUELTA ${clamp(Math.floor(shownProgress(race, order[0], ms) * LAPS) + 1, 1, LAPS)} / ${LAPS}`
    g.font = `800 ${11.5 * bu}px ${FONT}`
    g.fillStyle = '#c8a24b'
    g.textAlign = 'left'
    g.fillText(head, x + 12 * bu, y + 17 * bu)
    const prizes = p.podium || PODIUM
    for (let r = 0; r < CARS; r++) {
      const c = order[r]
      const ty = y + hdrH + r * rowH
      if (Number.isNaN(rowY[c])) rowY[c] = ty
      rowY[c] += (ty - rowY[c]) * (1 - Math.exp(-dt * 10))
      const ry = rowY[c]
      const fin = race && ms >= race.finish[c]
      const place = fin && info ? info.place[c] : r
      if (r < 3) {
        const gr = g.createLinearGradient(x, 0, x + w, 0)
        gr.addColorStop(0, rgba(PLACE_COL[r], 0.22))
        gr.addColorStop(1, rgba(PLACE_COL[r], 0.02))
        g.fillStyle = gr
        rrPath(g, x + 4 * bu, ry + 1, w - 8 * bu, rowH - 2, 7)
        g.fill()
      }
      // puesto
      g.fillStyle = r < 3 ? PLACE_COL[r] : 'rgba(241,233,214,0.12)'
      g.beginPath()
      g.arc(x + 17 * bu, ry + rowH / 2, 9 * bu, 0, TAU)
      g.fill()
      g.fillStyle = r < 3 ? '#1b1405' : '#f1e9d6'
      g.font = `800 ${11.5 * bu}px ${FONT}`
      g.textAlign = 'center'
      g.fillText(String((fin ? place : r) + 1), x + 17 * bu, ry + rowH / 2 + 4 * bu)
      // chip del coche
      g.fillStyle = CAR_INFO[c].color
      rrPath(g, x + 31 * bu, ry + 5 * bu, 5 * bu, rowH - 10 * bu, 2)
      g.fill()
      g.textAlign = 'left'
      g.fillStyle = '#f1e9d6'
      g.font = `${r < 3 ? 800 : 600} ${12.5 * bu}px ${FONT}`
      g.fillText(CAR_INFO[c].name, x + 42 * bu, ry + rowH / 2 + 4.3 * bu)
      const nameW = g.measureText(CAR_INFO[c].name).width
      if (u === 1) {
        const s = pilot[c]
        g.font = `600 ${10 * bu}px ${FONT}`
        g.fillStyle = p.mySeat === c ? '#5ff0ff' : 'rgba(241,233,214,0.55)'
        const lbl = p.mySeat === c ? 'TÚ' : s ? String(s.name).slice(0, 9) : 'IA'
        if (x + 42 * bu + nameW + 6 + g.measureText(lbl).width < x + w - 62) g.fillText(lbl, x + 42 * bu + nameW + 6 * bu, ry + rowH / 2 + 3.8 * bu)
      }
      // premio y apuestas
      g.textAlign = 'right'
      if (r < prizes.length) {
        g.font = `800 ${10.5 * bu}px ${FONT}`
        g.fillStyle = PLACE_COL[r]
        g.fillText(fmtMult(prizes[r]), x + w - 10 * bu, ry + rowH / 2 + 3.8 * bu)
      }
      if (betOn[c] > 0) {
        g.fillStyle = GOLD
        g.font = `800 ${10 * bu}px ${FONT}`
        g.fillText('$', x + w - (r < prizes.length ? 48 : 10) * bu, ry + rowH / 2 + 3.8 * bu)
      }
      if (fin) {
        const sx = x + w - 2 * bu - (r < prizes.length ? 70 : 24) * bu
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          g.fillStyle = (a + b) & 1 ? '#10141a' : '#f7f7f2'
          g.fillRect(sx + a * 4 * bu, ry + rowH / 2 - 4 * bu + b * 4 * bu, 4 * bu, 4 * bu)
        }
      }
      g.textAlign = 'left'
    }
  }

  const drawSemaphore = (race, ms, nowReal, p) => {
    if (ms < -GRID_MS || ms > 1600) return
    const r = 15 * u
    const gap = 8 * u
    const w = 5 * (2 * r) + 6 * gap
    const x = u < 1 ? cw - w - 10 : cw / 2 - w / 2
    const y = 12 * u
    const alpha = ms > 900 ? 1 - (ms - 900) / 700 : 1
    g.globalAlpha = alpha
    pill(x, y, w, 2 * r + 2 * gap, 'rgba(6,10,14,0.85)', 'rgba(255,255,255,0.15)')
    const n = ms < 0 ? lightsAt(ms) : 0
    const green = ms >= 0
    for (let k = 0; k < 5; k++) {
      const cx = x + gap + r + k * (2 * r + gap)
      const cy = y + gap + r
      const lit = green || k < n
      g.fillStyle = lit ? (green ? '#7dffa0' : '#ff3d30') : '#2b0c0c'
      g.beginPath()
      g.arc(cx, cy, r, 0, TAU)
      g.fill()
      if (lit) {
        g.globalCompositeOperation = 'lighter'
        g.drawImage(green ? spr.green : spr.red, cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8)
        g.globalCompositeOperation = 'source-over'
      }
    }
    g.font = `800 ${11 * u}px ${FONT}`
    g.textAlign = 'center'
    g.fillStyle = green ? '#8bffa8' : 'rgba(241,233,214,0.7)'
    const text = green ? '¡YA!' : n === 0 ? 'Prepárate…' : 'Atentos…'
    g.fillText(text, x + w / 2, y + 2 * r + 2 * gap + 15 * u)
    g.textAlign = 'left'
    g.globalAlpha = 1
    void race
    void nowReal
    void p
  }

  const drawMinimap = (ms, info, p) => {
    void p
    if (info && ms >= info.t0 + 800 && u < 1) return
    const w = (u < 1 ? 104 : 168) * 1
    const s = w / WORLD_W
    const h = WORLD_H * s
    const x = cw - w - 12 * u
    const y = ch - h - 12 * u
    pill(x - 6, y - 6, w + 12, h + 12, 'rgba(6,14,20,0.62)', 'rgba(200,162,75,0.3)')
    g.save()
    g.translate(x, y)
    g.scale(s, s)
    g.lineJoin = 'round'
    g.strokeStyle = 'rgba(255,255,255,0.18)'
    g.lineWidth = 34
    g.stroke(centerPath)
    g.strokeStyle = 'rgba(8,16,22,0.9)'
    g.lineWidth = 22
    g.stroke(centerPath)
    g.restore()
    // meta
    at(0, 0, o)
    g.fillStyle = '#fff'
    g.fillRect(x + o.x * s - 1.5, y + o.y * s - 4, 3, 8)
    for (let r = CARS - 1; r >= 0; r--) {
      const c = order[r]
      const px = x + S.x[c] * s
      const py = y + S.y[c] * s
      g.fillStyle = CAR_INFO[c].color
      g.strokeStyle = p.mySeat === c ? '#5ff0ff' : betOn[c] > 0 ? GOLD : 'rgba(0,0,0,0.6)'
      g.lineWidth = p.mySeat === c || betOn[c] > 0 ? 2 : 1
      g.beginPath()
      g.arc(px, py, r === 0 ? 4.5 * u : 3.5 * u, 0, TAU)
      g.fill()
      g.stroke()
    }
  }

  const drawFlag = (x, y, w, h, t) => {
    const cols = 10
    const rows = 6
    const cwid = w / cols
    const chei = h / rows
    g.fillStyle = '#c9ccd2'
    g.fillRect(x - 3, y - 4, 3, h + 40 * u)
    for (let c = 0; c < cols; c++) {
      const off = Math.sin(c * 0.7 - t * 8) * 4 * u * (c / cols + 0.2)
      for (let r = 0; r < rows; r++) {
        g.fillStyle = (c + r) & 1 ? '#0c0f13' : '#f6f6f1'
        g.fillRect(x + c * cwid, y + r * chei + off, cwid + 0.6, chei + 0.6)
      }
    }
  }

  const bannerBox = (info, p) => {
    const bw = Math.min(cw * 0.86, 560 * u)
    const bh = 94 * u
    const insetW = Math.round(Math.min(cw * 0.4, 520 * u))
    let cx = cw / 2
    let cy = ch * 0.27
    if (u < 1) cy = (10 + 25 + 6 * 25 + 6) * 0.78 + 12 + bh / 2
    else if (info.photo && !p.reduced) cx = 260 + (cw - insetW - 24 - 260) / 2
    cx = Math.max(cx, bw / 2 + 4)
    return { cx, cy, bw, bh }
  }

  const drawBanner = (race, info, ms, nowReal, p) => {
    if (!info) return
    const el = ms - info.t0
    if (el < 0 || el > 6200) return
    const win = info.order[0]
    const a = clamp(Math.min(el / 250, (6200 - el) / 700), 0, 1)
    const pop = p.reduced ? 1 : 1 + Math.max(0, 1 - el / 500) * 0.35 * Math.cos(el / 60)
    const { cx, cy, bw, bh } = bannerBox(info, p)
    const pilotInfo = pilot[win]
    g.save()
    g.globalAlpha = a
    g.translate(cx, cy)
    g.scale(pop, pop)
    const gr = g.createLinearGradient(-bw / 2, 0, bw / 2, 0)
    gr.addColorStop(0, 'rgba(6,12,18,0)')
    gr.addColorStop(0.12, 'rgba(6,12,18,0.82)')
    gr.addColorStop(0.88, 'rgba(6,12,18,0.82)')
    gr.addColorStop(1, 'rgba(6,12,18,0)')
    g.fillStyle = gr
    g.fillRect(-bw / 2, -bh / 2, bw, bh)
    g.fillStyle = CAR_INFO[win].color
    g.fillRect(-bw / 2 + bw * 0.08, -bh / 2, bw * 0.84, 3 * u)
    g.fillRect(-bw / 2 + bw * 0.08, bh / 2 - 3 * u, bw * 0.84, 3 * u)
    if (!p.reduced) drawFlag(-bw / 2 + bw * 0.1, -22 * u, 38 * u, 26 * u, nowReal / 1000)
    g.textAlign = 'center'
    g.font = `900 italic ${(u < 1 ? 26 : 38) * 1}px ${FONT}`
    g.shadowColor = CAR_INFO[win].color
    g.shadowBlur = p.reduced ? 0 : 18
    g.fillStyle = '#fff8e6'
    g.fillText(`¡GANA ${CAR_INFO[win].name.toUpperCase()}!`, 0, 4 * u)
    g.shadowBlur = 0
    g.font = `700 ${14 * u}px ${FONT}`
    g.fillStyle = 'rgba(241,233,214,0.9)'
    g.fillText(pilotInfo ? `Piloto: ${pilotInfo.name}${p.mySeat === win ? ' (¡tú!)' : ''}` : 'Pilotado por la IA', 0, 30 * u)
    if (info.photo) {
      g.font = `800 ${11 * u}px ${FONT}`
      g.fillStyle = GOLD
      g.fillText('¡FOTO FINISH!', 0, -28 * u)
    }
    g.restore()
    void race
  }

  const drawPodium = (race, info, ms, nowReal, p) => {
    if (!info) return
    const el0 = ms - info.t0
    if (el0 < 900) return
    const prizes = p.podium || PODIUM
    const pw = (u < 1 ? 74 : 118) * 1
    const gapX = 8 * u
    const hs = [86, 64, 48].map((v) => v * u * (u < 1 ? 0.95 : 1))
    const total = 3 * pw + 2 * gapX
    const baseY = ch - 16 * u
    const slotX = [cw / 2 - total / 2 + pw + gapX, cw / 2 - total / 2, cw / 2 - total / 2 + 2 * (pw + gapX)]
    const showOrder = [0, 1, 2]
    for (const pl of showOrder) {
      const c = info.order[pl]
      const since = ms - race.finish[c]
      if (since < 700) continue
      const k = p.reduced ? 1 : smooth(clamp((since - 700) / 450, 0, 1))
      const x = slotX[pl]
      const hh = hs[pl] * k
      const col = PLACE_COL[pl]
      const gr = g.createLinearGradient(0, baseY - hh, 0, baseY)
      gr.addColorStop(0, rgba(col, 0.95))
      gr.addColorStop(1, shade(col, -0.55))
      g.fillStyle = gr
      rrPath(g, x, baseY - hh, pw, hh, 8 * u)
      g.fill()
      const mine = p.mySeat === c
      const bet = betOn[c] > 0
      g.strokeStyle = mine ? '#5ff0ff' : bet ? '#fff' : 'rgba(255,255,255,0.3)'
      g.lineWidth = mine || bet ? 2.5 : 1
      g.stroke()
      if (hh > 30 * u) {
        g.textAlign = 'center'
        g.fillStyle = '#1b1405'
        g.font = `900 ${(u < 1 ? 20 : 28)}px ${FONT}`
        g.fillText(String(pl + 1), x + pw / 2, baseY - hh + (u < 1 ? 22 : 30))
        g.font = `800 ${(u < 1 ? 11 : 14)}px ${FONT}`
        g.fillText(fmtMult(prizes[pl] ?? 0), x + pw / 2, baseY - 7 * u)
      }
      // coche sobre el podio, mirando arriba
      const cs = (u < 1 ? 0.72 : 1.1) * (pl === 0 ? 1.1 : 1)
      g.save()
      g.translate(x + pw / 2, baseY - hh - 38 * cs - (p.reduced ? 0 : Math.sin(nowReal / 500 + pl) * 2))
      g.rotate(-Math.PI / 2)
      g.scale(cs, cs)
      g.drawImage(spr.cars[c], -35, -20, 70, 40)
      g.restore()
      // nombre
      g.font = `800 ${(u < 1 ? 10 : 12)}px ${FONT}`
      g.fillStyle = '#fff'
      g.textAlign = 'center'
      const nameY = baseY - hh - 38 * cs - 36 * cs
      g.shadowColor = '#000'
      g.shadowBlur = 4
      g.fillText(CAR_INFO[c].name + (pilot[c] ? ` · ${String(pilot[c].name).slice(0, 8)}` : ''), x + pw / 2, nameY)
      g.shadowBlur = 0
    }
    g.textAlign = 'left'
  }

  raf = requestAnimationFrame(frame)
  const onVisibility = () => {
    last = 0
    snap = true
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    dead = true
    cancelAnimationFrame(raf)
    observer.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    if (engine) engine.stop()
    engine = null
  }
}

export default function RaceScene(props) {
  const canvas = useRef(null)
  const latest = useRef(props)
  latest.current = props
  useEffect(() => mount(canvas.current, latest), [])
  return (
    <div className="race-scene">
      <canvas ref={canvas} role="img" aria-label="Circuito nocturno: los coches desfilan hacia la parrilla de salida" />
    </div>
  )
}
