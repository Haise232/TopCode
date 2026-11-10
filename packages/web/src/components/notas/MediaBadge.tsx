import { useTheme } from '../../contexts/ThemeContext'
import { cn } from '../ui/cn'
import { NIVEL_CLASE, nivelNota } from './nota'

/** Nota numérica con color por nivel (en Navidad, ≥ 9 en dorado). */
export default function MediaBadge({ value, className }: { value: number; className?: string }) {
  const { navidad } = useTheme()
  return (
    <span className={cn(
      'inline-flex items-center justify-center text-sm font-bold tabular-nums rounded-lg px-2 py-0.5 min-w-[3rem]',
      NIVEL_CLASE[nivelNota(value, navidad)], className,
    )}>
      {value.toFixed(2)}
    </span>
  )
}
