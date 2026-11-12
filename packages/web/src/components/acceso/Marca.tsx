import { useState, type ElementType, type ReactNode } from 'react'
import { Eye, EyeOff, GraduationCap } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { Nieve } from '../Pattern'
import { CapaNieve, Copo, GorroNavidad, Guirnalda, PaisajeNevado } from '../Navidad'
import { cuentaAtrasNavidad } from '../../lib/temporada'
import { cn } from '../ui/cn'
import { FOCO, SUPERFICIE } from '../ui/estilos'

export const INPUT = 'bg-input border border-ov/[0.1] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted transition-[border-color,box-shadow] duration-200 w-full outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/0.12)]'
export const ETIQUETA = 'text-xs font-semibold text-text-secondary'
/** Botón principal de los formularios de acceso: sólido, con texto blanco legible en todos los temas. */
export const BOTON_PRINCIPAL = cn(
  'group w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-primary-dark',
  'transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed',
  FOCO,
)

/** Cuadrado de marca con el birrete (y el gorro en Navidad). */
export function LogoMarca({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const grande = size === 'lg'
  return (
    <span className={cn('relative flex items-center justify-center bg-primary-dark text-white', grande ? 'w-14 h-14 rounded-2xl' : 'w-10 h-10 rounded-xl')}>
      <GraduationCap size={grande ? 26 : 20} aria-hidden="true" />
      <GorroNavidad className={grande ? '-top-4 -left-3 w-9 -rotate-12' : '-top-3 -left-2 w-7 -rotate-12'} />
    </span>
  )
}

export function Nombre({ className }: { className?: string }) {
  return (
    <span className={cn('font-bold text-lg text-text-primary', className)}>
      Top<span className="text-primary-light">Code</span>
    </span>
  )
}

export interface PuntoMarca { Icon: ElementType; texto: string }

/** Panel lateral de marca (solo escritorio): logo, mensaje y puntos clave. */
function PanelMarca({ etiqueta, titulo, acento, bajada, puntos }: {
  etiqueta: string; titulo: string; acento: string; bajada: string; puntos: PuntoMarca[]
}) {
  const { navidad } = useTheme()
  return (
    <aside className={cn(
      'hidden lg:flex flex-col justify-between w-[460px] shrink-0 sticky top-0 h-screen min-h-[680px] p-10 pt-12 overflow-hidden bg-surface-2 border-r border-ov/[0.07]',
      navidad && 'pb-40 bg-[radial-gradient(90%_55%_at_15%_0%,rgb(var(--c-gold)/0.16),transparent_70%)]',
    )}>
      {navidad && <div className="absolute inset-0 pointer-events-none" aria-hidden="true"><Nieve /></div>}
      <PaisajeNevado className="h-36" />

      <div className="relative flex items-center gap-3">
        <LogoMarca />
        <Nombre />
      </div>

      <div className="relative flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-light">{etiqueta}</p>
          <p className="text-4xl font-extrabold leading-tight tracking-tight text-text-primary">
            {titulo}<br /><span className="text-primary-light">{acento}</span>
          </p>
          <p className="text-base leading-relaxed max-w-sm text-text-secondary">{bajada}</p>
        </div>

        <ul className="flex flex-col gap-3.5">
          {puntos.map(({ Icon, texto }) => (
            <li key={texto} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary-light">
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="text-sm text-text-secondary">{texto}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className={cn('relative text-xs', navidad ? 'text-text-secondary' : 'text-text-muted')}>
        © {new Date().getFullYear()} TopCode · Informática (DAM·DAW·ASIR)
      </p>
    </aside>
  )
}

/** Estructura común de Login y Registro: panel de marca + columna del formulario. */
export function AccesoLayout({ panel, children }: { panel: Parameters<typeof PanelMarca>[0]; children: ReactNode }) {
  const { navidad } = useTheme()
  return (
    <div className="min-h-screen flex bg-bg relative">
      {/* Menos bombillas en móvil para que no queden amontonadas */}
      <div className="sm:hidden"><Guirnalda bombillas={14} /></div>
      <div className="hidden sm:block"><Guirnalda bombillas={40} /></div>
      <PanelMarca {...panel} />
      <main className={cn(
        'flex-1 min-w-0 flex items-center justify-center px-4 pt-10 pb-8 sm:p-8 relative overflow-hidden',
        navidad && 'pb-28 sm:pb-32 lg:pb-8 bg-[radial-gradient(70%_50%_at_50%_0%,rgb(var(--c-primary)/0.07),transparent_70%)]',
      )}>
        {navidad && <div className="absolute inset-0 pointer-events-none" aria-hidden="true"><Nieve densidad={0.5} /></div>}
        <PaisajeNevado className="h-24 sm:h-28 lg:hidden" />
        <div className="w-full max-w-[400px] relative">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <LogoMarca />
            <div className="min-w-0">
              <Nombre className="block leading-tight" />
              <p className="text-xs text-text-muted">Intranet académica · Informática</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

/** Píldora con la cuenta atrás navideña (solo en temporada). */
export function CuentaAtras({ className }: { className?: string }) {
  const { navidad } = useTheme()
  const cuenta = navidad ? cuentaAtrasNavidad() : null
  if (!cuenta) return null
  return (
    <p className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
      cuenta.especial ? 'bg-primary/10 text-primary-light' : 'bg-gold/15 text-gold-light',
      className,
    )}>
      <Copo size={12} className="motion-safe:animate-[spin_8s_linear_infinite]" />
      {cuenta.texto}
    </p>
  )
}

export function CabeceraForm({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="mb-6">
      <CuentaAtras className="mb-3" />
      <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">{titulo}</h1>
      <p className="text-sm mt-1.5 text-text-muted">{subtitulo}</p>
    </div>
  )
}

/** Tarjeta que envuelve el formulario. */
export function TarjetaForm({ children }: { children: ReactNode }) {
  const { navidad } = useTheme()
  return (
    <div className={cn(SUPERFICIE, 'relative p-5 sm:p-6', navidad && 'mt-3')}>
      <CapaNieve />
      {children}
    </div>
  )
}

/** Campo de texto con etiqueta asociada. */
export function Campo({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={ETIQUETA}>{label}</label>
      <input id={id} className={INPUT} {...rest} />
    </div>
  )
}

/** Campo de contraseña con botón de mostrar/ocultar. Si se pasa `visible` el estado lo lleva el padre. */
export function CampoPassword({ id, label, value, onChange, placeholder = 'Tu contraseña', autoComplete, autoFocus, visible, onToggle, etiquetaToggle }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete: string
  autoFocus?: boolean
  visible?: boolean
  onToggle?: () => void
  etiquetaToggle?: [mostrar: string, ocultar: string]
}) {
  const [interno, setInterno] = useState(false)
  const ver = visible ?? interno
  const alternar = onToggle ?? (() => setInterno(v => !v))
  const [mostrar, ocultar] = etiquetaToggle ?? ['Mostrar contraseña', 'Ocultar contraseña']
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={ETIQUETA}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={ver ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={cn(INPUT, 'pr-12')}
        />
        <button
          type="button"
          onClick={alternar}
          aria-label={ver ? ocultar : mostrar}
          aria-pressed={ver}
          className={cn('absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-ov/[0.06] transition-colors', FOCO)}
        >
          {ver ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}

const FUERZA_BARRA = ['', 'bg-rose-500', 'bg-amber-400', 'bg-teal']
const FUERZA_TEXTO = ['', 'text-rose-600 dark:text-rose-300', 'text-amber-700 dark:text-amber-300', 'text-teal-light']

/** Medidor de fuerza en tres tramos. `nivel` 1-3; las etiquetas las pone cada pantalla. */
export function MedidorFuerza({ nivel, etiquetas }: { nivel: 1 | 2 | 3; etiquetas: [string, string, string] }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1 flex-1" aria-hidden="true">
        {[1, 2, 3].map(n => (
          <span key={n} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', nivel >= n ? FUERZA_BARRA[nivel] : 'bg-ov/[0.1]')} />
        ))}
      </div>
      <span className={cn('text-xs font-semibold', FUERZA_TEXTO[nivel])} role="status">
        <span className="sr-only">Seguridad de la contraseña: </span>{etiquetas[nivel - 1]}
      </span>
    </div>
  )
}
