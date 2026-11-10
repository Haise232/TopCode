import { useState, type ReactNode } from 'react'
import { RefreshCw, Search, UserSearch, Users } from 'lucide-react'
import { claseInfo, type Usuario } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { tinta } from '../../lib/tinta'
import { Copo } from '../Navidad'
import { cn } from '../ui/cn'
import { Seccion } from '../ui/Seccion'
import { FOCO, SUPERFICIE } from '../ui/estilos'
import Anuncios, { type AnunciosProps } from './Anuncios'
import FilaUsuario, { type AccionesUsuario } from './FilaUsuario'

export interface AdminViewProps extends AccionesUsuario {
  /** Usuarios que este admin puede ver (el master, todos; el admin de clase, su clase). */
  usuarios: Usuario[]
  claseAdmin: string | null | undefined
  refreshing: boolean
  onRefresh: () => void
  anuncios: AnunciosProps
  horario: ReactNode
}

type FiltroRol = 'todos' | 'alumno' | 'admin'

function Dato({ etiqueta, valor, resaltado }: { etiqueta: string; valor: number; resaltado?: boolean }) {
  return (
    <div className={cn(SUPERFICIE, 'px-4 py-3.5 min-w-0', resaltado && 'border-amber-500/30 bg-amber-400/[0.07]')}>
      <p className={cn('text-2xs font-bold uppercase tracking-wider truncate', resaltado ? 'text-amber-700 dark:text-amber-300' : 'text-text-muted')}>{etiqueta}</p>
      <p className={cn('mt-1 text-3xl font-black tabular-nums leading-none', resaltado ? 'text-amber-700 dark:text-amber-300' : 'text-text-primary')}>{valor}</p>
    </div>
  )
}

export default function AdminView(p: AdminViewProps) {
  const { navidad } = useTheme()
  const [verRechazados, setVerRechazados] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState<FiltroRol>('todos')

  const activos = p.usuarios.filter(u => u.estado_acceso !== 'rechazado')
  const rechazados = p.usuarios.filter(u => u.estado_acceso === 'rechazado')
  const pendientes = p.usuarios.filter(u => u.estado_acceso === 'pendiente')
  const admins = activos.filter(u => u.rol === 'admin')
  const alumnos = activos.filter(u => u.rol === 'alumno')

  const q = busqueda.trim().toLowerCase()
  const lista = (verRechazados ? [...activos, ...rechazados] : activos)
    .filter(u => u.estado_acceso !== 'pendiente')
    .filter(u => filtroRol === 'todos' || u.rol === filtroRol)
    .filter(u => !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  const hayFiltro = q !== '' || filtroRol !== 'todos'
  const clase = claseInfo(p.claseAdmin)

  const filtros: { valor: FiltroRol; etiqueta: string; n: number }[] = [
    { valor: 'todos', etiqueta: 'Todos', n: activos.length - pendientes.length },
    { valor: 'alumno', etiqueta: 'Alumnos', n: alumnos.filter(u => u.estado_acceso !== 'pendiente').length },
    { valor: 'admin', etiqueta: 'Admins', n: admins.filter(u => u.estado_acceso !== 'pendiente').length },
  ]

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">

        {/* ── Cabecera ── */}
        <header className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary">Panel Admin</h1>
              {navidad && <Copo size={18} className="text-gold-light" />}
            </div>
            <div className="mt-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-xs text-text-muted">
              <span>Control de accesos y roles</span>
              {!p.esSuperadmin && p.claseAdmin && (
                <span className="inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-full text-2xs tracking-wide"
                  style={{ background: clase?.bg, color: tinta(clase?.color ?? 'currentColor') }}>
                  <Users size={10} aria-hidden="true" />{p.claseAdmin}
                </span>
              )}
            </div>
          </div>
          <button onClick={p.onRefresh} disabled={p.refreshing} aria-label="Actualizar"
            className={cn('w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-colors hover:bg-ov/5 bg-ov/[0.03] text-text-secondary', FOCO)}>
            <RefreshCw size={15} className={p.refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </header>

        {/* ── Resumen ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Dato etiqueta="Solicitudes" valor={pendientes.length} resaltado={pendientes.length > 0} />
          <Dato etiqueta="Alumnos" valor={alumnos.length} />
          <Dato etiqueta="Admins" valor={admins.length} />
          <Dato etiqueta="Total" valor={activos.length} />
        </div>

        <div className="grid gap-8 lg:gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7 min-w-0 flex flex-col gap-8">

            {/* ── Solicitudes pendientes, lo primero ── */}
            {pendientes.length > 0 && (
              <Seccion titulo="Solicitudes de acceso" subtitulo="Estas personas esperan que las aceptes"
                extra={<span className="text-xs font-semibold tabular-nums text-text-muted">{pendientes.length}</span>}>
                <ul className={cn(SUPERFICIE, 'overflow-hidden divide-y divide-ov/[0.07] border-amber-500/25')}>
                  {pendientes.map(u => <FilaUsuario key={u.id} u={u} a={p} />)}
                </ul>
              </Seccion>
            )}

            {/* ── Usuarios ── */}
            <Seccion titulo="Usuarios"
              extra={
                <>
                  <span className="text-xs font-semibold tabular-nums text-text-muted">{lista.length}</span>
                  {rechazados.length > 0 && (
                    <button onClick={() => setVerRechazados(v => !v)} aria-pressed={verRechazados}
                      className={cn('rounded-md text-xs font-semibold text-primary-light hover:underline underline-offset-4', FOCO)}>
                      {verRechazados ? 'Ocultar rechazados' : `Ver rechazados (${rechazados.length})`}
                    </button>
                  )}
                </>
              }>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 min-w-0">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
                  <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    aria-label="Buscar usuario" placeholder="Buscar por nombre o email"
                    className="bg-input border border-ov/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted w-full outline-none transition-[border-color,box-shadow] focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]" />
                </div>
                <div role="radiogroup" aria-label="Filtrar por rol"
                  className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-ov/[0.06] border border-ov/[0.08] self-start sm:self-auto">
                  {filtros.map(f => (
                    <button key={f.valor} role="radio" aria-checked={filtroRol === f.valor} onClick={() => setFiltroRol(f.valor)}
                      className={cn('px-3 py-2 rounded-[10px] text-xs font-semibold transition-colors', FOCO,
                        filtroRol === f.valor ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-secondary')}>
                      {f.etiqueta} <span className="tabular-nums text-text-faint">{f.n}</span>
                    </button>
                  ))}
                </div>
              </div>

              {lista.length === 0 ? (
                <div className={cn(SUPERFICIE, 'flex flex-col items-center gap-3 text-center px-6 py-10')}>
                  <span className="w-11 h-11 flex items-center justify-center rounded-full bg-gold/15 text-gold-light">
                    <UserSearch size={20} aria-hidden="true" />
                  </span>
                  <p className="text-sm text-text-muted">{hayFiltro ? 'Ningún usuario coincide con la búsqueda.' : 'Todavía no hay usuarios aprobados.'}</p>
                  {hayFiltro && (
                    <button onClick={() => { setBusqueda(''); setFiltroRol('todos') }}
                      className={cn('rounded-md text-xs font-semibold text-primary-light hover:underline underline-offset-4', FOCO)}>
                      Limpiar filtros
                    </button>
                  )}
                </div>
              ) : (
                <ul className={cn(SUPERFICIE, 'overflow-hidden divide-y divide-ov/[0.07]')}>
                  {lista.map(u => <FilaUsuario key={u.id} u={u} a={p} />)}
                </ul>
              )}
            </Seccion>
          </div>

          <div className="lg:col-span-5 min-w-0 flex flex-col gap-8">
            {p.esSuperadmin && <Anuncios {...p.anuncios} />}
            {p.horario}
          </div>
        </div>
      </div>
    </div>
  )
}
