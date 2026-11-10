import { CalendarClock } from 'lucide-react'
import { MATERIAS } from '@topcode/shared'
import { Button } from '../ui'
import { cn } from '../ui/cn'
import Dialogo from './Dialogo'
import { DIAS_SEMANA } from './dias'

const INPUT = 'bg-input border border-ov/[0.08] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted transition-[border-color,box-shadow] duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'
const ETIQUETA = 'text-xs font-semibold text-text-secondary'


export type FormClase = { dia_semana: number; hora_inicio: string; hora_fin: string; codigo: string }

export default function FormularioClase({ editando, clase, form, setForm, saving, onSubmit, onClose }: {
  editando: boolean
  clase: string | null
  form: FormClase
  setForm: React.Dispatch<React.SetStateAction<FormClase>>
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  return (
    <Dialogo idTitulo="form-clase-titulo" titulo={editando ? 'Editar clase' : 'Nueva clase'} subtitulo={clase ?? undefined} Icono={CalendarClock} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="clase-dia" className={ETIQUETA}>Día</label>
          <select id="clase-dia" value={form.dia_semana} onChange={e => setForm(f => ({ ...f, dia_semana: Number(e.target.value) }))} className={INPUT}>
            {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{DIAS_SEMANA[d]}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clase-inicio" className={ETIQUETA}>Hora inicio</label>
            <input id="clase-inicio" type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clase-fin" className={ETIQUETA}>Hora fin</label>
            <input id="clase-fin" type="time" value={form.hora_fin} onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))} className={INPUT} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="clase-materia" className={ETIQUETA}>Asignatura</label>
          <select id="clase-materia" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} className={INPUT}>
            {MATERIAS.map(m => <option key={m.codigo} value={m.codigo}>{m.nombreCorto} ({m.codigo})</option>)}
          </select>
        </div>
        <div className={cn('flex gap-3 mt-1')}>
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 py-3">Cancelar</Button>
          <Button type="submit" disabled={saving} loading={saving} className="flex-[2] py-3">
            {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Añadir clase'}
          </Button>
        </div>
      </form>
    </Dialogo>
  )
}
