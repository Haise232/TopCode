import { Plus, Search, Sparkles, X } from 'lucide-react'
import type { Prompt, PromptCategoria } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { Copo } from '../Navidad'
import { SkeletonBox } from '../Skeleton'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE, mez } from '../ui/estilos'
import { tinta } from '../../lib/tinta'
import { CATEGORIAS } from './config'
import TarjetaPrompt from './TarjetaPrompt'

export interface PromptsViewProps {
  prompts: Prompt[]
  filtered: Prompt[]
  loading: boolean
  error: string | null | undefined
  filtro: 'todos' | PromptCategoria
  onFiltro: (f: 'todos' | PromptCategoria) => void
  busqueda: string
  onBusqueda: (v: string) => void
  usuarioId: string | undefined
  isAdmin: boolean
  copiedId: string | null
  expanded: Set<string>
  onNuevo: () => void
  onEditar: (p: Prompt) => void
  onEliminar: (p: Prompt) => void
  onCopiar: (p: Prompt) => void
  onToggle: (id: string) => void
}

const CHIP = 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors duration-150'

function Vacio({ titulo, mensaje, accion }: { titulo: string; mensaje: string; accion?: React.ReactNode }) {
  return (
    <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-3 text-center px-6 py-14')}>
      <span className="w-14 h-14 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
        <Sparkles size={26} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-bold text-lg text-text-primary">{titulo}</p>
        <p className="text-sm leading-relaxed max-w-xs text-text-muted">{mensaje}</p>
      </div>
      {accion}
    </div>
  )
}

function Esqueleto() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Cargando prompts">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={cn(SUPERFICIE, 'p-5 flex flex-col gap-3')}>
          <div className="flex gap-3">
            <SkeletonBox className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 flex flex-col gap-2 pt-1">
              <SkeletonBox className="h-4 w-3/5" />
              <SkeletonBox className="h-3 w-2/5" />
            </div>
          </div>
          <SkeletonBox className="h-24 w-full rounded-xl" />
          <SkeletonBox className="h-10 w-36 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

export default function PromptsView(p: PromptsViewProps) {
  const { navidad } = useTheme()
  const hayFiltros = p.filtro !== 'todos' || p.busqueda.trim() !== ''
  const cuenta = (c: PromptCategoria) => p.prompts.filter(x => x.categoria === c).length

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">
        <header className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary">Prompts IA</h1>
              {navidad && <Copo size={18} className="text-gold-light" />}
            </div>
            <div className="mt-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-xs text-text-muted">
              {!p.loading && !p.error && (
                <span><b className="font-bold text-text-primary tabular-nums">{p.prompts.length}</b> prompts</span>
              )}
              <span>Para ChatGPT, Claude y otras IAs, compartidos por la clase</span>
            </div>
          </div>
          <Button onClick={p.onNuevo} icon={<Plus size={16} aria-hidden="true" />} className={cn('shrink-0', FOCO)}>
            Añadir
          </Button>
        </header>

        <div className="flex flex-col gap-3">
          <div className="relative w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={p.busqueda}
              onChange={e => p.onBusqueda(e.target.value)}
              placeholder="Buscar prompts..."
              aria-label="Buscar prompts"
              className="bg-input border border-ov/[0.08] rounded-xl pl-10 pr-10 py-2.5 text-text-primary text-sm placeholder:text-text-muted w-full outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]"
            />
            {p.busqueda && (
              <button onClick={() => p.onBusqueda('')} aria-label="Borrar búsqueda"
                className={cn('absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary', FOCO)}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <div role="group" aria-label="Filtrar por categoría"
            className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button onClick={() => p.onFiltro('todos')} aria-pressed={p.filtro === 'todos'}
              className={cn(CHIP, FOCO, p.filtro === 'todos' ? 'bg-text-primary text-bg border-transparent' : 'bg-surface border-ov/[0.1] text-text-secondary hover:bg-ov/[0.04]')}>
              Todos
            </button>
            {(Object.keys(CATEGORIAS) as PromptCategoria[]).map(c => {
              const { label, Icon, color } = CATEGORIAS[c]
              const active = p.filtro === c
              return (
                <button key={c} onClick={() => p.onFiltro(active ? 'todos' : c)} aria-pressed={active}
                  className={cn(CHIP, FOCO, !active && 'bg-surface border-ov/[0.1] text-text-secondary hover:bg-ov/[0.04]')}
                  style={active ? { background: mez(color, 16), color: tinta(color), borderColor: mez(color, 45) } : undefined}>
                  <Icon size={12} aria-hidden="true" style={{ color: tinta(color) }} />
                  {label}
                  <span className="tabular-nums opacity-70">{cuenta(c)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {p.loading ? (
          <Esqueleto />
        ) : p.error ? (
          <Vacio titulo="No se pudieron cargar los prompts" mensaje={p.error} />
        ) : p.filtered.length === 0 ? (
          <Vacio
            titulo={p.prompts.length === 0 ? 'Sin prompts todavía' : 'Ningún prompt coincide'}
            mensaje={p.prompts.length === 0 ? 'Comparte el primer prompt que te haya funcionado' : 'Prueba con otra búsqueda o categoría'}
            accion={hayFiltros && p.prompts.length > 0 && (
              <Button variant="ghost" onClick={() => { p.onBusqueda(''); p.onFiltro('todos') }} className="px-5">Limpiar filtros</Button>
            )}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 items-start">
            {p.filtered.map(pr => (
              <TarjetaPrompt
                key={pr.id}
                prompt={pr}
                puedeEditar={p.usuarioId === pr.usuario_id}
                puedeEliminar={p.usuarioId === pr.usuario_id || p.isAdmin}
                copiado={p.copiedId === pr.id}
                expandido={p.expanded.has(pr.id)}
                onCopiar={() => p.onCopiar(pr)}
                onEditar={() => p.onEditar(pr)}
                onEliminar={() => p.onEliminar(pr)}
                onToggle={() => p.onToggle(pr.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
