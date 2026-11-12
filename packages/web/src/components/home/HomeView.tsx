import { useState } from 'react'
import { CalendarDays, GraduationCap, RefreshCw, Shield, Users, X } from 'lucide-react'
import { claseInfo, type EventoCalendario, type HorarioClase, type Usuario } from '@topcode/shared'
import { useTheme } from '../../contexts/ThemeContext'
import { cuentaAtrasNavidad } from '../../lib/temporada'
import { tinta } from '../../lib/tinta'
import { Copo, GorroNavidad } from '../Navidad'
import SelectorModo from '../SelectorModo'
import { Modal } from '../ui/Modal'
import { cn } from '../ui/cn'
import { AccesosInternos, EnlacesExternos } from './Accesos'
import { FOCO, mez } from '../ui/estilos'
import { HorarioHoy, HorarioSemana } from './Horario'
import { Dudas, Proximamente, type DudaInicio } from './Lateral'

export type { DudaInicio }

function saludoEmoji() {
  const h = new Date().getHours()
  if (h < 12) return { texto: 'Buenos días', emoji: '☀️' }
  if (h < 20) return { texto: 'Buenas tardes', emoji: '🌤️' }
  return { texto: 'Buenas noches', emoji: '🌙' }
}

function fechaFormateada() {
  return new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}

function Chip({ children, color, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-2xs font-bold px-2.5 py-1 rounded-full tracking-wide"
      style={color ? { background: mez(color, 13), color: tinta(color), ...style } : style}
    >
      {children}
    </span>
  )
}

interface HomeViewProps {
  usuario: Pick<Usuario, 'nombre' | 'rol' | 'clase' | 'avatar_url'> | null
  horarioPorDia: Record<number, HorarioClase[]>
  proximoEvento: EventoCalendario | null
  proximaActividad: EventoCalendario | null
  dudasRecientes: DudaInicio[]
  refreshing: boolean
  onRefresh: () => void
  onNavigate: (to: string) => void
}

/** Presentación de Inicio: recibe los datos ya cargados (la carga vive en pages/Home.tsx). */
export default function HomeView({
  usuario, horarioPorDia, proximoEvento, proximaActividad, dudasRecientes, refreshing, onRefresh, onNavigate,
}: HomeViewProps) {
  const { navidad } = useTheme()
  const [semanaAbierta, setSemanaAbierta] = useState(false)

  const initial = (usuario?.nombre?.[0] ?? 'U').toUpperCase()
  const { texto: saludo, emoji } = saludoEmoji()
  const esAdmin = usuario?.rol === 'admin'
  const cuentaAtras = navidad ? cuentaAtrasNavidad() : null
  const clase = claseInfo(usuario?.clase)

  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-8 flex flex-col gap-8">

        {/* ── Cabecera ─────────────────────────────────────────────────── */}
        <header className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5 text-text-muted">
              {navidad
                ? <Copo size={14} className="text-gold-light" />
                : <span className="text-sm leading-none" aria-hidden="true">{emoji}</span>}
              <span className="text-xs font-semibold tracking-widest uppercase">
                {navidad ? 'Felices fiestas' : saludo}
              </span>
            </div>

            <h1 className="mt-1 font-extrabold text-3xl md:text-4xl tracking-tight text-text-primary truncate">
              {usuario?.nombre ?? 'Estudiante'}
            </h1>

            <div className="mt-2.5 flex items-center gap-x-3 gap-y-2 flex-wrap">
              {esAdmin ? (
                <Chip color="#f43f5e"><Shield size={10} aria-hidden="true" />ADMIN</Chip>
              ) : (
                <Chip color="rgb(var(--c-primary-light))"><GraduationCap size={10} aria-hidden="true" />ALUMNO</Chip>
              )}
              {usuario?.clase && (
                <Chip style={{ backgroundColor: clase?.bg, color: tinta(clase?.color ?? 'currentColor') }}>
                  <Users size={10} aria-hidden="true" />{usuario.clase}
                </Chip>
              )}
              <span className="text-xs text-text-muted first-letter:uppercase">{fechaFormateada()}</span>
            </div>

            <SelectorModo className="sm:hidden mt-3 w-fit" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SelectorModo className="hidden sm:inline-flex" />
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className={cn('w-10 h-10 flex items-center justify-center rounded-xl transition-colors hover:bg-ov/5 bg-ov/[0.03] text-text-secondary', FOCO)}
              aria-label="Actualizar"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            </button>

            <div className="relative">
              <button
                onClick={() => onNavigate('/profile')}
                aria-label="Ir a mi perfil"
                className={cn('relative block w-10 h-10 overflow-hidden rounded-xl transition-shadow hover:ring-2 hover:ring-primary/50', FOCO)}
              >
                {usuario?.avatar_url ? (
                  <img src={usuario.avatar_url} alt="" className="w-10 h-10 object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/15">
                    <span className="font-bold text-sm text-primary-light">{initial}</span>
                  </div>
                )}
              </button>
              <GorroNavidad className="-top-3 -left-2 w-7 -rotate-12" />
            </div>
          </div>
        </header>

        {/* ── Bento: horario a la izquierda; entregas y dudas a la derecha ── */}
        <div className="grid gap-8 lg:gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7 min-w-0">
            <HorarioHoy porDia={horarioPorDia} tieneClase={!!usuario?.clase} onVerSemana={() => setSemanaAbierta(true)} />
          </div>
          <div className="lg:col-span-5 min-w-0 flex flex-col gap-8">
            <Proximamente
              actividad={proximaActividad}
              evento={proximoEvento}
              cuentaAtras={cuentaAtras}
              onActividad={() => onNavigate('/calendar?vista=actividades')}
              onEvento={() => onNavigate('/calendar')}
            />
            <Dudas dudas={dudasRecientes} onNavigate={onNavigate} />
          </div>
        </div>

        {/* ── Accesos ──────────────────────────────────────────────────── */}
        <AccesosInternos onNavigate={onNavigate} />
        <EnlacesExternos />

        <Modal open={semanaAbierta} onClose={() => setSemanaAbierta(false)} maxWidthClassName="max-w-5xl">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-overlay-6">
            <div className="flex items-center gap-2.5">
              <CalendarDays size={16} className="text-primary-light" />
              <h2 className="text-sm font-bold text-text-primary">Horario semanal</h2>
              {usuario?.clase && <span className="text-xs text-text-muted">{usuario.clase}</span>}
            </div>
            <button
              onClick={() => setSemanaAbierta(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:bg-ov/5 transition-colors"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-4 max-h-[80vh] overflow-y-auto">
            <HorarioSemana porDia={horarioPorDia} />
          </div>
        </Modal>

        <footer className="pt-2 flex items-center justify-center">
          <span className="text-text-faint text-[11px] font-medium">
            TopCode © 2026 · Informática — DAM · DAW · ASIR
          </span>
        </footer>
      </div>
    </div>
  )
}
