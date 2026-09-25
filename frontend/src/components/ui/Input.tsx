import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const fieldBase =
  'w-full rounded-lg bg-white text-slate-900 ring-1 ring-inset ring-slate-300 transition ' +
  'placeholder:text-slate-400 hover:ring-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ' +
  'dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:ring-slate-600 dark:placeholder:text-slate-500 dark:disabled:bg-slate-900/50'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(fieldBase, 'h-9 px-3 text-sm', invalid && 'ring-rose-400 focus:ring-rose-500', className)}
      {...props}
    />
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, 'resize-y px-3 py-2 text-sm leading-relaxed', invalid && 'ring-rose-400', className)}
      {...props}
    />
  )
})

export interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(fieldBase, 'h-9 cursor-pointer appearance-none py-0 pr-8 pl-3 text-sm', className)}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-400"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
})

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium tracking-wide text-slate-600 uppercase dark:text-slate-400">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}
