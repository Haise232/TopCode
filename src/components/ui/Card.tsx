import { HTMLAttributes } from 'react'
import { cn } from './cn'

type CardVariant = 'default' | 'teal' | 'rose'
type CardPadding = 'none' | 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: 'card',
  teal: 'card-teal',
  rose: 'card-rose',
}

const PADDING_CLASS: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  padding?: CardPadding
  hover?: boolean
}

export function Card({
  variant = 'default',
  padding = 'md',
  hover = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        VARIANT_CLASS[variant],
        PADDING_CLASS[padding],
        hover && 'transition-all duration-200',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
