import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { cn } from './ui/cn'

/** Interruptor claro / oscuro. */
export default function SelectorModo({ className }: { className?: string }) {
  const { modo, setModo } = useTheme()
  const opciones = [
    { valor: 'claro' as const, etiqueta: 'Claro', Icon: Sun },
    { valor: 'oscuro' as const, etiqueta: 'Oscuro', Icon: Moon },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Apariencia"
      className={cn('inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-ov/[0.06] border border-ov/[0.08]', className)}
    >
      {opciones.map(({ valor, etiqueta, Icon }) => {
        const activo = modo === valor
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => setModo(valor)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all duration-200',
              activo
                ? 'bg-surface text-text-primary shadow-card'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <Icon size={14} className={activo ? (valor === 'claro' ? 'text-gold' : 'text-primary-light') : ''} />
            {etiqueta}
          </button>
        )
      })}
    </div>
  )
}
