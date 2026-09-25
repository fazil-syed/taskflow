import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { CloseIcon } from './ui/Overlay'
import { toastVariants } from '../lib/motion'

type ToastKind = 'info' | 'success' | 'error'

interface Toast {
  id: number
  kind: ToastKind
  message: string
  detail?: string
  action?: { label: string; run: () => void }
}

interface ToastApi {
  info: (message: string, detail?: string) => void
  success: (message: string) => void
  error: (message: string, opts?: { detail?: string; action?: Toast['action'] }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string, opts: { detail?: string; action?: Toast['action'] } = {}) => {
      const id = nextId++
      setToasts((prev) => [...prev.slice(-3), { id, kind, message, ...opts }])
      if (kind !== 'error') {
        window.setTimeout(() => dismiss(id), 4000)
      }
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      info: (message, detail) => push('info', message, { detail }),
      success: (message) => push('success', message),
      error: (message, opts) => push('error', message, opts),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

const kindStyles: Record<ToastKind, string> = {
  info: 'ring-line-strong dark:ring-line-strong',
  success: 'ring-emerald-300 dark:ring-emerald-800',
  error: 'ring-rose-300 dark:ring-rose-800',
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-lg ring-1',
        'animate-pop dark:bg-elevated',
        kindStyles[toast.kind],
      )}
    >
      <span
        className={cn(
          'mt-1 size-2 shrink-0 rounded-full',
          toast.kind === 'error' ? 'bg-rose-500' : toast.kind === 'success' ? 'bg-emerald-500' : 'bg-indigo-500',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{toast.message}</p>
        {toast.detail && <p className="mt-0.5 text-sm text-ink-soft">{toast.detail}</p>}
        {toast.action && (
          <button
            className="mt-2 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            onClick={() => {
              toast.action?.run()
              onDismiss()
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-1 text-ink-faint transition-colors hover:bg-elevated hover:text-ink-soft dark:hover:bg-strong"
      >
        <CloseIcon />
      </button>
    </motion.div>
  )
}
