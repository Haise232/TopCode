import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookMarked, FileText, Library, Loader2, Plus, Search, Upload } from 'lucide-react'
import { MATERIAS } from '@topcode/shared'
import { useAuth } from '../hooks/useAuth'
import { markDocsVisited } from '../hooks/useUnreadCounts'
import { useDocColecciones, createColeccion, buscarDocs, materiaLabel, type DocBusqueda, type ColeccionInput } from '../hooks/useDocs'
import ColeccionModal from '../components/docs/ColeccionModal'
import ImportModal from '../components/docs/ImportModal'
import { Button } from '../components/ui'
import { parseFrontmatter } from '../lib/markdown'

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

export default function Docs() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { colecciones, loading, error } = useDocColecciones()
  const [filtro, setFiltro] = useState('todos')
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<DocBusqueda[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    if (usuario) markDocsVisited(usuario.id)
  }, [usuario])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResultados(null); return }
    let cancelled = false
    setBuscando(true)
    const id = setTimeout(async () => {
      const { resultados: r } = await buscarDocs(q)
      if (cancelled) return
      setResultados(r)
      setBuscando(false)
    }, 300)
    return () => { cancelled = true; clearTimeout(id) }
  }, [query])

  const materiasUsadas = useMemo(() => {
    const set = new Set(colecciones.map(c => c.materia))
    return [
      { codigo: 'todos', nombreCorto: 'Todas' },
      ...(set.has('general') ? [{ codigo: 'general', nombreCorto: 'General' }] : []),
      ...MATERIAS.filter(m => set.has(m.codigo)),
    ]
  }, [colecciones])

  const filtradas = filtro === 'todos' ? colecciones : colecciones.filter(c => c.materia === filtro)

  async function handleCrear(input: ColeccionInput) {
    const { id, error: e } = await createColeccion(input)
    if (e || !id) return e ?? 'No se pudo crear la colección.'
    setShowNueva(false)
    navigate(`/docs/${id}`)
    return null
  }

  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      <div className="px-4 md:px-6 py-5 border-b border-white/[0.08] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-xl tracking-tight text-text-primary">Documentación</h1>
          <p className="text-xs text-text-muted mt-0.5">Biblioteca de documentación en Markdown que toda la clase puede leer, editar y ampliar</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" size="sm" icon={<Upload size={14} />} onClick={() => setShowImport(true)}>
            Importar .md
          </Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNueva(true)}>
            Nueva colección
          </Button>
        </div>
      </div>

      <div className="px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3 border-b border-white/[0.06]">
        <div className="relative w-full md:w-80 shrink-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar en toda la documentación"
            className="w-full rounded-xl border border-white/[0.1] bg-surface px-9 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary/50"
          />
        </div>
        {resultados === null && materiasUsadas.length > 2 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {materiasUsadas.map(m => {
              const active = filtro === m.codigo
              return (
                <button
                  key={m.codigo}
                  onClick={() => setFiltro(m.codigo)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 border transition-all duration-150 ${
                    active ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-white/[0.03] border-transparent text-text-muted'
                  }`}
                >
                  {m.nombreCorto}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="p-4 md:p-6">
        {resultados !== null ? (
          <section className="flex flex-col gap-2 max-w-3xl">
            <p className="text-xs text-text-muted mb-1">
              {buscando ? 'Buscando…' : `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}`}
            </p>
            {resultados.map(r => (
              <button
                key={r.id}
                onClick={() => navigate(`/docs/${r.coleccion_id}/${r.id}`)}
                className="group text-left rounded-xl border border-white/[0.08] bg-surface px-4 py-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <Library size={11} />
                  {r.docs_colecciones?.titulo ?? 'Colección'}
                </div>
                <h3 className="mt-1 font-semibold text-sm text-text-primary group-hover:text-primary-light">{r.titulo}</h3>
                <p className="mt-1 text-xs text-text-muted line-clamp-2">{snippet(r.contenido, query.trim())}</p>
              </button>
            ))}
          </section>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary-light" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">
            No se pudo cargar la documentación. {error}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/10">
              <BookMarked size={22} className="text-primary" />
            </div>
            <p className="font-semibold text-text-secondary">Todavía no hay documentación</p>
            <p className="text-sm text-text-muted max-w-sm">Importa tus notas en Markdown (también carpetas de Obsidian) o crea una colección desde cero.</p>
            <Button size="sm" icon={<Upload size={14} />} onClick={() => setShowImport(true)} className="mt-2">
              Importar .md
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtradas.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/docs/${c.id}`)}
                className="group text-left flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-surface to-bg transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{materiaLabel(c.materia)}</span>
                  <span className="flex items-center gap-1 text-[11px] text-text-muted">
                    <FileText size={11} />
                    {c.paginas} {c.paginas === 1 ? 'página' : 'páginas'}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                    <BookMarked size={16} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-text-primary line-clamp-2 group-hover:text-primary-light">{c.titulo}</h3>
                    {c.descripcion && <p className="mt-1 text-xs text-text-muted line-clamp-2">{c.descripcion}</p>}
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-text-muted">
                  <span className="truncate">{c.autor || 'Anónimo'}</span>
                  <span className="shrink-0">Act. {formatFecha(c.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <ColeccionModal
        open={showNueva}
        title="Nueva colección"
        submitLabel="Crear"
        onClose={() => setShowNueva(false)}
        onSubmit={handleCrear}
      />
      <ImportModal
        open={showImport}
        colecciones={colecciones}
        onClose={() => setShowImport(false)}
        onDone={id => { setShowImport(false); navigate(`/docs/${id}`) }}
      />
    </div>
  )
}
