import { useEffect, useRef, useState } from 'react'
import { FileText, FolderUp, Upload, X } from 'lucide-react'
import { Modal, Button, Input } from '../ui'
import { MateriaSelect } from './ColeccionModal'
import { createColeccion, importarPaginas, SELECT_CLASS, type DocColeccion } from '../../hooks/useDocs'

const MAX_CHARS = 200_000

interface ArchivoMd {
  titulo: string
  contenido: string
}

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onDone: (coleccionId: string) => void
  /** Colecciones existentes a las que se puede añadir */
  colecciones?: DocColeccion[]
  /** Si se indica, se importa directamente en esta colección */
  coleccionFija?: DocColeccion
}

async function leerArchivos(files: FileList): Promise<{ archivos: ArchivoMd[]; omitidos: string[]; carpeta: string | null }> {
  const archivos: ArchivoMd[] = []
  const omitidos: string[] = []
  const usados = new Set<string>()
  let carpeta: string | null = null

  for (const file of Array.from(files)) {
    const ruta = file.webkitRelativePath || file.name
    if (!carpeta && file.webkitRelativePath) carpeta = file.webkitRelativePath.split('/')[0]

    // Ignora la configuración de Obsidian y archivos ocultos
    if (ruta.split('/').some(parte => parte.startsWith('.'))) continue
    if (!/\.(md|markdown)$/i.test(file.name)) { omitidos.push(`${file.name} (no es Markdown)`); continue }

    const contenido = await file.text()
    if (contenido.length > MAX_CHARS) { omitidos.push(`${file.name} (demasiado grande)`); continue }

    let titulo = file.name.replace(/\.(md|markdown)$/i, '').trim().slice(0, 200)
    if (usados.has(titulo.toLowerCase())) {
      let n = 2
      while (usados.has(`${titulo} (${n})`.toLowerCase())) n++
      titulo = `${titulo} (${n})`
    }
    usados.add(titulo.toLowerCase())
    archivos.push({ titulo, contenido })
  }

  archivos.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true, sensitivity: 'base' }))
  return { archivos, omitidos, carpeta }
}

export default function ImportModal({ open, onClose, onDone, colecciones = [], coleccionFija }: ImportModalProps) {
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [archivos, setArchivos] = useState<ArchivoMd[]>([])
  const [omitidos, setOmitidos] = useState<string[]>([])
  const [destino, setDestino] = useState<'nueva' | 'existente'>('nueva')
  const [existenteId, setExistenteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [materia, setMateria] = useState('general')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setArchivos([]); setOmitidos([]); setError(null)
    setDestino('nueva'); setExistenteId(''); setTitulo(''); setMateria('general')
  }, [open])

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const leido = await leerArchivos(files)
    setArchivos(leido.archivos)
    setOmitidos(leido.omitidos)
    if (leido.carpeta && !titulo) setTitulo(leido.carpeta.slice(0, 200))
    setError(leido.archivos.length === 0 ? 'No se ha encontrado ningún archivo .md.' : null)
    e.target.value = ''
  }

  async function handleImport() {
    if (archivos.length === 0) return
    setImporting(true)
    setError(null)

    let coleccionId = coleccionFija?.id ?? (destino === 'existente' ? existenteId : '')
    if (!coleccionFija && destino === 'nueva') {
      if (!titulo.trim()) { setError('Ponle un título a la colección.'); setImporting(false); return }
      const res = await createColeccion({ titulo: titulo.trim(), descripcion: null, materia })
      if (res.error || !res.id) { setError(res.error ?? 'No se pudo crear la colección.'); setImporting(false); return }
      coleccionId = res.id
    }
    if (!coleccionId) { setError('Elige una colección.'); setImporting(false); return }

    const { error: e } = await importarPaginas(coleccionId, archivos.map((a, i) => ({ ...a, orden: i })))
    setImporting(false)
    if (e) { setError(e); return }
    onDone(coleccionId)
  }

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="p-6 flex flex-col gap-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg text-text-primary">Importar Markdown</h2>
            <p className="mt-1 text-xs text-text-muted">
              {coleccionFija ? `Se añadirán a «${coleccionFija.titulo}».` : 'Sube notas sueltas o una carpeta entera (p. ej. un vault de Obsidian).'}
              {' '}Las páginas con el mismo título se sobrescriben.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl hover:bg-white/5 text-text-muted" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => filesRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/[0.15] px-3 py-5 text-sm font-semibold text-text-secondary hover:border-primary/50 hover:text-primary-light transition-colors"
          >
            <FileText size={20} />
            Archivos .md
          </button>
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/[0.15] px-3 py-5 text-sm font-semibold text-text-secondary hover:border-primary/50 hover:text-primary-light transition-colors"
          >
            <FolderUp size={20} />
            Carpeta completa
          </button>
          <input ref={filesRef} type="file" accept=".md,.markdown,text/markdown" multiple hidden onChange={handleFiles} />
          <input ref={folderRef} type="file" multiple hidden onChange={handleFiles} {...{ webkitdirectory: '' }} />
        </div>

        {archivos.length > 0 && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
            <p className="px-3 py-2 text-xs font-semibold text-text-secondary border-b border-white/[0.06]">
              {archivos.length} {archivos.length === 1 ? 'página' : 'páginas'}
            </p>
            <ul className="max-h-40 overflow-y-auto px-3 py-2 text-sm text-text-primary space-y-1">
              {archivos.map(a => (
                <li key={a.titulo} className="flex items-center gap-2 truncate">
                  <FileText size={12} className="shrink-0 text-text-muted" />
                  <span className="truncate">{a.titulo}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {omitidos.length > 0 && (
          <p className="text-xs text-text-muted">Omitidos: {omitidos.join(', ')}</p>
        )}

        {!coleccionFija && archivos.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {(['nueva', 'existente'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  disabled={opt === 'existente' && colecciones.length === 0}
                  onClick={() => setDestino(opt)}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors disabled:opacity-40 ${
                    destino === opt ? 'border-primary/40 bg-primary/10 text-primary-light' : 'border-white/[0.08] text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {opt === 'nueva' ? 'Nueva colección' : 'Colección existente'}
                </button>
              ))}
            </div>
            {destino === 'nueva' ? (
              <>
                <Input label="Título de la colección" value={titulo} maxLength={200} onChange={e => setTitulo(e.target.value)} />
                <MateriaSelect value={materia} onChange={setMateria} />
              </>
            ) : (
              <select value={existenteId} onChange={e => setExistenteId(e.target.value)} className={SELECT_CLASS}>
                <option value="">Elige una colección…</option>
                {colecciones.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleImport} loading={importing} disabled={archivos.length === 0} icon={<Upload size={14} />}>
            Importar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
