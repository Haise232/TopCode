import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useHorario } from '@topcode/shared'
import { useAuth } from '../hooks/useAuth'
import { Faltas } from '../components/faltas/Faltas'
import { cn } from '../components/ui/cn'
import { FOCO } from '../components/ui/estilos'

/** Página para apuntar, importar y corregir faltas (el modal de Inicio solo las muestra). */
export default function FaltasPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const { porDia, init } = useHorario(usuario?.clase)

  useEffect(() => { void init() }, [init])

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">
        <header className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            aria-label="Volver a Inicio"
            className={cn('w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-ov/[0.04] text-text-secondary hover:bg-ov/[0.08] transition-colors', FOCO)}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">Mis faltas</h1>
            <p className="text-xs text-text-muted">Apunta un día, pega el listado del instituto o corrige cada módulo</p>
          </div>
        </header>

        <Faltas usuarioId={usuario?.id} porDia={porDia} editable />
      </div>
    </div>
  )
}
