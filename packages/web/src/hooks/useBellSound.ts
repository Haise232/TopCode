import { useCallback } from 'react'

export function useBellSound() {
  const play = useCallback(() => {
    try {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
      const AudioCtx = w.AudioContext || w.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()

      // Timbre estilo "ding-dong" — dos notas suaves
      const playTone = (freq: number, start: number, duration: number, vol = 0.15) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start)

        gain.gain.setValueAtTime(0, ctx.currentTime + start)
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + duration)
      }

      // Ding
      playTone(880, 0, 0.6, 0.12)
      // Dong (quinta abajo)
      playTone(587, 0.35, 0.8, 0.10)

      // Cerrar contexto tras los sonidos
      setTimeout(() => { ctx.close().catch(() => {}) }, 1500)
    } catch {
      // Silenciar errores de audio
    }
  }, [])

  return play
}
