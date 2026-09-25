import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-600/50 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-white',
  secondary:
    'bg-white text-ink-soft ring-1 ring-inset ring-line-strong hover:bg-canvas active:bg-elevated dark:bg-surface dark:text-ink dark:ring-line-strong dark:hover:bg-elevated',
  ghost: 'text-ink-soft hover:bg-strong/70 active:bg-strong dark:text-ink-soft dark:hover:bg-elevated dark:active:bg-strong',
  subtle:
    'bg-elevated text-ink-soft hover:bg-strong active:bg-strong dark:bg-elevated dark:text-ink dark:hover:bg-strong',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-[13px]',
  md: 'h-9 gap-2 rounded-lg px-3 text-sm',
  lg: 'h-10 gap-2 rounded-xl px-4 text-sm',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium transition-colors select-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  )
})

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: Variant
  size?: Size
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        size === 'sm' ? 'size-8' : size === 'lg' ? 'size-10' : 'size-9',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})
