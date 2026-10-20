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
