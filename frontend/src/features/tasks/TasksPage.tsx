import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../../components/ToastProvider'
import { ActiveFilterChips, FilterBar } from '../../components/FilterBar'
import { TaskPanel } from '../../components/TaskPanel'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Input'
import { EmptyState, PriorityFlag, ProjectBadge, Skeleton } from '../../components/ui/primitives'
import { useFilters } from '../../lib/filters'
import { useDeleteTask, useSetTaskStatus, useTasks } from '../../lib/queries'
import { PRIORITY_META, STATUS_META } from '../../components/ui/primitives'
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
  const removeTask = useDeleteTask()
  const toast = useToast()
  const navigate = useNavigate()

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'updated', dir: 'desc' })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [openTask, setOpenTask] = useState<Task | null>(null)

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

  const allSelected = sorted.length > 0 && sorted.every((t) => selected.has(t.id))
  const selectedTasks = sorted.filter((t) => selected.has(t.id))
  const lockedSelected = selectedTasks.filter((t) => t.locked).length

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(sorted.map((t) => t.id)))
  }

  const bulkMove = (status: TaskStatus) => {
    const movable = selectedTasks.filter((t) => !t.locked)
    const skipped = selectedTasks.length - movable.length
    for (const task of movable) {
      setStatus.mutate(
        { id: task.id, status },
        { onError: () => toast.error(`Could not move “${task.title}”`) },
      )
    }
    setSelected(new Set())
    toast.success(
      skipped > 0
        ? `Moved ${movable.length} task${movable.length === 1 ? '' : 's'}, skipped ${skipped} locked`
        : `Moved ${movable.length} task${movable.length === 1 ? '' : 's'}`,
    )
  }

  const bulkDelete = () => {
    const deletable = selectedTasks.filter((t) => !t.locked)
    const skipped = selectedTasks.length - deletable.length
    for (const task of deletable) {
      removeTask.mutate(
        { id: task.id },
        { onError: () => toast.error(`Could not delete “${task.title}”`) },
      )
    }
    setSelected(new Set())
    toast.success(
      skipped > 0
        ? `Deleted ${deletable.length}, skipped ${skipped} locked task${skipped === 1 ? '' : 's'}`
        : `Deleted ${deletable.length} task${deletable.length === 1 ? '' : 's'}`,
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 space-y-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">All tasks</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {isLoading ? 'Loading…' : `${tasks.length} task${tasks.length === 1 ? '' : 's'} across every project`}
            </p>
          </div>
        </div>
        <FilterBar />
        <ActiveFilterChips />
      </header>

      {selected.size > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-indigo-50 px-5 py-2.5 dark:border-slate-800 dark:bg-indigo-500/10">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-1.5">
            {(['todo', 'ongoing'] as TaskStatus[]).map((status) => (
              <Button key={status} size="sm" onClick={() => bulkMove(status)}>
                Move to {STATUS_META[status].label.toLowerCase()}
              </Button>
            ))}
            <Button size="sm" variant="danger" onClick={bulkDelete}>
              Delete
            </Button>
          </div>
          {lockedSelected > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {lockedSelected} locked task{lockedSelected === 1 ? '' : 's'} will be skipped
            </span>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      <div className="panel-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[60rem] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all tasks"
                  className="size-4 cursor-pointer rounded border-slate-300 text-indigo-600 dark:border-slate-600"
                />
              </th>
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-3 py-2 text-left">
                  <button
                    onClick={() => toggleSort(column.key)}
                    className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-slate-500 uppercase hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
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
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td colSpan={COLUMNS.length + 1} className="px-3 py-2">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))}

            {!isLoading &&
              sorted.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selected.has(task.id)}
                  onToggle={() => {
                    const next = new Set(selected)
                    if (next.has(task.id)) next.delete(task.id)
                    else next.add(task.id)
                    setSelected(next)
                  }}
                  onOpen={() => setOpenTask(task)}
                  onGoToProject={(id) => navigate(`/?project=${id}`)}
                  onSetStatus={(status) => setStatus.mutate({ id: task.id, status })}
                />
              ))}
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

      <TaskPanel task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  )
}

function TaskRow({
  task,
  selected,
  onToggle,
  onOpen,
  onGoToProject,
  onSetStatus,
}: {
  task: Task
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  onGoToProject: (id: number) => void
  onSetStatus: (status: TaskStatus) => void
}) {
  const dueDelta = task.due_date ? daysBetween(today(), task.due_date) : null
  const overdue = dueDelta !== null && dueDelta < 0 && task.status !== 'done'

  return (
    <tr
      className={`border-b border-slate-100 transition-colors dark:border-slate-800/60 ${
        selected ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
      } ${task.locked ? 'text-slate-500 dark:text-slate-400' : ''}`}
    >
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${task.title}`}
          className="size-4 cursor-pointer rounded border-slate-300 text-indigo-600 dark:border-slate-600"
        />
      </td>

      <td className="max-w-md px-3 py-2">
        <button onClick={onOpen} className="flex w-full items-center gap-2 text-left">
          <span
            className={`truncate font-medium ${task.locked ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}
          >
            {task.title}
          </span>
          {task.locked && (
            <svg viewBox="0 0 20 20" className="size-3 shrink-0 text-slate-400" fill="none" aria-hidden>
              <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
        {task.description.trim() && (
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{task.description.split('\n')[0]}</p>
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

      <td className={overdue ? 'px-3 py-2 font-medium text-rose-600 dark:text-rose-400' : 'px-3 py-2 text-slate-600 dark:text-slate-300'}>
        {task.due_date ? formatDateShort(task.due_date) : <span className="text-slate-300 dark:text-slate-600">—</span>}
      </td>

      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
        {task.start_date ? formatDateShort(task.start_date) : <span className="text-slate-300 dark:text-slate-600">—</span>}
      </td>

      <td className="px-3 py-2 text-center tabular-nums text-slate-600 dark:text-slate-300">
        {task.work_day_count || <span className="text-slate-300 dark:text-slate-600">0</span>}
      </td>

      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
        {new Date(task.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
      </td>

      <td className="px-3 py-2">
        <IconButton label={`Open ${task.title}`} size="sm" onClick={onOpen}>
          <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
            <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
      </td>
    </tr>
  )
}
