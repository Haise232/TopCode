import { ChevronRight, HelpCircle, MessageCircle, Plus } from 'lucide-react'
import type { ForoPost } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { Copo } from '../Navidad'
import { SkeletonBox } from '../Skeleton'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE, mez } from '../ui/estilos'
import { tinta } from '../../lib/tinta'
import { Avatar } from './Avatar'
import { Categoria, Estado } from './Estado'
import { FORO_CATEGORIAS, timeAgo } from './categorias'

export interface ForoViewProps {
  posts: ForoPost[]
  filtered: ForoPost[]
  loading: boolean
  error: string | null | undefined
  onRetry: () => void
  filtroMateria: string
  onFiltro: (codigo: string) => void
  soloSinResolver: boolean
  onToggleSinResolver: () => void
  onNueva: () => void
  onAbrir: (id: string) => void
}

const CHIP = 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors duration-150'
const CHIP_REPOSO = 'bg-surface border-ov/[0.1] text-text-secondary hover:bg-ov/[0.04]'
const CHIP_ACTIVO = 'bg-text-primary text-bg border-transparent'

function Filtros(p: ForoViewProps) {
  const cuenta = (codigo: string) => p.posts.filter(x => x.materia === codigo).length
  return (
    <div role="group" aria-label="Filtrar preguntas"
      className="flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button onClick={() => p.onFiltro('todos')} aria-pressed={p.filtroMateria === 'todos'}
        className={cn(CHIP, FOCO, p.filtroMateria === 'todos' ? CHIP_ACTIVO : CHIP_REPOSO)}>
        Todos <span className="tabular-nums opacity-70">{p.posts.length}</span>
      </button>
      {FORO_CATEGORIAS.map(c => {
        const active = p.filtroMateria === c.codigo
        return (
          <button key={c.codigo} onClick={() => p.onFiltro(c.codigo)} aria-pressed={active}
            className={cn(CHIP, FOCO, !active && CHIP_REPOSO)}
            style={active ? { background: mez(c.color, 16), color: tinta(c.color), borderColor: mez(c.color, 45) } : undefined}>
            {c.nombre} <span className="tabular-nums opacity-70">{cuenta(c.codigo)}</span>
          </button>
        )
      })}
      <span className="w-px h-5 shrink-0 bg-ov/[0.12]" aria-hidden="true" />
      <button onClick={p.onToggleSinResolver} aria-pressed={p.soloSinResolver}
        className={cn(CHIP, FOCO, p.soloSinResolver ? CHIP_ACTIVO : CHIP_REPOSO)}>
        Sin resolver
      </button>
    </div>
  )
}

function Fila({ post, onAbrir }: { post: ForoPost; onAbrir: (id: string) => void }) {
  const respuestas = post.foro_respuestas?.length ?? 0
  return (
    <li>
      <button
        onClick={() => onAbrir(post.id)}
        className={cn('group w-full flex items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-ov/[0.04] focus-visible:bg-ov/[0.04]', FOCO, 'focus-visible:ring-inset focus-visible:ring-offset-0')}
      >
        <Avatar nombre={post.autor} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Categoria codigo={post.materia} />
            <Estado resuelto={post.resuelto} />
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-text-primary line-clamp-2 group-hover:text-primary-light">{post.titulo}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted line-clamp-2">{post.cuerpo}</p>
          <p className="mt-2 flex items-center gap-x-2 text-xs text-text-muted min-w-0">
            <span className="truncate">Por {post.autor}</span>
            <span className="text-text-faint" aria-hidden="true">·</span>
            <span className="shrink-0">{timeAgo(post.created_at)}</span>
            <span className="text-text-faint" aria-hidden="true">·</span>
            <span className="flex items-center gap-1 shrink-0" style={{ color: post.resuelto ? undefined : tinta('#60a5fa') }}>
              <MessageCircle size={12} aria-hidden="true" />
              {respuestas} {respuestas === 1 ? 'respuesta' : 'respuestas'}
            </span>
          </p>
        </div>
        <ChevronRight size={15} className="shrink-0 mt-2.5 text-text-faint transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </li>
  )
}

function Esqueleto() {
  return (
    <ul className={cn(SUPERFICIE, 'divide-y divide-ov/[0.06] overflow-hidden')} aria-busy="true" aria-label="Cargando preguntas">
      {[1, 2, 3, 4].map(i => (
        <li key={i} className="flex gap-3 px-4 py-4">
          <SkeletonBox className="h-9 w-9 shrink-0 rounded-[10px]" />
          <div className="flex-1 flex flex-col gap-2.5">
            <SkeletonBox className="h-4 w-24 rounded-full" />
            <SkeletonBox className="h-4 w-3/5" />
            <SkeletonBox className="h-3 w-4/5" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Vacio({ titulo, mensaje, accion }: { titulo: string; mensaje: string; accion?: React.ReactNode }) {
  return (
    <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-3 text-center px-6 py-14')}>
      <span className="w-14 h-14 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
        <HelpCircle size={26} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-bold text-lg text-text-primary">{titulo}</p>
        <p className="text-sm leading-relaxed max-w-xs text-text-muted">{mensaje}</p>
      </div>
      {accion}
    </div>
  )
}

export default function ForoView(p: ForoViewProps) {
  const { navidad } = useTheme()
  const sinResolver = p.posts.filter(x => !x.resuelto).length
  const hayFiltros = p.filtroMateria !== 'todos' || p.soloSinResolver

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[860px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">
        <header className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary">Foro de dudas</h1>
              {navidad && <Copo size={18} className="text-gold-light" />}
            </div>
            <div className="mt-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-xs text-text-muted">
              {p.loading ? (
                <span>Pregunta, responde y ayúdate entre compañeros</span>
              ) : (
                <>
                  <span><b className="font-bold text-text-primary tabular-nums">{p.posts.length}</b> preguntas</span>
                  <span><b className="font-bold text-text-primary tabular-nums">{sinResolver}</b> sin resolver</span>
                  <span className="hidden sm:inline">Pregunta, responde y ayúdate entre compañeros</span>
                </>
              )}
            </div>
          </div>
          <Button onClick={p.onNueva} icon={<Plus size={16} aria-hidden="true" />} className={cn('shrink-0', FOCO)}>
            Preguntar
          </Button>
        </header>

        {!p.loading && !p.error && p.posts.length > 0 && <Filtros {...p} />}

        {p.loading ? (
          <Esqueleto />
        ) : p.error ? (
          <Vacio
            titulo="No se pudo cargar el foro"
            mensaje="Comprueba la conexión e inténtalo de nuevo."
            accion={<Button variant="ghost" onClick={p.onRetry} className="px-5">Reintentar</Button>}
          />
        ) : p.filtered.length === 0 ? (
          <Vacio
            titulo={hayFiltros ? 'Ninguna pregunta coincide' : 'Sin preguntas todavía'}
            mensaje={hayFiltros ? 'Prueba con otra categoría o quita el filtro de sin resolver.' : 'Lanza la primera duda de la comunidad'}
            accion={!hayFiltros && <Button onClick={p.onNueva} icon={<Plus size={16} aria-hidden="true" />} className="mt-1 px-5">Hacer una pregunta</Button>}
          />
        ) : (
          <ul className={cn(SUPERFICIE, 'divide-y divide-ov/[0.06] overflow-hidden')}>
            {p.filtered.map(post => <Fila key={post.id} post={post} onAbrir={p.onAbrir} />)}
          </ul>
        )}
      </div>
    </div>
  )
}
