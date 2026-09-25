import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { TaskPriority, TaskStatus } from '../../lib/types'
import { formatDateShort, relativeDay, today } from '../../lib/dates'

/**
 * Status and priority colours come from the theme tokens, so these components
 * read correctly in both themes without a second set of hard-coded classes.
 */
export const STATUS_META: Record<
  TaskStatus,
  { label: string; dot: string; text: string; bg: string; color: string }
> = {
  todo: {
    label: 'To do',
    // Hollow, so "not started" is distinguishable without relying on hue.
    dot: 'border-2 border-status-todo bg-transparent',
    text: 'text-status-todo',
    bg: 'bg-status-todo/12',
    color: 'var(--color-status-todo)',
  },
  ongoing: {
    label: 'Ongoing',
    dot: 'bg-status-ongoing',
    text: 'text-status-ongoing',
    bg: 'bg-status-ongoing/15',
    color: 'var(--color-status-ongoing)',
  },
  done: {
    label: 'Done',
    dot: 'bg-status-done',
    text: 'text-status-done',
    bg: 'bg-status-done/15',
    color: 'var(--color-status-done)',
  },
}

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; text: string; bg: string; dot: string; color: string; weight: number }
> = {
  urgent: { label: 'Urgent', text: 'text-prio-urgent', bg: 'bg-prio-urgent/12', dot: 'bg-prio-urgent', color: 'var(--color-prio-urgent)', weight: 4 },
  high: { label: 'High', text: 'text-prio-high', bg: 'bg-prio-high/12', dot: 'bg-prio-high', color: 'var(--color-prio-high)', weight: 3 },
  normal: { label: 'Normal', text: 'text-prio-normal', bg: 'bg-prio-normal/12', dot: 'bg-prio-normal', color: 'var(--color-prio-normal)', weight: 2 },
  low: { label: 'Low', text: 'text-prio-low', bg: 'bg-prio-low/12', dot: 'bg-prio-low', color: 'var(--color-prio-low)', weight: 1 },
}

export const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'normal', 'low']

export function StatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', STATUS_META[status].dot, className)} />
}

export function StatusPill({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        meta.bg,
        meta.text,
        className,
      )}
    >
      <StatusDot status={status} className="size-1.5" />
      {meta.label}
    </span>
  )
}

export function PriorityFlag({ priority, showLabel = false }: { priority: TaskPriority; showLabel?: boolean }) {
  const meta = PRIORITY_META[priority]
  if (priority === 'normal' && !showLabel) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', meta.text)}>
      <svg viewBox="0 0 12 12" className="size-2.5 shrink-0" aria-hidden>
        <path d="M6 0l6 11H0z" fill={meta.color} />
      </svg>
      {showLabel && meta.label}
    </span>
  )
}

export function ProjectBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft">
      <span className="size-2 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
      <span className="max-w-[10rem] truncate">{name}</span>
    </span>
  )
}

export function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5', className)} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function DueBadge({ date, done }: { date: string; done: boolean }) {
  const overdue = !done && date < today()
  const soon = !done && !overdue && date <= todayPlusDays(3)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs',
        overdue
          ? 'bg-prio-urgent/12 font-medium text-prio-urgent'
          : soon
            ? 'bg-status-ongoing/15 font-medium text-status-ongoing'
            : 'text-ink-faint',
      )}
      title={`Due ${formatDateShort(date)} (${relativeDay(date)})`}
    >
      <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden>
        <rect x="2" y="3.5" width="12" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2 6.5h12M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {formatDateShort(date)}
    </span>
  )
}

function todayPlusDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

/** A tiny strip of the most recent days, used to show logged work at a glance. */
export function WorkDayStrip({ days, className }: { days: string[]; className?: string }) {
  if (days.length === 0) return null
  const recent = days.slice(-5)
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} title={`${days.length} day${days.length === 1 ? '' : 's'} logged`}>
      {recent.map((day) => (
        <span
          key={day}
          title={day}
          className="size-1.5 rounded-full bg-status-done ring-1 ring-status-done/25 ring-inset"
        />
      ))}
      {days.length > 5 && <span className="ml-0.5 text-[10px] text-ink-faint">+{days.length - 5}</span>}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-strong dark:bg-elevated', className)} />
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <p className="text-sm font-medium text-ink-soft dark:text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-faint dark:text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SpinnerBlock({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-10 text-ink-faint', className)}>
      <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  )
}
