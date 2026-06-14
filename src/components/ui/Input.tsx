import { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from './cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, icon, className, id, ...rest },
  ref
) {
  return (
    <label className="flex flex-col gap-1.5 w-full" htmlFor={id}>
      {label && <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none',
            'focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]',
            icon && 'pl-10',
            className
          )}
          {...rest}
        />
      </div>
      {error && <span className="text-xs text-rose">{error}</span>}
    </label>
  )
})

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, className, id, ...rest },
  ref
) {
  return (
    <label className="flex flex-col gap-1.5 w-full" htmlFor={id}>
      {label && <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          'bg-input border border-white/[0.08] rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-text-muted transition-all duration-200 w-full outline-none resize-none',
          'focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(85,239,196,0.12)]',
          className
        )}
        {...rest}
      />
      {error && <span className="text-xs text-rose">{error}</span>}
    </label>
  )
})
