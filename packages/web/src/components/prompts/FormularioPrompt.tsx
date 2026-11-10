import { Pencil, Sparkles } from 'lucide-react'
import type { PromptCategoria, PromptInput, PromptModelo } from '@topcode/shared'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { Dialogo, ETIQUETA, INPUT } from '../foro/Dialogo'
import { CATEGORIAS, MODELOS } from './config'

export default function FormularioPrompt({
  editando, form, setForm, saving, error, onSubmit, onClose,
}: {
  editando: boolean
  form: PromptInput
  setForm: React.Dispatch<React.SetStateAction<PromptInput>>
  saving: boolean
  error: string | null
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  return (
    <Dialogo
      id="form-prompt-titulo"
      titulo={editando ? 'Editar prompt' : 'Añadir prompt'}
      subtitulo={editando ? 'Modifica los datos del prompt' : 'Comparte uno que te haya funcionado'}
      Icon={editando ? Pencil : Sparkles}
      onClose={onClose}
      onSubmit={onSubmit}
      pie={
        <>
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 py-3 text-sm">Cancelar</Button>
          <Button type="submit" disabled={saving} loading={saving} className="flex-[2] py-3 text-sm">
            {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar prompt'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pm-titulo" className={ETIQUETA}>Título</label>
        <input id="pm-titulo" value={form.titulo} autoFocus maxLength={120} placeholder="Título *" className={INPUT}
          onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pm-contenido" className={ETIQUETA}>Prompt</label>
        <textarea id="pm-contenido" value={form.contenido} rows={7} maxLength={8000}
          placeholder={'Prompt *\nEj: Actúa como profesor de programación y explícame paso a paso...'}
          className={cn(INPUT, 'font-mono text-[13px] resize-y')}
          onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pm-desc" className={ETIQUETA}>Para qué sirve (opcional)</label>
        <input id="pm-desc" value={form.descripcion ?? ''} maxLength={300} placeholder="Para qué sirve (opcional)" className={INPUT}
          onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pm-cat" className={ETIQUETA}>Categoría</label>
          <select id="pm-cat" value={form.categoria} className={cn(INPUT, 'px-3')}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value as PromptCategoria }))}>
            {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pm-modelo" className={ETIQUETA}>Modelo</label>
          <select id="pm-modelo" value={form.modelo} className={cn(INPUT, 'px-3')}
            onChange={e => setForm(f => ({ ...f, modelo: e.target.value as PromptModelo }))}>
            {Object.entries(MODELOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-300">{error}</p>}
    </Dialogo>
  )
}
