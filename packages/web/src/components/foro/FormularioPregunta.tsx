import { useRef } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import { FOCO, mez } from '../ui/estilos'
import { tinta } from '../../lib/tinta'
import { Dialogo, ETIQUETA, INPUT } from './Dialogo'
import { FORO_CATEGORIAS } from './categorias'

export type FormPregunta = { titulo: string; cuerpo: string; materia: string }

export default function FormularioPregunta({
  form, setForm, saving, error, onSubmit, onClose,
}: {
  form: FormPregunta
  setForm: React.Dispatch<React.SetStateAction<FormPregunta>>
  saving: boolean
  error: string | null
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    const n = FORO_CATEGORIAS.length
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + n) % n
    if (next < 0) return
    e.preventDefault()
    const c = FORO_CATEGORIAS[next].codigo
    setForm(f => ({ ...f, materia: c }))
    refs.current[c]?.focus()
  }

  return (
    <Dialogo
      id="form-pregunta-titulo"
      titulo="Nueva pregunta"
      subtitulo="Cuanto más detalle, mejor te podrán ayudar"
      Icon={MessageSquarePlus}
      onClose={onClose}
      onSubmit={onSubmit}
      pie={
        <>
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 py-3 text-sm">Cancelar</Button>
          <Button type="submit" disabled={saving} loading={saving} className="flex-[2] py-3 text-sm">
            {saving ? 'Publicando...' : 'Publicar pregunta'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pr-titulo" className={ETIQUETA}>Pregunta</label>
        <input id="pr-titulo" value={form.titulo} autoFocus
          onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          placeholder="¿Qué quieres preguntar? *" className={INPUT} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span id="pr-tipo" className={ETIQUETA}>Tipo</span>
        <div role="radiogroup" aria-labelledby="pr-tipo" className="grid grid-cols-2 gap-2">
          {FORO_CATEGORIAS.map((c, idx) => {
            const active = form.materia === c.codigo
            return (
              <button key={c.codigo} type="button" role="radio" aria-checked={active}
                tabIndex={active ? 0 : -1}
                ref={el => { refs.current[c.codigo] = el }}
                onClick={() => setForm(f => ({ ...f, materia: c.codigo }))}
                onKeyDown={e => onKeyDown(e, idx)}
                className={cn('text-xs font-semibold px-2 py-2.5 rounded-xl border transition-colors duration-150', FOCO,
                  !active && 'bg-ov/[0.03] border-ov/[0.08] text-text-secondary hover:bg-ov/[0.06]')}
                style={active ? { background: mez(c.color, 14), color: tinta(c.color), borderColor: c.color } : undefined}>
                {c.singular}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pr-cuerpo" className={ETIQUETA}>Descripción</label>
        <textarea id="pr-cuerpo" value={form.cuerpo} rows={5}
          onChange={e => setForm(f => ({ ...f, cuerpo: e.target.value }))}
          placeholder="Explica tu duda con detalle... *" className={cn(INPUT, 'resize-none')} />
      </div>

      {error && <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-300">{error}</p>}
    </Dialogo>
  )
}
