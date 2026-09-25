import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { dialogVariants, drawerVariants, scrimVariants } from '../../lib/motion'
import { IconButton } from './Button'

function useLockedBody(active: boolean) {
  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [active])
}

function useAutoFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }, 40)
    return () => window.clearTimeout(timer)
  }, [open])
  return ref
}

/** Traps Escape while any overlay is open. */
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}) {
  useLockedBody(open)
  useEscape(open, onClose)
  const ref = useAutoFocus(open)
  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            variants={scrimVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative flex h-full w-full flex-col bg-surface shadow-2xl',
              'sm:border-l sm:border-line dark:bg-elevated',
              widths[width],
            )}
          >
            <header className="flex items-start gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-ink">{title}</h2>
                {subtitle && <div className="mt-0.5 text-sm text-ink-soft">{subtitle}</div>}
              </div>
              <IconButton label="Close" onClick={onClose} variant="ghost" size="sm">
                <CloseIcon />
              </IconButton>
            </header>
            <div className="panel-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <footer className="flex items-center justify-end gap-2 border-t border-line bg-canvas px-5 py-3 dark:bg-surface">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'sm',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md'
}) {
  useLockedBody(open)
  useEscape(open, onClose)
  const ref = useAutoFocus(open)

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            variants={scrimVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            variants={dialogVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative w-full rounded-2xl bg-surface p-5 shadow-2xl dark:bg-elevated',
              size === 'sm' ? 'max-w-sm' : 'max-w-lg',
            )}
          >
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1.5 text-sm text-ink-soft">{description}</p>}
            {children && <div className="mt-4">{children}</div>}
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4', className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
