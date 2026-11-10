export const FORO_CATEGORIAS = [
  { codigo: 'duda', nombre: 'Dudas', singular: 'Duda', color: '#60a5fa' },
  { codigo: 'fallo', nombre: 'Fallos', singular: 'Fallo', color: '#fb923c' },
]

export const categoriaForo = (codigo: string) =>
  FORO_CATEGORIAS.find(c => c.codigo === codigo) ?? FORO_CATEGORIAS[0]

export function timeAgo(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

export function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString('es', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
