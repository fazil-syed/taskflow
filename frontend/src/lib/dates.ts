/** A date-only string in `YYYY-MM-DD`, always interpreted in local time. */
export type DateOnly = string

export function toDateOnly(date: Date): DateOnly {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parses `YYYY-MM-DD` as a *local* midnight date (avoids the UTC shift of `new Date(str)`). */
export function fromDateOnly(value: DateOnly): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function today(): DateOnly {
  return toDateOnly(new Date())
}

export function addDays(value: DateOnly, days: number): DateOnly {
  const date = fromDateOnly(value)
  date.setDate(date.getDate() + days)
  return toDateOnly(date)
}

export function isBefore(a: DateOnly, b: DateOnly): boolean {
  return a < b
}

/** 0 = Sunday … 6 = Saturday */
export function startOfWeek(value: DateOnly): DateOnly {
  const date = fromDateOnly(value)
  return addDays(value, -date.getDay())
}

export function startOfMonthGrid(value: DateOnly): DateOnly {
  const d = fromDateOnly(value)
  return startOfWeek(toDateOnly(new Date(d.getFullYear(), d.getMonth(), 1)))
}

/** The last day of the week containing the end of the month, so the grid never
 *  renders a trailing week that belongs entirely to the next month. */
export function endOfMonthGrid(value: DateOnly): DateOnly {
  const d = fromDateOnly(value)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return addDays(toDateOnly(lastDay), 6 - lastDay.getDay())
}

export function monthLabel(value: DateOnly): string {
  return fromDateOnly(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function shiftMonth(value: DateOnly, delta: number): DateOnly {
  const date = fromDateOnly(value)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + delta)
  // Clamp to the last valid day so 31 Jan + 1 month lands on 28/29 Feb, not 3 Mar.
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return toDateOnly(date)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekdayLabels(): string[] {
  return WEEKDAY_LABELS
}

/** The last `count` days ending today, oldest first. */
export function recentDays(count: number): DateOnly[] {
  const out: DateOnly[] = []
  for (let i = count - 1; i >= 0; i--) out.push(addDays(today(), -i))
  return out
}

export function formatDate(value: DateOnly | null | undefined): string {
  if (!value) return '—'
  return fromDateOnly(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateShort(value: DateOnly | null | undefined): string {
  if (!value) return '—'
  return fromDateOnly(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function formatWeekdayDate(value: DateOnly): string {
  return fromDateOnly(value).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "3 days ago", "in 2 days", "today" — for due dates. */
export function relativeDay(value: DateOnly): string {
  const diff = daysBetween(today(), value)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff < 0) return `${Math.abs(diff)} days ago`
  return `in ${diff} days`
}

export function daysBetween(from: DateOnly, to: DateOnly): number {
  const ms = fromDateOnly(to).getTime() - fromDateOnly(from).getTime()
  return Math.round(ms / 86_400_000)
}
