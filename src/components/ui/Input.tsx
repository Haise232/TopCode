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
      {label && <span className="section-title">{label}</span>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className={cn('input-base', icon && 'pl-10', className)}
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
      {label && <span className="section-title">{label}</span>}
      <textarea ref={ref} id={id} className={cn('input-base resize-none', className)} {...rest} />
      {error && <span className="text-xs text-rose">{error}</span>}
    </label>
  )
})
