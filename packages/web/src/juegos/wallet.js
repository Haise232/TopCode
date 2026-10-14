// Saldo y récord compartidos por todos los juegos, guardados en el navegador.
export const STARTING_BANK = 1000
const STORAGE_KEY = 'juegos'

export function loadWallet() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(saved?.bank) && Number.isFinite(saved?.best)) {
      return { bank: saved.bank, best: saved.best }
    }
  } catch {
    // Sin almacenamiento disponible: se empieza de cero.
  }
  return { bank: STARTING_BANK, best: STARTING_BANK }
}

export function saveWallet({ bank, best }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bank, best }))
  } catch {
    // Sin almacenamiento disponible.
  }
}
