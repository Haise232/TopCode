import { Hash, Search, Users } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { Copo } from '../Navidad'
import { SkeletonBox } from '../Skeleton'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import { Avatar } from './Avatar'
import type { UsuarioLista } from './tipos'

const ETIQUETA = 'text-xs font-bold uppercase tracking-wider text-text-secondary'

const FILA = 'w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-xl transition-colors'
const FILA_ACTIVA = 'bg-teal/[0.12]'
const FILA_INACTIVA = 'hover:bg-ov/[0.05]'

/** Panel izquierdo (pantalla de conversaciones en móvil): título, canal y mensajes directos. */
export function PanelConversaciones({
  className, generalActivo, onGeneral, children,
}: {
  className?: string
  generalActivo: boolean
  onGeneral: () => void
  children: React.ReactNode
}) {
  const { navidad } = useTheme()
  return (
    <aside className={cn('flex-col shrink-0 min-h-0 bg-surface w-full md:w-[320px] md:border-r border-ov/[0.07]', className)}>
      <div className="px-4 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="font-extrabold text-3xl tracking-tight text-text-primary">Chat</h1>
          {navidad && <Copo size={16} className="text-gold-light" />}
        </div>
        <p className="mt-1.5 text-xs text-text-muted">Canal de la clase y mensajes directos</p>
      </div>

      <div className="px-2 shrink-0">
        <p className={cn(ETIQUETA, 'px-2 pb-1.5')}>Canales</p>
        <button
          type="button"
          onClick={onGeneral}
          aria-current={generalActivo ? 'true' : undefined}
          className={cn(FILA, FOCO, generalActivo ? FILA_ACTIVA : FILA_INACTIVA)}
        >
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary/10 text-primary-light">
            <Hash size={18} aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-text-primary">General</span>
            <span className="block text-xs text-text-muted truncate">Todos los alumnos</span>
          </span>
        </button>
      </div>

      {children}
    </aside>
  )
}

export interface ListaUsuariosProps {
  usuarios: UsuarioLista[]
  loading: boolean
  error: boolean
  query: string
  onQuery: (v: string) => void
  selectedId?: string | null
  onSelect: (u: UsuarioLista) => void
}

export function ListaUsuarios(p: ListaUsuariosProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 mt-4">
      <div className="px-4 shrink-0 flex items-baseline justify-between">
        <p className={ETIQUETA}>Mensajes directos</p>
        {!p.loading && !p.error && (
          <span className="text-xs text-text-muted">{p.usuarios.length} usuario{p.usuarios.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="px-3 pt-2 pb-2 shrink-0">
        <label className="flex items-center gap-2 h-10 px-3 rounded-xl bg-input border border-ov/[0.1] text-text-muted focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-[border-color,box-shadow]">
          <Search size={15} aria-hidden="true" className="shrink-0" />
          <input
            value={p.query}
            onChange={e => p.onQuery(e.target.value)}
            placeholder="Buscar usuario..."
            aria-label="Buscar usuario"
            className="flex-1 min-w-0 bg-transparent text-base md:text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {p.loading ? (
          <div role="status" aria-label="Cargando usuarios" className="flex flex-col gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <SkeletonBox className="w-10 h-10 rounded-full shrink-0" />
                <SkeletonBox className="h-3.5 w-32" />
              </div>
            ))}
          </div>
        ) : p.error ? (
          <p className="px-4 py-10 text-center text-sm text-rose-600 dark:text-rose-300">No se pudieron cargar los usuarios.</p>
        ) : p.usuarios.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
            <span className="w-11 h-11 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
              <Users size={20} aria-hidden="true" />
            </span>
            <p className="text-sm text-text-muted">{p.query ? 'Sin resultados' : 'No hay otros usuarios'}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {p.usuarios.map(u => {
              const activo = u.id === p.selectedId
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => p.onSelect(u)}
                    aria-current={activo ? 'true' : undefined}
                    className={cn(FILA, FOCO, activo ? FILA_ACTIVA : FILA_INACTIVA)}
                  >
                    <Avatar nombre={u.nombre} url={u.avatar_url} size={40} />
                    <span className="flex-1 min-w-0 truncate text-sm font-semibold text-text-primary">{u.nombre}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
