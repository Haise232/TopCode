import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, Download, ExternalLink, File, Upload, X } from 'lucide-react'
import { MATERIAS } from '@topcode/shared'
import type { ApunteConAutor } from '../../hooks/useApuntes'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO } from '../ui/estilos'
import Dialogo from '../notas/Dialogo'
import IconoTipo from './IconoTipo'
import { TIPO_CONFIG, type TipoApunte } from './tipos'
import { mez } from '../ui/estilos'
import { tinta } from '../../lib/tinta'

const INPUT = 'bg-input border border-ov/[0.08] rounded-xl px-4 py-3 text-text-primary text-sm w-full outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'

/** Confirmación de subida con selector de materia. */
export function SubirDialogo({
  archivo, tipo, materia, onMateria, subiendo, onConfirm, onClose,
}: {
  archivo: File
  tipo: TipoApunte
  materia: string
  onMateria: (m: string) => void
  subiendo: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialogo
      idTitulo="subir-apunte-titulo"
      titulo={archivo.name}
      subtitulo={`${(archivo.size / 1024 / 1024).toFixed(1)} MB · ${TIPO_CONFIG[tipo].nombre}`}
      onClose={onClose}
      icono={<IconoTipo tipo={tipo} />}
    >
      <div className="flex flex-col gap-1.5 px-5 sm:px-6 pb-5">
        <label htmlFor="subir-materia" className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
          <BookOpen size={12} aria-hidden="true" />
          Materia <span className="text-text-muted font-normal">(opcional)</span>
        </label>
        <select id="subir-materia" value={materia} onChange={e => onMateria(e.target.value)}
          className={cn(INPUT, !materia && 'text-text-muted')}>
          <option value="">Sin categoría</option>
          {MATERIAS.map(m => <option key={m.codigo} value={m.nombreCorto}>{m.nombreCorto}</option>)}
        </select>
      </div>
      <div className="flex gap-3 px-5 sm:px-6 py-4 shrink-0 border-t border-ov/[0.07] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1 py-3 text-sm">Cancelar</Button>
        <Button onClick={onConfirm} disabled={subiendo} loading={subiendo} icon={subiendo ? undefined : <Upload size={15} aria-hidden="true" />} className="flex-[2] py-3 text-sm">
          {subiendo ? 'Subiendo…' : 'Subir'}
        </Button>
      </div>
    </Dialogo>
  )
}

const BARRA_BTN = cn('flex items-center gap-1.5 px-3 h-9 text-xs font-semibold rounded-lg bg-ov/[0.05] text-text-primary hover:bg-ov/[0.09] transition-colors', FOCO)

/** Visor de archivo a pantalla completa (PDF, imagen o aviso de sin vista previa). */
export function VistaPrevia({ apunte, onClose }: { apunte: ApunteConAutor; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { color } = TIPO_CONFIG.otro
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="preview-titulo"
      className="fixed inset-0 z-[9999] flex flex-col bg-bg motion-safe:animate-fade-in">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 shrink-0 bg-surface border-b border-ov/[0.08]">
        <div className="flex items-center gap-3 min-w-0">
          <IconoTipo tipo={apunte.tipo} size={36} />
          <div className="min-w-0">
            <h2 id="preview-titulo" className="font-semibold text-sm text-text-primary truncate">{apunte.nombre}</h2>
            {apunte.materia && <p className="text-xs text-text-muted truncate">{apunte.materia}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <a href={apunte.url} download aria-label="Descargar" className={BARRA_BTN}>
            <Download size={14} aria-hidden="true" /> <span className="hidden sm:inline">Descargar</span>
          </a>
          <a href={apunte.url} target="_blank" rel="noopener noreferrer" aria-label="Nueva pestaña" className={BARRA_BTN}>
            <ExternalLink size={14} aria-hidden="true" /> <span className="hidden sm:inline">Nueva pestaña</span>
          </a>
          <button onClick={onClose} aria-label="Cerrar vista previa" autoFocus
            className={cn('w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-ov/[0.06] hover:text-text-primary transition-colors', FOCO)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {apunte.tipo === 'pdf' ? (
          <iframe src={apunte.url} className="w-full h-full bg-white" title={apunte.nombre} />
        ) : apunte.tipo === 'imagen' ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <img src={apunte.url} alt={apunte.nombre} className="max-w-full max-h-full object-contain rounded-xl shadow-elevated" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center p-8">
              <span className="w-20 h-20 flex items-center justify-center rounded-2xl" style={{ background: mez(color, 14), color: tinta(color) }}>
                <File size={36} aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold text-text-primary">{apunte.nombre}</p>
                <p className="text-sm text-text-muted mt-1">Este tipo de archivo no tiene vista previa.</p>
              </div>
              <a href={apunte.url} download
                className={cn('flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-br from-primary to-primary-dark shadow-primary', FOCO)}>
                <Download size={15} aria-hidden="true" /> Descargar archivo
              </a>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
