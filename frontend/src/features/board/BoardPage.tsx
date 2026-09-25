import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useSearchParams } from 'react-router'
import { useToast } from '../../components/ToastProvider'
import { ActiveFilterChips, FilterBar } from '../../components/FilterBar'
import { ProjectRail } from '../../components/ProjectRail'
import { NewProjectButton } from '../../components/ProjectDialog'
import { TaskCard } from '../../components/TaskCard'
import { TaskPanel } from '../../components/TaskPanel'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Dialog } from '../../components/ui/Overlay'
import { EmptyState, Skeleton, StatusDot } from '../../components/ui/primitives'
import { useFilters } from '../../lib/filters'
import { useBoard, useCompleteTask, useCreateTask, useMoveTask, useProjects } from '../../lib/queries'
import type { Task, TaskPriority, TaskStatus } from '../../lib/types'

const COLUMNS: { status: TaskStatus; title: string; hint: string }[] = [
  { status: 'todo', title: 'To do', hint: 'Pick a start date to move work into progress' },
  { status: 'ongoing', title: 'Ongoing', hint: 'Log the days you work on each task' },
  { status: 'done', title: 'Done', hint: 'Finished tasks are locked' },
]

const COLUMN_PREFIX = 'col-'

export function BoardPage() {
  const { filters, clear } = useFilters()
  const { data: projects = [] } = useProjects()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()

  const selectedId = Number(searchParams.get('project')) || projects[0]?.id || null
  const { data: board, isLoading } = useBoard(selectedId, filters)
  const moveTask = useMoveTask()
  const complete = useCompleteTask()

  const [openTask, setOpenTask] = useState<Task | null>(null)
  const [activeDrag, setActiveDrag] = useState<Task | null>(null)
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null)
  const [pendingDone, setPendingDone] = useState<{ task: Task; status: TaskStatus; beforeId: number | null; afterId: number | null } | null>(
    null,
  )

  const columns = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>()
    for (const column of board?.columns ?? []) map.set(column.status, column.tasks)
    return map
  }, [board])

  const taskById = useMemo(() => {
    const map = new Map<number, Task>()
    for (const list of columns.values()) for (const task of list) map.set(task.id, task)
    return map
  }, [columns])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Reflect the selected project in the URL so a board view can be bookmarked.
  const selectProject = (id: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('project', String(id))
    setSearchParams(next, { replace: true })
  }

  const locate = (id: string | number): { status: TaskStatus; index: number } | null => {
    if (typeof id === 'string' && id.startsWith(COLUMN_PREFIX)) {
      return { status: id.slice(COLUMN_PREFIX.length) as TaskStatus, index: -1 }
    }
    for (const [status, list] of columns) {
      const index = list.findIndex((t) => t.id === Number(id))
      if (index >= 0) return { status, index }
    }
    return null
  }

  const onDragStart = (event: DragStartEvent) => {
    setActiveDrag(taskById.get(Number(event.active.id)) ?? null)
  }

  const onDragOver = (event: DragOverEvent) => {
    const over = event.over
    setOverColumn(over ? (locate(over.id)?.status ?? null) : null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    setOverColumn(null)
    const { active, over } = event
    if (!over) return

    const task = taskById.get(Number(active.id))
    if (!task) return

    const target = locate(over.id)
    if (!target) return

    // Build the target list as it will look after the move.
    const targetList = (columns.get(target.status) ?? []).filter((t) => t.id !== task.id)
    const insertAt = target.index === -1 ? targetList.length : target.index
    const before = targetList[insertAt] ?? null
    const after = targetList[insertAt - 1] ?? null

    if (task.status === target.status && (before?.id === task.id || after?.id === task.id)) return

    const beforeId = before?.id ?? null
    const afterId = after?.id ?? null

    if (target.status === 'done' && task.status !== 'done') {
      setPendingDone({ task, status: 'done', beforeId, afterId })
      return
    }

    commitMove(task, target.status, beforeId, afterId)
  }

  const commitMove = (task: Task, status: TaskStatus, beforeId: number | null, afterId: number | null) => {
    moveTask.mutate(
      { id: task.id, status, beforeId, afterId },
      {
        onError: (err) => toast.error('Could not move that task', { detail: (err as Error).message }),
      },
    )
  }

  // With no projects there is nothing to show in the queues, so offer the one
  // action that matters instead of three empty columns.
  if (projects.length === 0) {
    return (
      <div className="flex h-full min-h-0">
        <ProjectRail selectedId={null} onSelect={selectProject} />
        <main className="flex min-w-0 flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Create your first project</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              A project holds the three queues — to do, ongoing and done — plus every day you log work against
              them.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <NewProjectButton label="New project" onCreated={selectProject} />
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      <ProjectRail selectedId={selectedId} onSelect={selectProject} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 space-y-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-slate-900 dark:text-slate-50">
                {board?.project.name ?? (isLoading ? 'Loading…' : 'No project selected')}
              </h1>
              {board?.project.description && (
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{board.project.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selectedId ? (
                <NewTaskButton projectId={selectedId} />
              ) : (
                <NewProjectButton label="New project" onCreated={selectProject} />
              )}
            </div>
          </div>

          <FilterBar />
          <ActiveFilterChips />
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveDrag(null)
            setOverColumn(null)
          }}
        >
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-x-auto p-5 md:grid-cols-3">
            {COLUMNS.map((meta) => (
              <Column
                key={meta.status}
                {...meta}
                tasks={columns.get(meta.status) ?? []}
                total={board?.columns.find((c) => c.status === meta.status)?.total ?? 0}
                hidden={board?.columns.find((c) => c.status === meta.status)?.hidden ?? 0}
                isOver={overColumn === meta.status && activeDrag !== null}
                isLoading={isLoading}
                filtering={board?.filtered ?? false}
                onOpen={setOpenTask}
                onClearFilters={clear}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {activeDrag && <TaskCard task={activeDrag} onOpen={() => {}} isOverlay />}
          </DragOverlay>
        </DndContext>
      </main>

      <TaskPanel task={openTask} onClose={() => setOpenTask(null)} />

      <Dialog
        open={pendingDone !== null}
        onClose={() => setPendingDone(null)}
        title="Finish and lock this task?"
        description={
          pendingDone
            ? `“${pendingDone.task.title}” moves to Done and becomes read-only. You can unlock it later.`
            : undefined
        }
        footer={
          <>
            <Button onClick={() => setPendingDone(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={complete.isPending}
              onClick={() => {
                if (!pendingDone) return
                const { task, status, beforeId, afterId } = pendingDone
                setPendingDone(null)
                moveTask.mutate(
                  { id: task.id, status, beforeId, afterId },
                  {
                    onSuccess: () =>
                      complete.mutate(task.id, {
                        onSuccess: () => toast.success('Task finished and locked'),
                        onError: () => toast.error('Moved to Done, but could not lock the task'),
                      }),
                    onError: (err) => toast.error('Could not move that task', { detail: (err as Error).message }),
                  },
                )
              }}
            >
              Finish and lock
            </Button>
          </>
        }
      />
    </div>
  )
}

function Column({
  status,
  title,
  hint,
  tasks,
  total,
  hidden,
  isOver,
  isLoading,
  filtering,
  onOpen,
  onClearFilters,
}: {
  status: TaskStatus
  title: string
  hint: string
  tasks: Task[]
  total: number
  hidden: number
  isOver: boolean
  isLoading: boolean
  filtering: boolean
  onOpen: (task: Task) => void
  onClearFilters: () => void
}) {
  const { setNodeRef, isOver: hovering } = useDroppable({ id: `${COLUMN_PREFIX}${status}`, data: { status } })
  const highlighted = isOver || hovering

  return (
    <section className="flex min-h-0 flex-col rounded-xl bg-slate-100/70 dark:bg-slate-900/50">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <StatusDot status={status} />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {tasks.length}
          {filtering && hidden > 0 && <span className="text-slate-400">/{total}</span>}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={`panel-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors ${
          highlighted ? 'rounded-lg bg-indigo-500/10 ring-1 ring-indigo-400/40 ring-inset' : ''
        }`}
      >
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {!isLoading && tasks.length === 0 && (
          <EmptyState
            title={
              filtering && total > 0
                ? 'No matches here'
                : status === 'todo'
                  ? 'Nothing queued'
                  : status === 'ongoing'
                    ? 'Nothing in progress'
                    : 'Nothing finished yet'
            }
            description={filtering && total > 0 ? `${hidden} task${hidden === 1 ? '' : 's'} hidden by the current filters.` : hint}
            action={
              filtering && total > 0 ? (
                <Button size="sm" onClick={onClearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}

        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

function NewTaskButton({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate] = useState('')
  const create = useCreateTask(projectId)
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  const submit = () => {
    if (!title.trim()) return
    create.mutate(
      { title: title.trim(), description: '', priority, due_date: dueDate },
      {
        onSuccess: () => {
          setOpen(false)
          setTitle('')
          setDueDate('')
          setPriority('normal')
          toast.success('Task added to To do')
        },
        onError: () => toast.error('Could not create the task'),
      },
    )
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
          <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        New task
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New task"
        description="It starts in the To do queue. Set a start date from the task to begin work."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={create.isPending} onClick={submit} disabled={!title.trim()}>
              Add task
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            ref={inputRef}
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Task title"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              aria-label="Priority"
              className="h-9 rounded-lg bg-white px-2 text-sm ring-1 ring-slate-300 ring-inset dark:bg-slate-900 dark:ring-slate-700"
            >
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due date" />
          </div>
        </div>
      </Dialog>
    </>
  )
}
