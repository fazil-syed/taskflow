import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { ActiveFilterChips, FilterBar } from '../../components/FilterBar'
import { MonthGrid } from '../../components/MonthGrid'
import { Button } from '../../components/ui/Button'
import { ExportButton } from '../../components/ExportDialog'
import { Drawer } from '../../components/ui/Overlay'
import {
  EmptyState,
  PRIORITY_META,
  PRIORITY_ORDER,
  PriorityFlag,
  ProjectBadge,
  Skeleton,
  STATUS_META,
  StatusDot,
} from '../../components/ui/primitives'
import { firstOfMonth, formatWeekdayDate, shiftMonth, today, type DateOnly } from '../../lib/dates'
import { DURATION, EASE_OUT, monthVariants } from '../../lib/motion'
import { useFilters } from '../../lib/filters'
import { useCalendar } from '../../lib/queries'
import type { CalendarDay, CalendarEntry, Task } from '../../lib/types'

const MAX_DOTS = 5

type View = 'logged' | 'due'

const VIEWS: { value: View; label: string; hint: string }[] = [
  { value: 'logged', label: 'Logged', hint: 'Days you recorded work against a task' },
  { value: 'due', label: 'Due', hint: 'Tasks whose due date falls on the day' },
]

export function CalendarPage() {
  const { filters } = useFilters()
  const [month, setMonth] = useState<DateOnly>(() => firstOfMonth(today()))
  const [direction, setDirection] = useState(1)
  const [view, setView] = useState<View>('logged')
  const [selectedDate, setSelectedDate] = useState<DateOnly | null>(null)
  const navigate = useNavigate()

  // The grid covers whole weeks, so ask for a slightly wider window.
  const range = useMemo(() => {
    const first = firstOfMonth(month)
    return { from: first, to: shiftMonth(firstOfMonth(shiftMonth(first, 1)), 1) }
  }, [month])

  const { data, isLoading } = useCalendar(range.from, range.to, { q: filters.q, priority: filters.priority })

  const goToMonth = (next: DateOnly) => {
    setDirection(next > month ? 1 : -1)
    setMonth(next)
  }

  const byDate = useMemo(() => {
    const map = new Map<DateOnly, CalendarDay>()
    for (const day of data?.days ?? []) map.set(day.date, day)
    return map
  }, [data])

  const countFor = (day: CalendarDay | undefined) => {
    if (!day) return 0
    return view === 'logged' ? day.logged : day.due
  }

  const entriesFor = (day: CalendarDay | undefined): CalendarEntry[] => {
    if (!day) return []
    return view === 'logged' ? day.tasks : day.due_tasks
  }

  const intensity = useMemo(() => {
    const map = new Map<DateOnly, number>()
    for (const [date, day] of byDate) map.set(date, countFor(day))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDate, view])

  const maxIntensity = useMemo(() => Math.max(1, ...intensity.values()), [intensity])
  const selectedDay = selectedDate ? byDate.get(selectedDate) : undefined
  const selectedEntries = entriesFor(selectedDay)
  const hasAnyWork = (data?.days.length ?? 0) > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 space-y-3 border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">Calendar</h1>
            <p className="mt-0.5 text-sm text-ink-soft">
              Every project and every queue at once. {VIEWS.find((v) => v.value === view)?.hint}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ViewSwitch view={view} onChange={setView} />
            <ExportButton />
          </div>
        </div>

        {/* Search only: the sidebar and the board columns already scope by
            project and status, so those filters would be redundant here. */}
        <FilterBar variant="calendar" />
        <ActiveFilterChips />
      </header>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-4xl">
          {isLoading && !data ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full sm:h-16" />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface p-4">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={month}
                  custom={direction}
                  variants={monthVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
              <MonthGrid
                month={month}
                onMonthChange={goToMonth}
                intensity={intensity}
                maxIntensity={maxIntensity}
                selected={selectedDate ? new Set([selectedDate]) : undefined}
                onToggle={(date) => setSelectedDate((prev) => (prev === date ? null : date))}
                renderDay={(date) => <Dots view={view} entries={entriesFor(byDate.get(date))} />}
                footer={
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                    <Legend view={view} />
                    <Button size="sm" onClick={() => goToMonth(firstOfMonth(today()))} disabled={month === firstOfMonth(today())}>
                      Today
                    </Button>
                  </div>
                }
              />
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {!isLoading && !hasAnyWork && (
            <EmptyState
              className="mt-4"
              title="Nothing scheduled in this month"
              description="Log work on an ongoing task, or give a task a due date, and it will show up here."
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
            ? view === 'logged'
              ? `${selectedDay.logged} task${selectedDay.logged === 1 ? '' : 's'} worked · ${selectedDay.counts.done} done, ${selectedDay.counts.ongoing} ongoing, ${selectedDay.counts.todo} to do`
              : `${selectedDay.due} task${selectedDay.due === 1 ? '' : 's'} due`
            : view === 'logged'
              ? 'No work logged on this day'
              : 'Nothing due on this day'
        }
      >
        {selectedEntries.length > 0 ? (
          <ul className="space-y-2">
            {selectedEntries.map((entry) => (
              <li key={`${view}-${entry.task_id}`}>
                <button
                  onClick={() => navigate(`/?project=${entry.project_id}`)}
                  className="flex w-full items-start gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:border-line-strong hover:bg-elevated"
                >
                  <StatusDot status={entry.status} className="mt-1.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{entry.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <ProjectBadge name={entry.project_name} color={entry.project_color} />
                      <PriorityFlag priority={entry.priority} showLabel />
                      {view === 'logged' ? (
                        <span className="text-xs text-ink-faint">{STATUS_LABEL[entry.status]}</span>
                      ) : (
                        entry.locked && <span className="text-xs text-ink-faint">Locked</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={view === 'logged' ? 'Nothing logged here' : 'Nothing due here'}
            description={
              view === 'logged'
                ? 'No tasks have work recorded on this day.'
                : 'No tasks have a due date on this day.'
            }
          />
        )}
      </Drawer>
    </div>
  )
}

const STATUS_LABEL: Record<Task['status'], string> = {
  todo: 'To do',
  ongoing: 'Ongoing',
  done: 'Done',
}

/** Segmented control for choosing what the grid shows. */
function ViewSwitch({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Calendar view"
      className="relative flex rounded-lg bg-elevated p-0.5"
    >
      {VIEWS.map((option) => {
        const active = option.value === view
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {/* A single pill slides between the two options. */}
            {active && (
              <motion.span
                layoutId="calendar-view-pill"
                className="absolute inset-0 rounded-md bg-surface shadow-sm dark:bg-strong"
                transition={{ duration: DURATION.base, ease: EASE_OUT }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Up to five dots for a day. The logged view colours by status; the due view
 * colours by priority. In both, the least important items are faded so the dots
 * read in the order that matters.
 */
function Dots({ view, entries }: { view: View; entries: CalendarEntry[] }) {
  if (entries.length === 0) return null
  const ordered = [...entries].sort((a, b) => weight(b) - weight(a) || a.task_id - b.task_id)
  const shown = ordered.slice(0, MAX_DOTS)
  const overflow = entries.length - shown.length

  return (
    <>
      {shown.map((entry) => (
        <span
          key={entry.task_id}
          title={`${entry.title} · ${STATUS_LABEL[entry.status]}`}
          className={`size-1.5 rounded-full ${dotStyle(view, entry)}`}
        />
      ))}
      {overflow > 0 && <span className="ml-0.5 text-[9px] leading-none font-medium text-ink-faint">+{overflow}</span>}
    </>
  )
}

function weight(entry: CalendarEntry): number {
  return { urgent: 4, high: 3, normal: 2, low: 1 }[entry.priority]
}

function dotStyle(view: View, entry: CalendarEntry): string {
  const fade = entry.priority === 'low' ? 'opacity-55' : entry.priority === 'normal' ? 'opacity-80' : ''

  if (view === 'due') {
    // A due date is a commitment, so filled dots keyed to priority.
    return `${PRIORITY_META[entry.priority].dot} ${fade}`
  }
  return `${STATUS_META[entry.status].dot} ${fade}`
}

function Legend({ view }: { view: View }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
      {view === 'logged' ? (
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
        </>
      ) : (
        <>
          {PRIORITY_ORDER.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${PRIORITY_META[p].dot}`} />
              {PRIORITY_META[p].label}
            </span>
          ))}
        </>
      )}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-status-done/25" /> More on that day
      </span>
    </div>
  )
}
