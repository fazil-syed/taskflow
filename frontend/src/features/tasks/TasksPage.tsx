import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ActiveFilterChips, FilterBar } from '../../components/FilterBar'
import { TaskPanel } from '../../components/TaskPanel'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { EmptyState, PriorityFlag, ProjectBadge, Skeleton } from '../../components/ui/primitives'
import { useFilters } from '../../lib/filters'
import { keys, useSetTaskStatus, useTask, useTasks } from '../../lib/queries'
import { PRIORITY_META, STATUS_META } from '../../components/ui/primitives'
import { rowVariants } from '../../lib/motion'
import type { Task, TaskStatus } from '../../lib/types'
import { daysBetween, formatDateShort, today } from '../../lib/dates'

type SortKey = 'title' | 'project' | 'status' | 'priority' | 'due' | 'started' | 'days' | 'updated'

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'title', label: 'Task' },
  { key: 'project', label: 'Project' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due' },
  { key: 'started', label: 'Started' },
  { key: 'days', label: 'Days' },
  { key: 'updated', label: 'Updated' },
]

export function TasksPage() {
  const { filters } = useFilters()
  const { data: tasks = [], isLoading } = useTasks(filters)
  const setStatus = useSetTaskStatus()
  const navigate = useNavigate()

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'updated', dir: 'desc' })
  // Keep the id rather than a snapshot so the drawer reflects later edits.
  const [openTaskId, setOpenTaskId] = useState<number | null>(null)
  const openTask = useTask(openTaskId)
  const queryClient = useQueryClient()

  const openTaskPanel = useCallback(
    (task: Task) => {
      queryClient.setQueryData(keys.task(task.id), task)
      setOpenTaskId(task.id)
    },
    [queryClient],
  )

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    const byPriority = (t: Task) => PRIORITY_META[t.priority].weight
    const copy = [...tasks]
    copy.sort((a, b) => {
      switch (sort.key) {
        case 'title':
          return a.title.localeCompare(b.title) * dir
        case 'project':
          return (a.project_name ?? '').localeCompare(b.project_name ?? '') * dir
        case 'status': {
          const order = ['todo', 'ongoing', 'done'] as TaskStatus[]
          return (order.indexOf(a.status) - order.indexOf(b.status)) * dir
        }
        case 'priority':
          return (byPriority(a) - byPriority(b)) * dir
        case 'due':
          return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') * dir
        case 'started':
          return (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') * dir
        case 'days':
          return (a.work_day_count - b.work_day_count) * dir
        case 'updated':
          return a.updated_at.localeCompare(b.updated_at) * dir
        default:
          return 0
      }
    })
    return copy
  }, [tasks, sort])

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 space-y-3 border-b border-line px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">All tasks</h1>
            <p className="mt-0.5 text-sm text-ink-faint dark:text-ink-soft">
              {isLoading ? 'Loading…' : `${tasks.length} task${tasks.length === 1 ? '' : 's'} across every project`}
            </p>
          </div>
        </div>
        <FilterBar />
        <ActiveFilterChips />
      </header>

      <div className="panel-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[60rem] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-canvas/95 backdrop-blur dark:bg-surface/95">
            <tr className="border-b border-line">
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-3 py-2 text-left">
                  <button
                    onClick={() => toggleSort(column.key)}
                    className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-ink-faint uppercase hover:text-ink dark:text-ink-soft dark:hover:text-ink"
                  >
                    {column.label}
                    {sort.key === column.key && (
                      <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
                        <path
                          d={sort.dir === 'asc' ? 'M6 9.5v-7M3 5.5L6 2.5l3 3' : 'M6 2.5v7M3 6.5l3 3 3-3'}
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-line dark:border-line/60">
                  <td colSpan={COLUMNS.length} className="px-3 py-2">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))}

            {/* Rows animate in and out so changing a filter reads as the list
                rearranging rather than snapping to a different set of rows. */}
            <AnimatePresence initial={false} mode="popLayout">
              {!isLoading &&
                sorted.map((task, index) => (
                  <motion.tr
                    key={task.id}
                    layout
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ delay: Math.min(index, 12) * 0.015 }}
                  >
                    <TaskRow
                      task={task}
                      onOpen={() => openTaskPanel(task)}
                      onGoToProject={(id) => navigate(`/?project=${id}`)}
                      onSetStatus={(status) => setStatus.mutate({ id: task.id, status })}
                    />
                  </motion.tr>
                ))}
            </AnimatePresence>
          </tbody>
        </table>

        {!isLoading && sorted.length === 0 && (
          <EmptyState
            title="No tasks match"
            description="Try removing a filter, or search for something else."
            action={
              <Button size="sm" onClick={() => navigate('/')}>
                Go to the board
              </Button>
            }
          />
        )}
      </div>

      <TaskPanel task={openTask.data ?? null} onClose={() => setOpenTaskId(null)} />
    </div>
  )
}

function TaskRow({
  task,
  onOpen,
  onGoToProject,
  onSetStatus,
}: {
  task: Task
  onOpen: () => void
  onGoToProject: (id: number) => void
  onSetStatus: (status: TaskStatus) => void
}) {
  const dueDelta = task.due_date ? daysBetween(today(), task.due_date) : null
  const overdue = dueDelta !== null && dueDelta < 0 && task.status !== 'done'

  return (
    <>
      <td className="max-w-md px-3 py-2">
        <button onClick={onOpen} className="flex w-full items-center gap-2 text-left">
          <span
            className={`truncate font-medium ${task.locked ? 'text-ink-faint dark:text-ink-soft' : 'text-ink dark:text-ink'}`}
          >
            {task.title}
          </span>
          {task.locked && (
            <svg viewBox="0 0 20 20" className="size-3 shrink-0 text-ink-faint" fill="none" aria-hidden>
              <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
        {task.description.trim() && (
          <p className="mt-0.5 truncate text-xs text-ink-faint dark:text-ink-soft">{task.description.split('\n')[0]}</p>
        )}
      </td>

      <td className="px-3 py-2">
        <button onClick={() => onGoToProject(task.project_id)} className="hover:underline">
          <ProjectBadge name={task.project_name ?? `Project ${task.project_id}`} color={task.project_color ?? '#94a3b8'} />
        </button>
      </td>

      <td className="px-3 py-2">
        <Select
          aria-label={`Status of ${task.title}`}
          value={task.status}
          disabled={task.locked}
          onChange={(e) => onSetStatus(e.target.value as TaskStatus)}
          className="h-8 w-28 text-xs"
        >
          {(['todo', 'ongoing', 'done'] as TaskStatus[]).map((status) => (
            <option key={status} value={status}>
              {STATUS_META[status].label}
            </option>
          ))}
        </Select>
      </td>

      <td className="px-3 py-2">
        <PriorityFlag priority={task.priority} showLabel />
      </td>

      <td className={overdue ? 'px-3 py-2 font-medium text-rose-600 dark:text-rose-400' : 'px-3 py-2 text-ink-soft dark:text-ink-soft'}>
        {task.due_date ? formatDateShort(task.due_date) : <span className="text-ink-faint">—</span>}
      </td>

      <td className="px-3 py-2 text-ink-soft">
        {task.start_date ? formatDateShort(task.start_date) : <span className="text-ink-faint">—</span>}
      </td>

      <td className="px-3 py-2 text-center tabular-nums text-ink-soft">
        {task.work_day_count || <span className="text-ink-faint">0</span>}
      </td>

      <td className="px-3 py-2 text-ink-faint dark:text-ink-soft">
        {new Date(task.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
      </td>

      <td className="px-3 py-2">
        <IconButton label={`Open ${task.title}`} size="sm" onClick={onOpen}>
          <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
            <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
      </td>
    </>
  )
}
