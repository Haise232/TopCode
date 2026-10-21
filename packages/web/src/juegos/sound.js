// Efectos de sonido sintetizados con Web Audio, sin archivos externos.
let ctx = null
let master = null
let muted = false

export const isMuted = () => muted

export function setMuted(value) {
  muted = value
  if (master) master.gain.value = value ? 0 : 1
}

// El contexto se crea en el primer gesto del usuario, como exigen los navegadores.
function audio() {
  if (muted) return null
  try {
    if (!ctx) {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(ac, { freq, to, at = 0, dur, type = 'triangle', peak = 0.12 }) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const start = ac.currentTime + at
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  gain.gain.setValueAtTime(peak, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(master)
  osc.start(start)
  osc.stop(start + dur)
}

export function playChip() {
  const ac = audio()
  if (ac) tone(ac, { freq: 900, dur: 0.06, type: 'square', peak: 0.05 })
}

// Tictac de la bola: empieza rápido y se va espaciando hasta que se detiene.
export function playSpin(ms) {
  const ac = audio()
  if (!ac) return
  let gap = 0.045
  for (let at = 0; at < ms / 1000 - 0.1; at += gap) {
    tone(ac, { freq: 1400, at, dur: 0.03, type: 'square', peak: 0.04 })
    gap *= 1.09
  }
}

export function playZap() {
  const ac = audio()
  if (ac) tone(ac, { freq: 1800, to: 180, dur: 0.28, type: 'sawtooth', peak: 0.07 })
}

export function playWin(big) {
  const ac = audio()
  if (!ac) return
  const notes = big ? [523, 659, 784, 1047, 1319, 1568, 2093, 1568, 2093] : [523, 659, 784, 1047]
  notes.forEach((freq, i) => tone(ac, { freq, at: i * 0.09, dur: 0.22 }))
}

export function playLose() {
  const ac = audio()
  if (ac) tone(ac, { freq: 190, to: 110, dur: 0.3, type: 'sine', peak: 0.12 })
}

// Golpe seco de un rodillo al detenerse.
export function playClunk() {
  const ac = audio()
  if (ac) tone(ac, { freq: 240, to: 90, dur: 0.12, type: 'square', peak: 0.09 })
}

// Toque de la bola de Plinko contra un clavo: más agudo cuanto más abajo.
export function playPeg(row = 0) {
  const ac = audio()
  if (ac) tone(ac, { freq: 1100 + row * 60, dur: 0.035, type: 'sine', peak: 0.035 })
}

// Roce de una carta al caer sobre el tapete.
export function playCard() {
  const ac = audio()
  if (ac) tone(ac, { freq: 2600, to: 700, dur: 0.07, type: 'sawtooth', peak: 0.03 })
}

// Aviso de turno: dos notas claras, para que se oiga aunque mires otra cosa.
export function playTurn() {
  const ac = audio()
  if (!ac) return
  tone(ac, { freq: 880, dur: 0.16, type: 'sine', peak: 0.14 })
  tone(ac, { freq: 1320, at: 0.13, dur: 0.24, type: 'sine', peak: 0.14 })
}

// Despegue del cohete: un silbido que sube.
export function playLaunch() {
  const ac = audio()
  if (ac) tone(ac, { freq: 220, to: 880, dur: 0.6, type: 'sawtooth', peak: 0.05 })
}

// Explosión del cohete: un golpe grave que se apaga.
export function playBoom() {
  const ac = audio()
  if (!ac) return
  tone(ac, { freq: 140, to: 40, dur: 0.5, type: 'sawtooth', peak: 0.14 })
  tone(ac, { freq: 90, to: 30, dur: 0.7, type: 'square', peak: 0.06, at: 0.04 })
}

// Vibración corta en móvil (cae, cobra…). Respeta el interruptor de Sonido.
export function buzz(pattern) {
  if (muted) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // sin vibración en este navegador
  }
}

// Despegue de la rana: un «boing» que sube de tono con cada nenúfar (y gana un tictac grave cuando hay tensión).
export function playHop(mult = 1) {
  const ac = audio()
  if (!ac) return
  const base = 300 + mult * 55
  tone(ac, { freq: base, to: base * 1.8, dur: 0.14, type: 'sine', peak: 0.1 })
  if (mult >= 7) tone(ac, { freq: 70, to: 55, at: 0.02, dur: 0.18, type: 'sine', peak: 0.12 })
}

// Aterrizaje sobre el nenúfar: toquecito, más agudo cuanto más lejos.
export function playLand(mult = 1) {
  const ac = audio()
  if (ac) tone(ac, { freq: 520 + mult * 90, dur: 0.09, type: 'triangle', peak: 0.09 })
}

// Caída al agua: chapuzón (ruido grave que baja) y burbujas.
export function playSplash() {
  const ac = audio()
  if (!ac) return
  tone(ac, { freq: 700, to: 120, dur: 0.35, type: 'sawtooth', peak: 0.06 })
  tone(ac, { freq: 300, to: 600, at: 0.12, dur: 0.07, type: 'sine', peak: 0.07 })
  tone(ac, { freq: 380, to: 760, at: 0.24, dur: 0.07, type: 'sine', peak: 0.06 })
}

// Cobro: monedas que suben tanto más cuanto mayor es el multiplicador.
export function playCash(mult = 1) {
  const ac = audio()
  if (!ac) return
  const n = Math.min(7, 2 + Math.floor(mult / 2))
  for (let i = 0; i < n; i++) tone(ac, { freq: 988 * 2 ** (i / 6), at: i * 0.06, dur: 0.12, type: 'square', peak: 0.04 })
}

// ---- Carrera de coches ----
// Pitido del semáforo (luz n de 5) y «¡ya!» al apagarse.
export function playBeep(n = 1) {
  const ac = audio()
  if (ac) tone(ac, { freq: 440 + n * 18, dur: 0.22, type: 'square', peak: 0.07 })
}

export function playGo() {
  const ac = audio()
  if (ac) tone(ac, { freq: 880, dur: 0.55, type: 'square', peak: 0.08 })
}

// Un coche pasa rozando: silbido grave que baja (efecto Doppler barato).
export function playPass() {
  const ac = audio()
  if (ac) tone(ac, { freq: 520, to: 150, dur: 0.38, type: 'sawtooth', peak: 0.035 })
}

// Claxon de meta + aplauso (ruido filtrado en ráfagas).
export function playCheer() {
  const ac = audio()
  if (!ac) return
  tone(ac, { freq: 392, dur: 0.5, type: 'square', peak: 0.05 })
  tone(ac, { freq: 494, dur: 0.5, type: 'square', peak: 0.04 })
  try {
    const len = Math.floor(ac.sampleRate * 1.6)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / ac.sampleRate
      data[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(t * 38)) * Math.min(1, t * 8) * Math.exp(-t * 1.6)
    }
    const src = ac.createBufferSource()
    src.buffer = buf
    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2400
    const gain = ac.createGain()
    gain.gain.value = 0.22
    src.connect(filter).connect(gain).connect(master)
    src.start()
  } catch {
    // sin ruido en este navegador
  }
}

// Motor continuo: dos osciladores y un filtro; set(tono 0..1, volumen 0..1). Devuelve null si está en silencio.
export function startEngine() {
  const ac = audio()
  if (!ac) return null
  try {
    const out = ac.createGain()
    out.gain.value = 0
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 500
    const a = ac.createOscillator()
    const b = ac.createOscillator()
    a.type = 'sawtooth'
    b.type = 'square'
    a.frequency.value = 60
    b.frequency.value = 30
    const bg = ac.createGain()
    bg.gain.value = 0.5
    a.connect(filter)
    b.connect(bg).connect(filter)
    filter.connect(out).connect(master)
    a.start()
    b.start()
    let dead = false
    return {
      set(pitch, vol) {
        if (dead) return
        const t = ac.currentTime
        a.frequency.setTargetAtTime(55 + pitch * 190, t, 0.06)
        b.frequency.setTargetAtTime(27 + pitch * 94, t, 0.06)
        filter.frequency.setTargetAtTime(380 + pitch * 1500, t, 0.08)
        out.gain.setTargetAtTime(vol * 0.07, t, 0.12)
      },
      stop() {
        if (dead) return
        dead = true
        try {
          out.gain.setTargetAtTime(0, ac.currentTime, 0.05)
          a.stop(ac.currentTime + 0.3)
          b.stop(ac.currentTime + 0.3)
        } catch {
          // ya parado
        }
      },
    }
  } catch {
    return null
  }
}
