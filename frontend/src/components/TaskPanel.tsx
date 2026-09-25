import { useMemo, useState } from 'react'
import { ApiError } from '../lib/api'
import { cn } from '../lib/cn'
import { firstOfMonth, formatDate, today, type DateOnly } from '../lib/dates'
import { useToast } from './ToastProvider'
import {
  useAddWorkDay,
  useCompleteTask,
  useLockTask,
  useDeleteTask,
  useRemoveWorkDay,
  useSetTaskStatus,
  useStartTask,
  useUnlockTask,
  useUpdateTask,
} from '../lib/queries'
import type { Task, TaskPriority, TaskStatus } from '../lib/types'
import { Button } from './ui/Button'
import { Field, Input, Select, Textarea } from './ui/Input'
import { Dialog, Drawer } from './ui/Overlay'
import { LockIcon, PRIORITY_META, PRIORITY_ORDER, StatusPill } from './ui/primitives'
import { MonthGrid, QuickDayButtons } from './MonthGrid'

const STATUS_FLOW: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'done', label: 'Done' },
]

export function TaskPanel({ task, onClose }: { task: Task | null; onClose: () => void }) {
  if (!task) return null
  // Keying on the id remounts the body for each task, so the form fields start
  // from that task's values with no syncing effect.
  return <TaskPanelBody key={task.id} task={task} onClose={onClose} />
}

function TaskPanelBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const toast = useToast()
  const update = useUpdateTask()
  const start = useStartTask()
  const setStatus = useSetTaskStatus()
  const complete = useCompleteTask()
  const lock = useLockTask()
  const unlock = useUnlockTask()
  const remove = useDeleteTask()
  const addWorkDay = useAddWorkDay()
  const removeWorkDay = useRemoveWorkDay()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [month, setMonth] = useState<DateOnly>(() => firstOfMonth(today()))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDone, setConfirmDone] = useState(false)

  const workDays = useMemo(() => new Set(task.work_days ?? []), [task])
  const locked = task.locked

  const reportError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.isLocked) {
      toast.error('This task is locked', { detail: 'Unlock it to make changes.' })
    } else {
      toast.error(fallback, { detail: err instanceof Error ? err.message : undefined })
    }
  }

  const saveFields = () => {
    if (!title.trim()) {
      setTitle(task.title)
      return
    }
    if (
      title === task.title &&
      description === task.description &&
      priority === task.priority &&
      dueDate === (task.due_date ?? '')
    ) {
      return
    }
    update.mutate(
      { id: task.id, input: { title: title.trim(), description, priority, due_date: dueDate } },
      { onError: (err) => reportError(err, 'Could not save changes') },
    )
  }

  const moveTo = (status: TaskStatus) => {
    if (status === task.status) return
    if (status === 'ongoing' && task.status === 'todo') {
      start.mutate(
        { id: task.id, startDate: today() },
        {
          onSuccess: () => toast.success('Task started'),
          onError: (err) => reportError(err, 'Could not start this task'),
        },
      )
      return
    }
    if (status === 'done') {
      setConfirmDone(true)
      return
    }
    setStatus.mutate(
      { id: task.id, status },
      { onError: (err) => reportError(err, 'Could not move this task') },
    )
  }

  const toggleWorkDay = (date: DateOnly) => {
    if (workDays.has(date)) {
      removeWorkDay.mutate(
        { id: task.id, date },
        { onError: (err) => reportError(err, 'Could not remove that day') },
      )
    } else {
      addWorkDay.mutate(
        { id: task.id, workDate: date },
        { onError: (err) => reportError(err, 'Could not log that day') },
      )
    }
  }

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            <StatusPill status={task.status} />
            {locked && <LockIcon className="text-ink-faint" />}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Started {formatDate(task.start_date)} · {task.work_day_count} day{task.work_day_count === 1 ? '' : 's'} logged
            {task.completed_at && ` · completed ${formatDate(task.completed_at.slice(0, 10))}`}
          </span>
        }
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {!locked && (
              <Button variant="primary" onClick={saveFields} loading={update.isPending}>
                Save changes
              </Button>
            )}
          </>
        }
      >
        {locked && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-line bg-canvas p-3.5 dark:border-line-strong dark:bg-elevated/60">
            <LockIcon className="mt-0.5 shrink-0 text-ink-faint" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Finished and locked</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                Everything about this task is read-only until you unlock it.
              </p>
              <Button
                size="sm"
                className="mt-2.5"
                loading={unlock.isPending}
                onClick={() =>
                  unlock.mutate(task.id, {
                    onSuccess: () => toast.success('Task unlocked'),
                    onError: (err) => reportError(err, 'Could not unlock this task'),
                  })
                }
              >
                Unlock to edit
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-5">
          <Field label="Title" htmlFor="task-title">
            <Input
              id="task-title"
              data-autofocus
              value={title}
              disabled={locked}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveFields}
              placeholder="What needs doing?"
            />
          </Field>

          <Field label="Description" htmlFor="task-description">
            <Textarea
              id="task-description"
              rows={7}
              value={description}
              disabled={locked}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveFields}
              placeholder="Context, notes, links, acceptance criteria…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority" htmlFor="task-priority">
              <Select
                id="task-priority"
                value={priority}
                disabled={locked}
                onChange={(e) => {
                  const next = e.target.value as TaskPriority
                  setPriority(next)
                  update.mutate(
                    { id: task.id, input: { title: title.trim(), description, priority: next, due_date: dueDate } },
                    { onError: (err) => reportError(err, 'Could not change priority') },
                  )
                }}
              >
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Due date" htmlFor="task-due">
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                disabled={locked}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  update.mutate(
                    { id: task.id, input: { title: title.trim(), description, priority, due_date: e.target.value } },
                    { onError: (err) => reportError(err, 'Could not change the due date') },
                  )
                }}
              />
            </Field>
          </div>

          <Field label="Queue">
            <div className="flex rounded-lg bg-elevated p-0.5">
              {STATUS_FLOW.map((s) => {
                const isCurrent = task.status === s.value
                return (
                  <button
                    key={s.value}
                    disabled={locked && s.value !== 'done'}
                    onClick={() => moveTo(s.value)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
                      isCurrent
                        ? 'bg-white text-ink shadow-sm dark:bg-strong dark:text-ink'
                        : 'text-ink-soft hover:text-ink dark:text-ink-soft dark:hover:text-ink',
                    )}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* A finished task can be unlocked to make corrections, and locked
              again afterwards. Without this there is no way back. */}
          {task.status === 'done' && !locked && (
            <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3.5">
              <LockIcon className="mt-0.5 shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">Finished, but unlocked</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  This task is editable. Lock it again to make it read-only.
                </p>
                <Button
                  size="sm"
                  className="mt-2.5"
                  loading={lock.isPending}
                  onClick={() =>
                    lock.mutate(task.id, {
                      onSuccess: () => toast.success('Task locked again'),
                      onError: (err) => reportError(err, 'Could not lock this task'),
                    })
                  }
                >
                  <LockIcon className="size-3.5" />
                  Lock again
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-line pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Days worked</h3>
              <span className="text-xs text-ink-faint dark:text-ink-soft">{task.work_day_count} total</span>
            </div>

            {task.status === 'todo' ? (
              <p className="rounded-lg bg-canvas p-3 text-sm text-ink-faint dark:bg-elevated/60 dark:text-ink-soft">
                Start this task to begin logging the days you work on it.
              </p>
            ) : (
              <>
                <QuickDayButtons onPick={toggleWorkDay} disabled={locked} />
                <MonthGrid
                  className="mt-3"
                  month={month}
                  onMonthChange={setMonth}
                  selected={workDays}
                  onToggle={locked ? undefined : toggleWorkDay}
                  interactive={!locked}
                />
                {task.work_day_count > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {[...workDays]
                      .sort()
                      .reverse()
                      .slice(0, 12)
                      .map((date) => (
                        <span
                          key={date}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                        >
                          {formatDate(date)}
                        </span>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-line pt-5">
            <Button variant="danger" size="sm" disabled={locked} onClick={() => setConfirmDelete(true)}>
              Delete task
            </Button>
            {locked && <p className="mt-2 text-xs text-ink-faint">Unlock the task to delete it.</p>}
          </div>
        </div>
      </Drawer>

      <Dialog
        open={confirmDone}
        onClose={() => setConfirmDone(false)}
        title="Finish and lock this task?"
        description="It moves to Done and becomes read-only. You can unlock it later if something changes."
        footer={
          <>
            <Button onClick={() => setConfirmDone(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={complete.isPending}
              onClick={() =>
                complete.mutate(task.id, {
                  onSuccess: () => {
                    setConfirmDone(false)
                    toast.success('Task finished and locked')
                  },
                  onError: (err) => reportError(err, 'Could not finish this task'),
                })
              }
            >
              Finish and lock
            </Button>
          </>
        }
      />

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this task?"
        description={`“${task.title}” and its logged work days will be removed permanently.`}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { id: task.id, force: locked },
                  {
                    onSuccess: () => {
                      setConfirmDelete(false)
                      onClose()
                      toast.success('Task deleted')
                    },
                    onError: (err) => reportError(err, 'Could not delete this task'),
                  },
                )
              }
            >
              Delete
            </Button>
          </>
        }
      />
    </>
  )
}
