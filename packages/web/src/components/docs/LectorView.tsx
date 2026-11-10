import { useEffect, useState, type RefObject } from 'react'
import {
  ArrowLeft, ArrowRight, BookMarked, ChevronDown, Download, Eye, FileText, History,
  Loader2, Menu, MoreHorizontal, Pencil, Plus, Save, Search, Settings2, Trash2, Upload, X,
} from 'lucide-react'
import { materiaLabel, type DocColeccion, type DocPagina, type DocPaginaResumen } from '../../hooks/useDocs'
import { tinta } from '../../lib/tinta'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE, SUPERFICIE_PULSABLE, materiaColor, mez } from '../ui/estilos'
import MarkdownView from './MarkdownView'
import { INPUT, ItemMenu, PanelMenu, Vacio } from './Piezas'
import { formatFechaHora } from './fecha'

export interface LectorViewProps {
  coleccion: DocColeccion
  paginas: DocPaginaResumen[]
  paginaId?: string
  pagina: DocPagina | null
  /** Carga de la colección (índice) y de la página activa. */
  loading: boolean
  paginaLoading: boolean
  mainRef: RefObject<HTMLDivElement>

  puedeGestionarColeccion: boolean
  puedeGestionarPagina: boolean
  descargandoZip: boolean

  // Índice
  indiceAbierto: boolean
  onIndiceAbierto: (abierto: boolean) => void
  filtroPaginas: string
  onFiltroPaginas: (q: string) => void

  // Edición
  editing: boolean
  draft: { titulo: string; contenido: string }
  onDraft: (d: { titulo: string; contenido: string }) => void
  preview: boolean
  onPreview: (p: boolean) => void
  saving: boolean
  dirty: boolean
  onGuardar: () => void
  onCancelarEdicion: () => void
  onEditorKeys: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onEmpezarEdicion: () => void

  // Acciones
  onVolver: () => void
  onAbrirPagina: (id: string, heading?: string | null) => void
  onNuevaPagina: (titulo?: string) => void
  onImportar: () => void
  onEditarColeccion: () => void
  onBorrarColeccion: () => void
  onDescargarColeccion: () => void
  onHistorial: () => void
  onDescargarPagina: () => void
  onBorrarPagina: () => void
}

/** Botón cuadrado de icono con la forma de los de Calendario. */
const BOTON_ICONO = cn('w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-text-secondary bg-ov/[0.04] hover:bg-ov/[0.08] transition-colors', FOCO)

export default function LectorView(p: LectorViewProps) {
  const { coleccion, paginas, pagina } = p
  const [menuPagina, setMenuPagina] = useState(false)
  const [menuColeccion, setMenuColeccion] = useState(false)
  const color = materiaColor(coleccion.materia)

  const indiceActual = paginas.findIndex(x => x.id === p.paginaId)
  const anterior = indiceActual > 0 ? paginas[indiceActual - 1] : null
  const siguiente = indiceActual >= 0 && indiceActual < paginas.length - 1 ? paginas[indiceActual + 1] : null
  const tituloActual = pagina?.titulo ?? paginas[indiceActual]?.titulo ?? 'Páginas'

  const filtradas = (() => {
    const q = p.filtroPaginas.trim().toLowerCase()
    return q ? paginas.filter(x => x.titulo.toLowerCase().includes(q)) : paginas
  })()

  // Escape cierra el índice desplegable en móvil
  const { indiceAbierto, onIndiceAbierto } = p
  useEffect(() => {
    if (!indiceAbierto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onIndiceAbierto(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [indiceAbierto, onIndiceAbierto])

  const indice = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 flex flex-col gap-2.5 border-b border-ov/[0.07]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" aria-hidden="true" />
          <input
            value={p.filtroPaginas} onChange={e => p.onFiltroPaginas(e.target.value)}
            placeholder="Filtrar páginas" aria-label="Filtrar páginas"
            className={cn(INPUT, 'pl-9 py-2 text-[13px]')}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => p.onNuevaPagina()}
            className={cn('flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold bg-ov/[0.06] text-text-primary hover:bg-ov/[0.1] transition-colors', FOCO)}>
            <Plus size={13} aria-hidden="true" /> Página
          </button>
          <button onClick={p.onImportar}
            className={cn('flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold bg-ov/[0.06] text-text-primary hover:bg-ov/[0.1] transition-colors', FOCO)}>
            <Upload size={13} aria-hidden="true" /> Importar
          </button>
        </div>
      </div>
      <nav aria-label="Páginas de la colección" className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        <p className="px-2.5 pt-1.5 pb-1 text-2xs font-bold uppercase tracking-wider text-text-muted">
          Páginas · <span className="tabular-nums">{paginas.length}</span>
        </p>
        {filtradas.map(x => {
          const activa = x.id === p.paginaId
          const n = paginas.indexOf(x) + 1
          return (
            <button
              key={x.id} onClick={() => p.onAbrirPagina(x.id)} aria-current={activa ? 'page' : undefined}
              className={cn(
                'relative flex items-baseline gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] leading-snug transition-colors', FOCO,
                activa ? 'bg-ov/[0.08] text-text-primary font-semibold' : 'text-text-secondary hover:bg-ov/[0.05] hover:text-text-primary',
              )}
            >
              {activa && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-primary" aria-hidden="true" />}
              <span className="w-5 shrink-0 text-right text-2xs font-semibold tabular-nums text-text-faint">{n}</span>
              <span className="break-words min-w-0">{x.titulo}</span>
            </button>
          )
        })}
        {paginas.length > 0 && filtradas.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-text-muted">Sin coincidencias</p>
        )}
        {paginas.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-text-muted">Aún no hay páginas</p>
        )}
      </nav>
    </div>
  )

  return (
    <div className="motion-safe:animate-fade-in h-full flex flex-col min-h-0">
      {/* ── Cabecera de la colección ─────────────────────────────────────── */}
      <header className="px-4 md:px-6 py-3 border-b border-ov/[0.08] flex items-center gap-3 shrink-0">
        <button onClick={p.onVolver} aria-label="Volver a la biblioteca" className={BOTON_ICONO}>
          <ArrowLeft size={17} aria-hidden="true" />
        </button>
        {p.editing && (
          <button onClick={() => p.onIndiceAbierto(true)} aria-label="Páginas" aria-haspopup="dialog" className={cn(BOTON_ICONO, 'md:hidden')}>
            <Menu size={17} aria-hidden="true" />
          </button>
        )}
        <span className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center shrink-0" style={{ background: mez(color, 16), color: tinta(color) }}>
          <BookMarked size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-extrabold text-lg md:text-xl leading-tight tracking-tight text-text-primary line-clamp-2">{coleccion.titulo}</h1>
          <p className="mt-0.5 text-xs text-text-muted truncate">
            <span className="font-bold" style={{ color: tinta(color) }}>{materiaLabel(coleccion.materia)}</span>
            {' · '}<span className="tabular-nums">{paginas.length}</span> {paginas.length === 1 ? 'página' : 'páginas'}
            {coleccion.descripcion ? <span className="hidden md:inline"> · {coleccion.descripcion}</span> : null}
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuColeccion(o => !o)} disabled={p.descargandoZip}
            aria-label="Opciones de la colección" aria-haspopup="menu" aria-expanded={menuColeccion}
            className={cn('h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-text-secondary bg-ov/[0.04] hover:bg-ov/[0.08] transition-colors disabled:opacity-60 w-10 sm:w-auto sm:px-3.5', FOCO)}
          >
            {p.descargandoZip ? <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" /> : <Settings2 size={15} aria-hidden="true" />}
            <span className="hidden sm:inline">Colección</span>
          </button>
          {menuColeccion && (
            <PanelMenu etiqueta="Opciones de la colección" onClose={() => setMenuColeccion(false)}>
              <ItemMenu Icon={Download} label="Descargar colección (.zip)" onClick={() => { setMenuColeccion(false); p.onDescargarColeccion() }} />
              {p.puedeGestionarColeccion && (
                <>
                  <ItemMenu Icon={Pencil} label="Editar colección" onClick={() => { setMenuColeccion(false); p.onEditarColeccion() }} />
                  <ItemMenu Icon={Trash2} label="Borrar colección" danger onClick={() => { setMenuColeccion(false); p.onBorrarColeccion() }} />
                </>
              )}
            </PanelMenu>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        {/* ── Índice (escritorio) ─────────────────────────────────────────── */}
        <aside className="hidden md:flex w-64 lg:w-72 shrink-0 border-r border-ov/[0.08] bg-surface/60 flex-col min-h-0">
          {indice}
        </aside>

        {/* ── Índice (móvil): panel lateral ───────────────────────────────── */}
        {p.indiceAbierto && (
          <div className="md:hidden absolute inset-0 z-20 flex">
            <div role="dialog" aria-modal="true" aria-label="Páginas de la colección"
              className="w-80 max-w-[88%] bg-surface border-r border-ov/[0.08] shadow-modal flex flex-col min-h-0 motion-safe:animate-fade-in">
              <div className="flex items-center justify-between gap-2 pl-4 pr-2 pt-2">
                <span className="text-sm font-extrabold text-text-primary">Páginas</span>
                <button onClick={() => p.onIndiceAbierto(false)} aria-label="Cerrar índice" className={cn('w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary', FOCO)}>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              {indice}
            </div>
            <div className="flex-1" style={{ background: 'var(--color-modal-backdrop)' }} onClick={() => p.onIndiceAbierto(false)} aria-hidden="true" />
          </div>
        )}

        {/* ── Contenido ───────────────────────────────────────────────────── */}
        <div ref={p.mainRef} className="flex-1 min-w-0 overflow-y-auto">
          {paginas.length === 0 && !p.paginaId ? (
            <div className="px-4 md:px-6 py-10 max-w-xl mx-auto">
              <Vacio
                Icon={FileText} titulo="La colección está vacía"
                mensaje="Crea la primera página o importa archivos .md."
                accion={
                  <div className="flex gap-2 mt-1">
                    <Button variant="ghost" icon={<Upload size={15} aria-hidden="true" />} onClick={p.onImportar} className="flex items-center justify-center gap-2">Importar</Button>
                    <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => p.onNuevaPagina()}>Nueva página</Button>
                  </div>
                }
              />
            </div>
          ) : p.paginaLoading || (!pagina && !!p.paginaId && p.loading) ? (
            <div className="flex justify-center py-24" role="status" aria-label="Cargando página">
              <Loader2 size={24} className="motion-safe:animate-spin text-primary-light" />
            </div>
          ) : !pagina ? (
            <div className="px-4 md:px-6 py-10 max-w-xl mx-auto">
              <Vacio Icon={FileText} titulo="Esta página no existe" mensaje="Puede que alguien la haya borrado." compacto />
            </div>
          ) : p.editing ? (
            <div className="h-full flex flex-col min-h-0">
              <div className="px-4 md:px-6 py-3 border-b border-ov/[0.07] flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[12rem]">
                  <input
                    value={p.draft.titulo} maxLength={200} aria-label="Título de la página"
                    onChange={e => p.onDraft({ ...p.draft, titulo: e.target.value })}
                    className={cn(INPUT, 'font-semibold')}
                  />
                </div>
                <div role="group" aria-label="Editor o vista previa"
                  className="lg:hidden grid grid-cols-2 gap-0.5 p-0.5 rounded-xl bg-ov/[0.06] border border-ov/[0.08]">
                  {([['editar', 'Editar', Pencil], ['vista', 'Vista previa', Eye]] as const).map(([id, label, Icon]) => {
                    const active = (id === 'vista') === p.preview
                    return (
                      <button key={id} onClick={() => p.onPreview(id === 'vista')} aria-pressed={active}
                        className={cn('flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-semibold transition-colors', FOCO,
                          active ? 'bg-surface text-text-primary shadow-card' : 'text-text-muted hover:text-text-secondary')}>
                        <Icon size={13} aria-hidden="true" />{label}
                      </button>
                    )
                  })}
                </div>
                <Button variant="ghost" onClick={p.onCancelarEdicion}>Cancelar</Button>
                <Button loading={p.saving} icon={<Save size={15} aria-hidden="true" />} onClick={p.onGuardar} disabled={!p.dirty}>
                  Guardar
                </Button>
              </div>
              <div className="flex-1 min-h-0 grid lg:grid-cols-2">
                <textarea
                  value={p.draft.contenido}
                  onChange={e => p.onDraft({ ...p.draft, contenido: e.target.value })}
                  onKeyDown={p.onEditorKeys}
                  spellCheck={false} aria-label="Contenido en Markdown"
                  placeholder="Escribe en Markdown… Usa [[Otra página]] para enlazar páginas de esta colección."
                  className={cn(
                    'min-h-[60vh] lg:min-h-0 h-full w-full resize-none bg-input px-4 md:px-6 py-4 font-mono text-[13px] leading-relaxed text-text-primary outline-none lg:border-r border-ov/[0.07] focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--c-primary)/0.35)]',
                    p.preview && 'hidden lg:block',
                  )}
                />
                <div className={cn('overflow-y-auto px-4 md:px-8 py-6', !p.preview && 'hidden lg:block')}>
                  <MarkdownView content={p.draft.contenido} pages={paginas} onOpenPage={p.onAbrirPagina} onMissingPage={p.onNuevaPagina} />
                </div>
              </div>
              <p className="px-4 md:px-6 py-2 text-xs text-text-muted border-t border-ov/[0.07]">
                Markdown + GFM · callouts <code>&gt; [!tip]</code> · enlaces <code>[[Página]]</code> · Ctrl+S para guardar
              </p>
            </div>
          ) : (
            <article className="max-w-[48rem] mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-12">
              {/* Índice plegado (móvil) */}
              <button
                onClick={() => p.onIndiceAbierto(true)} aria-haspopup="dialog"
                className={cn(SUPERFICIE, 'md:hidden w-full flex items-center justify-between gap-3 px-4 py-3 mb-5 text-left', FOCO)}
              >
                <span className="min-w-0">
                  <span className="block text-2xs font-bold uppercase tracking-wider text-text-muted">
                    Página <span className="tabular-nums">{indiceActual + 1}</span> de <span className="tabular-nums">{paginas.length}</span>
                  </span>
                  <span className="block text-sm font-semibold text-text-primary truncate">{tituloActual}</span>
                </span>
                <ChevronDown size={16} className="shrink-0 text-text-muted" aria-hidden="true" />
              </button>

              {/* Cabecera del documento */}
              <div className="mb-6 flex items-start justify-between gap-3 pb-4 border-b border-ov/[0.08]">
                <div className="min-w-0">
                  {indiceActual >= 0 && (
                    <p className="hidden md:block text-2xs font-bold uppercase tracking-wider text-text-muted">
                      Página <span className="tabular-nums">{indiceActual + 1}</span> de <span className="tabular-nums">{paginas.length}</span>
                    </p>
                  )}
                  <p className="md:mt-1 text-xs text-text-muted">
                    {pagina.updated_by_nombre ? <>Editado por <span className="font-semibold text-text-secondary">{pagina.updated_by_nombre}</span> · </> : null}
                    {formatFechaHora(pagina.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 relative">
                  <Button variant="ghost" icon={<Pencil size={14} aria-hidden="true" />} onClick={p.onEmpezarEdicion} className={cn('flex items-center justify-center gap-2 h-10 py-0', FOCO)}>
                    Editar
                  </Button>
                  <button onClick={() => setMenuPagina(o => !o)} aria-label="Más opciones" aria-haspopup="menu" aria-expanded={menuPagina} className={BOTON_ICONO}>
                    <MoreHorizontal size={17} aria-hidden="true" />
                  </button>
                  {menuPagina && (
                    <PanelMenu etiqueta="Opciones de la página" onClose={() => setMenuPagina(false)}>
                      <ItemMenu Icon={History} label="Historial de cambios" onClick={() => { setMenuPagina(false); p.onHistorial() }} />
                      <ItemMenu Icon={Download} label="Descargar página (.md)" onClick={() => { setMenuPagina(false); p.onDescargarPagina() }} />
                      {p.puedeGestionarPagina && (
                        <ItemMenu Icon={Trash2} label="Borrar página" danger onClick={() => { setMenuPagina(false); p.onBorrarPagina() }} />
                      )}
                    </PanelMenu>
                  )}
                </div>
              </div>

              <MarkdownView content={pagina.contenido} pages={paginas} onOpenPage={p.onAbrirPagina} onMissingPage={p.onNuevaPagina} />

              {/* Navegación entre páginas */}
              {(anterior || siguiente) && (
                <nav aria-label="Navegación entre páginas" className="mt-12 pt-6 border-t border-ov/[0.08] grid gap-3 sm:grid-cols-2">
                  {anterior ? (
                    <button onClick={() => p.onAbrirPagina(anterior.id)} className={cn(SUPERFICIE_PULSABLE, 'text-left px-4 py-3 flex items-center gap-3')}>
                      <ArrowLeft size={16} className="shrink-0 text-text-muted" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-2xs font-bold uppercase tracking-wider text-text-muted">Anterior</span>
                        <span className="block text-sm font-semibold text-text-primary truncate">{anterior.titulo}</span>
                      </span>
                    </button>
                  ) : <span className="hidden sm:block" />}
                  {siguiente ? (
                    <button onClick={() => p.onAbrirPagina(siguiente.id)} className={cn(SUPERFICIE_PULSABLE, 'text-right px-4 py-3 flex items-center justify-end gap-3')}>
                      <span className="min-w-0">
                        <span className="block text-2xs font-bold uppercase tracking-wider text-text-muted">Siguiente</span>
                        <span className="block text-sm font-semibold text-text-primary truncate">{siguiente.titulo}</span>
                      </span>
                      <ArrowRight size={16} className="shrink-0 text-text-muted" aria-hidden="true" />
                    </button>
                  ) : null}
                </nav>
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  )
}

