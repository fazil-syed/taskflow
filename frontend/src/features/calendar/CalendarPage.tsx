import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ActiveFilterChips, FilterBar } from '../../components/FilterBar'
import { MonthGrid, firstOfMonth } from '../../components/MonthGrid'
import { TaskPanel } from '../../components/TaskPanel'
import { Button } from '../../components/ui/Button'
import { Drawer } from '../../components/ui/Overlay'
import { EmptyState, PriorityFlag, ProjectBadge, Skeleton, StatusDot } from '../../components/ui/primitives'
import { formatWeekdayDate, shiftMonth, today, type DateOnly } from '../../lib/dates'
import { useFilters } from '../../lib/filters'
import { useCalendar } from '../../lib/queries'
import type { CalendarDay, Task } from '../../lib/types'

const MAX_DOTS = 5

export function CalendarPage() {
  const { filters } = useFilters()
  const [month, setMonth] = useState<DateOnly>(() => firstOfMonth(today()))
  const [selectedDate, setSelectedDate] = useState<DateOnly | null>(null)
  const [openTask, setOpenTask] = useState<Task | null>(null)
  const navigate = useNavigate()

  // The grid always covers whole weeks, so ask for a slightly wider window.
  const range = useMemo(() => {
    const first = firstOfMonth(month)
    const last = shiftMonth(firstOfMonth(shiftMonth(first, 1)), 1)
    return { from: first, to: last }
  }, [month])

  const { data, isLoading } = useCalendar(range.from, range.to, filters)

  const byDate = useMemo(() => {
    const map = new Map<DateOnly, CalendarDay>()
    for (const day of data?.days ?? []) map.set(day.date, day)
    return map
  }, [data])

  const intensity = useMemo(() => {
    const map = new Map<DateOnly, number>()
    for (const [date, day] of byDate) map.set(date, day.total)
    return map
  }, [byDate])

  const maxIntensity = useMemo(() => Math.max(1, ...intensity.values()), [intensity])
  const selectedDay = selectedDate ? byDate.get(selectedDate) : undefined
  const hasAnyWork = (data?.days.length ?? 0) > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 space-y-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Calendar</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Every day you have logged work, coloured by the status of each task.
          </p>
        </div>
        {/* Priority is intentionally not offered here: the calendar shows where
            work happened, not how urgent it was. */}
        <FilterBar showPriority={false} />
        <ActiveFilterChips />
      </header>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-4xl">
          {isLoading && !data ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <MonthGrid
                month={month}
                onMonthChange={setMonth}
                intensity={intensity}
                maxIntensity={maxIntensity}
                selected={selectedDate ? new Set([selectedDate]) : undefined}
                onToggle={(date) => setSelectedDate((prev) => (prev === date ? null : date))}
                renderDay={(date) => <Dots day={byDate.get(date)} />}
                footer={
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <Legend />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => setMonth(firstOfMonth(today()))} disabled={month === firstOfMonth(today())}>
                        Today
                      </Button>
                    </div>
                  </div>
                }
              />
            </div>
          )}

          {!isLoading && !hasAnyWork && (
            <EmptyState
              className="mt-4"
              title="No work logged in this month"
              description="Open a task that is ongoing or done and mark the days you worked on it."
              action={
                <Button size="sm" onClick={() => navigate('/')}>
                  Go to the board
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Drawer
        open={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatWeekdayDate(selectedDate) : ''}
        subtitle={
          selectedDay
            ? `${selectedDay.total} task${selectedDay.total === 1 ? '' : 's'} · ${selectedDay.counts.done} done, ${selectedDay.counts.ongoing} ongoing, ${selectedDay.counts.todo} to do`
            : 'No work logged on this day'
        }
      >
        {selectedDay && selectedDay.tasks.length > 0 ? (
          <ul className="space-y-2">
            {[...selectedDay.tasks]
              .sort((a, b) => a.priority.localeCompare(b.priority))
              .map((entry) => (
                <li key={entry.task_id}>
                  <button
                    onClick={() => navigate(`/?project=${entry.project_id}`)}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
                  >
                    <StatusDot status={entry.status} className="mt-1.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {entry.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <ProjectBadge name={entry.project_name} color={entry.project_color} />
                        <PriorityFlag priority={entry.priority} showLabel />
                        {entry.locked && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <svg viewBox="0 0 20 20" className="size-3" fill="none" aria-hidden>
                              <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
                              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                            Locked
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <EmptyState title="Nothing here" description="No tasks have work logged on this day." />
        )}
      </Drawer>

      <TaskPanel task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}

/**
 * Up to five status-coloured dots for a day. Urgent work is drawn at full
 * opacity and low priority is faded, so the dots read in priority order.
 */
function Dots({ day }: { day: CalendarDay | undefined }) {
  if (!day || day.total === 0) return null
  const byWeight = [...day.tasks].sort(
    (a, b) => weight(b.priority) - weight(a.priority) || a.task_id - b.task_id,
  )
  const shown = byWeight.slice(0, MAX_DOTS)
  const overflow = day.total - shown.length

  return (
    <>
      {shown.map((entry) => (
        <span
          key={entry.task_id}
          title={`${entry.title} · ${entry.status}`}
          className={`size-1.5 rounded-full ${dotStyle(entry)}`}
        />
      ))}
      {overflow > 0 && <span className="ml-0.5 text-[9px] leading-none font-medium text-slate-400">+{overflow}</span>}
    </>
  )
}

function weight(priority: Task['priority']): number {
  return { urgent: 4, high: 3, normal: 2, low: 1 }[priority]
}

function dotStyle(entry: { status: Task['status']; priority: Task['priority'] }): string {
  const opacity = entry.priority === 'low' ? 'opacity-60' : entry.priority === 'normal' ? 'opacity-80' : ''
  if (entry.status === 'done') return `bg-emerald-500 ${opacity}`
  if (entry.status === 'ongoing') return `bg-amber-500 ${opacity}`
  return `border border-slate-400 ${opacity}`
}

function Legend() {
  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <StatusDot status="todo" /> To do
      </span>
      <span className="inline-flex items-center gap-1.5">
        <StatusDot status="ongoing" /> Ongoing
      </span>
      <span className="inline-flex items-center gap-1.5">
        <StatusDot status="done" /> Done
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-emerald-500/20" /> More work logged
      </span>
    </>
  )
}
