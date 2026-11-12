import { useMemo } from 'react'
import { BookMarked, FileText, Library, Loader2, Plus, Upload } from 'lucide-react'
import { MATERIAS } from '@topcode/shared'
import type { DocBusqueda, DocColeccion } from '../../hooks/useDocs'
import { materiaLabel } from '../../hooks/useDocs'
import { parseFrontmatter } from '../../lib/markdown'
import { tinta } from '../../lib/tinta'
import { useTheme } from '../../contexts/ThemeContext'
import { Copo } from '../Navidad'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE_PULSABLE, materiaColor, mez } from '../ui/estilos'
import { Seccion } from '../ui/Seccion'
import { CabeceraUt, CarpetaAsignatura, VolverAsignaturas, agruparPorUt } from '../ui/Unidades'
import { AvisoError, Buscador, Vacio } from './Piezas'

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Fragmento de texto plano alrededor de la coincidencia */
function snippet(contenido: string, q: string) {
  const texto = parseFrontmatter(contenido).body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`|[\]!-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const i = texto.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return texto.slice(0, 140)
  const start = Math.max(0, i - 60)
  return (start > 0 ? '…' : '') + texto.slice(start, i + q.length + 80) + '…'
}

export interface BibliotecaViewProps {
  colecciones: DocColeccion[]
  loading: boolean
  error: string | null
  /** Código de la asignatura abierta ('general' incluido); null = lista de asignaturas. */
  asignatura: string | null
  onAsignatura: (codigo: string | null) => void
  query: string
  onQuery: (q: string) => void
  resultados: DocBusqueda[] | null
  buscando: boolean
  onAbrirColeccion: (id: string) => void
  onAbrirPagina: (coleccionId: string, paginaId: string) => void
  onNueva: () => void
  onImportar: () => void
}

export default function BibliotecaView(p: BibliotecaViewProps) {
  const { navidad } = useTheme()
  const enAsignatura = p.asignatura !== null
  const visibles = enAsignatura ? p.colecciones.filter(c => c.materia === p.asignatura) : p.colecciones
  const totalPaginas = visibles.reduce((n, c) => n + (c.paginas ?? 0), 0)

  const asignaturas = useMemo(() => {
    const codigos = ['general', ...MATERIAS.map(m => m.codigo)]
    for (const c of p.colecciones) if (!codigos.includes(c.materia)) codigos.push(c.materia)
    return codigos
      .map(codigo => {
        const cols = p.colecciones.filter(c => c.materia === codigo)
        return {
          codigo,
          total: cols.length,
          uts: new Set(cols.filter(c => c.ut != null).map(c => c.ut)).size,
        }
      })
      // «General» solo si tiene algo; primero las asignaturas con colecciones.
      .filter(a => a.codigo !== 'general' || a.total > 0)
      .sort((x, y) => Number(y.total > 0) - Number(x.total > 0)
        || materiaLabel(x.codigo).localeCompare(materiaLabel(y.codigo), 'es'))
  }, [p.colecciones])

  const porUt = useMemo(
    () => agruparPorUt([...visibles].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true })), c => c.ut),
    [visibles],
  )

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">

        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex flex-col">
            {enAsignatura && <VolverAsignaturas onClick={() => p.onAsignatura(null)} />}
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary truncate">
                {enAsignatura ? materiaLabel(p.asignatura!) : 'Documentación'}
              </h1>
              {navidad && <Copo size={18} className="text-gold-light shrink-0" />}
            </div>
            <div className="mt-2 flex items-center gap-x-3 gap-y-1.5 flex-wrap text-xs text-text-muted">
              {p.loading ? <span>Cargando biblioteca…</span> : (
                <>
                  <span><b className="font-bold text-text-primary tabular-nums">{visibles.length}</b> {visibles.length === 1 ? 'colección' : 'colecciones'}</span>
                  <span><b className="font-bold text-text-primary tabular-nums">{totalPaginas}</b> {totalPaginas === 1 ? 'página' : 'páginas'}</span>
                </>
              )}
            </div>
            {!enAsignatura && <p className="mt-2 text-sm text-text-muted max-w-xl">Notas en Markdown que toda la clase puede leer, editar y ampliar.</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" icon={<Upload size={15} aria-hidden="true" />} onClick={p.onImportar} className={cn('flex items-center justify-center gap-2', FOCO)}>
              Importar .md
            </Button>
            <Button icon={<Plus size={16} aria-hidden="true" />} onClick={p.onNueva} className={cn('flex-1 sm:flex-none', FOCO)}>
              Nueva colección
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-3">
          <Buscador value={p.query} onChange={p.onQuery} etiqueta="Buscar en toda la documentación" placeholder="Buscar en toda la documentación" />
        </div>

        {p.resultados !== null ? (
          <Seccion titulo="Resultados"
            extra={<span className="text-xs font-semibold tabular-nums text-text-muted" role="status">
              {p.buscando ? 'Buscando…' : `${p.resultados.length} ${p.resultados.length === 1 ? 'resultado' : 'resultados'}`}
            </span>}>
            {!p.buscando && p.resultados.length === 0 ? (
              <Vacio compacto Icon={BookMarked} mensaje={`Ninguna página contiene «${p.query.trim()}».`} />
            ) : (
              <div className="flex flex-col gap-2.5">
                {p.resultados.map(r => (
                  <button key={r.id} onClick={() => p.onAbrirPagina(r.coleccion_id, r.id)}
                    className={cn(SUPERFICIE_PULSABLE, 'group text-left px-4 py-3.5 flex flex-col gap-1')}>
                    <span className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Library size={12} aria-hidden="true" />
                      {r.docs_colecciones?.titulo ?? 'Colección'}
                    </span>
                    <span className="font-bold text-text-primary">{r.titulo}</span>
                    <span className="text-sm text-text-muted line-clamp-2">{snippet(r.contenido, p.query.trim())}</span>
                  </button>
                ))}
              </div>
            )}
          </Seccion>
        ) : p.loading ? (
          <div className="flex justify-center py-20" role="status" aria-label="Cargando">
            <Loader2 size={24} className="motion-safe:animate-spin text-primary-light" />
          </div>
        ) : p.error ? (
          <AvisoError>No se pudo cargar la documentación. {p.error}</AvisoError>
        ) : !enAsignatura ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {asignaturas.map(a => (
              <CarpetaAsignatura key={a.codigo} nombre={materiaLabel(a.codigo)} colorKey={a.codigo} total={a.total} uts={a.uts}
                unidad={['colección', 'colecciones']} onClick={() => p.onAsignatura(a.codigo)} />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <Vacio
            Icon={BookMarked}
            titulo="Todavía no hay documentación de esta asignatura"
            mensaje="Importa tus notas en Markdown (también carpetas de Obsidian) o crea una colección desde cero: se guardará en esta asignatura."
            accion={<Button icon={<Upload size={15} aria-hidden="true" />} onClick={p.onImportar} className="mt-1 px-5">Importar .md</Button>}
          />
        ) : (
          <div className="flex flex-col gap-7">
            {porUt.map(([ut, cols]) => (
              <CabeceraUt key={ut ?? 'sin'} ut={ut} cuenta={cols.length}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cols.map(c => <TarjetaColeccion key={c.id} c={c} onClick={() => p.onAbrirColeccion(c.id)} />)}
                </div>
              </CabeceraUt>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TarjetaColeccion({ c, onClick }: { c: DocColeccion; onClick: () => void }) {
  const color = materiaColor(c.materia)
  const n = c.paginas ?? 0
  return (
    <button onClick={onClick} className={cn(SUPERFICIE_PULSABLE, 'group text-left flex flex-col gap-4 p-4')}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: mez(color, 16), color: tinta(color) }}>
          <BookMarked size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="text-2xs font-bold uppercase tracking-wider truncate" style={{ color: tinta(color) }}>{materiaLabel(c.materia)}</span>
          <h3 className="font-bold leading-snug text-text-primary line-clamp-2">{c.titulo}</h3>
        </div>
      </div>
      {c.descripcion && <p className="text-sm text-text-muted line-clamp-2 -mt-1">{c.descripcion}</p>}
      <div className="mt-auto pt-3 border-t border-ov/[0.07] flex items-center justify-between gap-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5 shrink-0 font-semibold text-text-secondary">
          <FileText size={12} aria-hidden="true" />
          {n} {n === 1 ? 'página' : 'páginas'}
        </span>
        <span className="truncate text-right">{c.autor || 'Anónimo'} · {formatFecha(c.updated_at)}</span>
      </div>
    </button>
  )
}

