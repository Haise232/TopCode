import { useMemo, useRef, useState } from 'react'
import { CalendarCheck2, ChevronDown, FileUp, Upload, X } from 'lucide-react'
import { TIPOS_EVENTO, type EventoCalendario, type TipoEvento } from '@topcode/shared'
import { TIPO_EVENTO_CONFIG } from '../../lib/tiposEvento'
import { MATERIAS_CORTAS, adaptarTitulo, esRepetido, leerIcs, materiaDeCurso } from '../../lib/ics'
import { Modal } from '../ui/Modal'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'

/** Evento del .ics ya adaptado al calendario, con lo que el usuario puede tocar antes de importar. */
export interface FilaImportar {
  uid: string
  titulo: string
  descripcion: string | null
  fecha: string
  hora: string | null
  tipo: TipoEvento
  materia: string | null
}

interface Candidato extends FilaImportar {
  marcado: boolean
  pasado: boolean
  repetido?: EventoCalendario
}

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })

const SELECT = 'h-8 px-2 rounded-lg bg-ov/[0.04] border border-ov/[0.08] text-xs text-text-primary max-w-full'

function preparar(texto: string, existentes: EventoCalendario[]): Candidato[] {
  const hoy = hoyISO()
  const vistos = new Set<string>()
  return leerIcs(texto)
    .filter(e => !vistos.has(e.uid) && vistos.add(e.uid))
    .map(e => {
      const { titulo, tipo } = adaptarTitulo(e.titulo)
      const repetido = esRepetido({ titulo, fecha: e.fecha, uid: e.uid }, existentes)
      const pasado = e.fecha < hoy
      return {
        uid: e.uid, titulo, descripcion: e.descripcion, fecha: e.fecha, hora: e.hora,
        tipo, materia: materiaDeCurso(e.curso), repetido, pasado,
        // Por defecto solo lo nuevo que aún no ha pasado
        marcado: !repetido && !pasado,
      }
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? ''))
}

/** Importa un .ics de Moodle al calendario: añade solo lo que falta y deja fuera lo repetido. */
export default function ImportarIcs({
  existentes, onImportar, onClose,
}: {
  existentes: EventoCalendario[]
  onImportar: (filas: FilaImportar[]) => Promise<{ error: string | null; nuevas: number }>
  onClose: () => void
}) {
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null)
  const [nombre, setNombre] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verRepetidos, setVerRepetidos] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const nuevos = useMemo(() => candidatos?.filter(c => !c.repetido) ?? [], [candidatos])
  const repetidos = useMemo(() => candidatos?.filter(c => c.repetido) ?? [], [candidatos])
  const marcados = nuevos.filter(c => c.marcado)

  async function cargar(archivo: File | undefined) {
    if (!archivo) return
    setError(null)
    const texto = await archivo.text()
    const lista = preparar(texto, existentes)
    if (lista.length === 0) { setError('Ese archivo no tiene eventos de calendario (.ics).'); return }
    setNombre(archivo.name)
    setCandidatos(lista)
  }

  const cambiar = (uid: string, cambios: Partial<Candidato>) =>
    setCandidatos(prev => prev?.map(c => c.uid === uid ? { ...c, ...cambios } : c) ?? null)

  const todosMarcados = nuevos.length > 0 && nuevos.every(c => c.marcado)
  const alternarTodos = () => setCandidatos(prev => prev?.map(c => c.repetido ? c : { ...c, marcado: !todosMarcados }) ?? null)

  async function importar() {
    setEnviando(true)
    setError(null)
    const r = await onImportar(marcados.map(({ uid, titulo, descripcion, fecha, hora, tipo, materia }) => ({ uid, titulo, descripcion, fecha, hora, tipo, materia })))
    setEnviando(false)
    if (r.error) setError(r.error)
    else onClose()
  }

  return (
    <Modal open onClose={onClose} maxWidthClassName="max-w-2xl">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-overlay-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileUp size={16} className="shrink-0 text-primary-light" aria-hidden="true" />
          <h2 className="text-sm font-bold text-text-primary">Importar calendario</h2>
          {nombre && <span className="text-xs text-text-muted truncate">{nombre}</span>}
        </div>
        <button onClick={onClose} aria-label="Cerrar"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-text-secondary hover:bg-ov/5 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 md:p-5 max-h-[75vh] overflow-y-auto flex flex-col gap-4">
        {!candidatos ? (
          <button
            onClick={() => input.current?.click()}
            onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={e => { e.preventDefault(); setArrastrando(false); void cargar(e.dataTransfer.files[0]) }}
            className={cn(
              'flex flex-col items-center gap-3 px-6 py-10 rounded-2xl border-2 border-dashed text-center transition-colors',
              arrastrando ? 'border-primary bg-primary/[0.06]' : 'border-ov/[0.12] hover:border-primary/50 hover:bg-ov/[0.02]',
              FOCO,
            )}
          >
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/15 text-primary-light">
              <Upload size={22} aria-hidden="true" />
            </span>
            <span className="text-sm font-bold text-text-primary">Arrastra aquí el archivo .ics o pulsa para elegirlo</span>
            <span className="text-xs text-text-muted max-w-sm">
              En el Campus: Calendario → Exportar calendario. Solo se añade lo que falta; lo que ya está en el calendario no se repite.
            </span>
          </button>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 text-2xs font-semibold">
              <span className="px-2 py-1 rounded-full bg-ov/[0.05] text-text-secondary">{candidatos.length} en el archivo</span>
              <span className="px-2 py-1 rounded-full bg-primary/15 text-primary-light">{nuevos.length} nuevos</span>
              <span className="px-2 py-1 rounded-full bg-ov/[0.05] text-text-muted">{repetidos.length} ya estaban</span>
            </div>

            {nuevos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CalendarCheck2 size={24} className="text-primary-light" aria-hidden="true" />
                <p className="text-sm font-semibold text-text-primary">Todo está ya en el calendario</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 px-1 text-xs font-semibold text-text-secondary cursor-pointer w-fit">
                  <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} className="accent-[rgb(var(--c-primary))] w-4 h-4" />
                  Marcar todos
                </label>
                {nuevos.map(c => {
                  const cfg = TIPO_EVENTO_CONFIG[c.tipo]
                  return (
                    <div
                      key={c.uid}
                      className={cn(
                        'rounded-xl border p-3 transition-colors',
                        c.marcado ? 'border-ov/[0.1] bg-surface' : 'border-ov/[0.06] bg-ov/[0.02] opacity-60',
                      )}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={c.marcado}
                          onChange={e => cambiar(c.uid, { marcado: e.target.checked })}
                          className="mt-0.5 accent-[rgb(var(--c-primary))] w-4 h-4 shrink-0"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-text-primary leading-snug">{c.titulo}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                            <span className="first-letter:uppercase">{fechaCorta(c.fecha)}</span>
                            {c.hora && <span className="font-mono">· {c.hora}</span>}
                            {c.pasado && <span className="px-1.5 rounded bg-ov/[0.06] text-2xs font-semibold">Ya pasó</span>}
                          </span>
                        </span>
                        <cfg.Icon size={14} className="shrink-0 mt-0.5" style={{ color: cfg.texto }} aria-hidden="true" />
                      </label>
                      {c.marcado && (
                        <div className="mt-2 ml-7 grid grid-cols-2 gap-2">
                          <select aria-label="Tipo" value={c.tipo} onChange={e => cambiar(c.uid, { tipo: e.target.value as TipoEvento })} className={cn(SELECT, FOCO)}>
                            {TIPOS_EVENTO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                          <select aria-label="Materia" value={c.materia ?? ''} onChange={e => cambiar(c.uid, { materia: e.target.value || null })} className={cn(SELECT, FOCO)}>
                            <option value="">Sin materia</option>
                            {MATERIAS_CORTAS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {repetidos.length > 0 && (
              <div>
                <button
                  onClick={() => setVerRepetidos(v => !v)}
                  aria-expanded={verRepetidos}
                  className={cn('flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text-secondary rounded', FOCO)}
                >
                  <ChevronDown size={13} className={cn('transition-transform', verRepetidos && 'rotate-180')} aria-hidden="true" />
                  {verRepetidos ? 'Ocultar' : 'Ver'} los {repetidos.length} que ya estaban
                </button>
                {verRepetidos && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {repetidos.map(c => (
                      <li key={c.uid} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-ov/[0.035] text-xs">
                        <span className="truncate text-text-secondary">{c.titulo}</span>
                        <span className="shrink-0 text-text-faint first-letter:uppercase">{fechaCorta(c.fecha)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        {error && <p role="alert" className="text-xs font-medium text-rose-dark dark:text-rose-light bg-rose-subtle rounded-lg px-3 py-2">{error}</p>}

        <input ref={input} type="file" accept=".ics,text/calendar" className="hidden" onChange={e => { void cargar(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      {candidatos && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-overlay-6">
          <button onClick={() => input.current?.click()} className={cn('text-xs font-semibold text-primary-light hover:underline underline-offset-4 rounded', FOCO)}>
            Elegir otro archivo
          </button>
          <button
            onClick={importar}
            disabled={marcados.length === 0 || enviando}
            className={cn('h-10 px-5 rounded-xl text-sm font-bold bg-primary text-white transition-opacity disabled:opacity-40', FOCO)}
          >
            {enviando ? 'Añadiendo…' : marcados.length === 0 ? 'Nada que añadir' : `Añadir ${marcados.length} ${marcados.length === 1 ? 'evento' : 'eventos'}`}
          </button>
        </div>
      )}
    </Modal>
  )
}
