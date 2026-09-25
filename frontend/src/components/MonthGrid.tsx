import { useMemo } from 'react'
import { cn } from '../lib/cn'
import {
  addDays,
  endOfMonthGrid,
  formatDate,
  fromDateOnly,
  monthLabel,
  shiftMonth,
  startOfMonthGrid,
  toDateOnly,
  today,
  weekdayLabels,
  type DateOnly,
} from '../lib/dates'
import { IconButton } from './ui/Button'

export interface MonthGridProps {
  month: DateOnly
  onMonthChange: (month: DateOnly) => void
  /** Dates the user has marked. */
  selected?: ReadonlySet<DateOnly>
  onToggle?: (date: DateOnly) => void
  /** Extra visual weight per date, e.g. how many tasks were logged. */
  intensity?: Map<DateOnly, number>
  maxIntensity?: number
  /** Renders the status dots for a calendar day instead of a check mark. */
  renderDay?: (date: DateOnly) => React.ReactNode
  footer?: React.ReactNode
  className?: string
  interactive?: boolean
}

export function MonthGrid({
  month,
  onMonthChange,
  selected,
  onToggle,
  intensity,
  maxIntensity = 1,
  renderDay,
  footer,
  className,
  interactive = true,
}: MonthGridProps) {
  const cells = useMemo(() => {
    const start = startOfMonthGrid(month)
    const end = endOfMonthGrid(month)
    const out: { date: DateOnly; inMonth: boolean }[] = []
    let cursor = start
    while (cursor <= end) {
      out.push({ date: cursor, inMonth: fromDateOnly(cursor).getMonth() === fromDateOnly(month).getMonth() })
      cursor = addDays(cursor, 1)
    }
    return out
  }, [month])

  const todayDate = today()

  return (
    <div className={cn('select-none', className)}>
      <div className="mb-2 flex items-center justify-between">
        <IconButton label="Previous month" size="sm" onClick={() => onMonthChange(shiftMonth(month, -1))}>
          <Chevron dir="left" />
        </IconButton>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{monthLabel(month)}</div>
        <IconButton label="Next month" size="sm" onClick={() => onMonthChange(shiftMonth(month, 1))}>
          <Chevron dir="right" />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdayLabels().map((label) => (
          <div key={label} className="pb-1.5 text-center text-[11px] font-medium tracking-wide text-slate-400 uppercase">
            {label[0]}
          </div>
        ))}

        {cells.map(({ date, inMonth }) => {
          const isSelected = selected?.has(date) ?? false
          const isToday = date === todayDate
          const level = intensity ? intensityLevel(intensity.get(date) ?? 0, maxIntensity) : 0
          const dayNumber = fromDateOnly(date).getDate()

          return (
            <button
              key={date}
              type="button"
              disabled={!interactive}
              onClick={() => onToggle?.(date)}
              title={formatDate(date)}
              aria-pressed={isSelected}
              className={cn(
                'relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition sm:h-16',
                inMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-700',
                interactive && !isSelected && 'hover:bg-slate-100 dark:hover:bg-slate-800',
                interactive && 'cursor-pointer',
                !interactive && 'cursor-default',
                level > 0 && !isSelected && heatStyle(level),
                isSelected && 'bg-indigo-600 text-white dark:bg-indigo-500',
                isToday && !isSelected && 'ring-1 ring-indigo-400 ring-inset dark:ring-indigo-500',
              )}
            >
              <span className={cn('font-medium', isSelected && 'text-white')}>{dayNumber}</span>
              {renderDay && <span className="flex h-1.5 items-center gap-0.5">{renderDay(date)}</span>}
              {isSelected && !renderDay && (
                <svg viewBox="0 0 12 12" className="absolute right-0.5 bottom-0.5 size-2.5 text-white/80" fill="none" aria-hidden>
                  <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          )
        })}
      </div>

      {footer}
    </div>
  )
}

export function intensityLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0
  const ratio = count / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export function heatStyle(level: number): string {
  switch (level) {
    case 1:
      return 'bg-emerald-500/10'
    case 2:
      return 'bg-emerald-500/20'
    case 3:
      return 'bg-emerald-500/30'
    default:
      return 'bg-emerald-500/45'
  }
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M12.5 5l-5 5 5 5' : 'M7.5 5l5 5-5 5'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Today / this-week shortcuts used above the work-day picker. */
export function QuickDayButtons({ onPick, disabled }: { onPick: (date: DateOnly) => void; disabled?: boolean }) {
  const options: { label: string; date: DateOnly }[] = [
    { label: 'Today', date: today() },
    { label: 'Yesterday', date: addDays(today(), -1) },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.label}
          disabled={disabled}
          onClick={() => onPick(o.date)}
          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function firstOfMonth(date: DateOnly): DateOnly {
  const d = fromDateOnly(date)
  return toDateOnly(new Date(d.getFullYear(), d.getMonth(), 1))
}
