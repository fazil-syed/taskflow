import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../lib/cn'
import type { Task } from '../lib/types'
import { DueBadge, LockIcon, PriorityFlag, StatusDot, WorkDayStrip } from './ui/primitives'

export const TaskCard = memo(function TaskCard({
  task,
  onOpen,
  showStatus = false,
  isOverlay = false,
  draggable = true,
  dragHandleProps,
  style,
}: {
  task: Task
  onOpen: (task: Task) => void
  showStatus?: boolean
  /** True while rendering the drag preview, so the hook-based sortable is skipped. */
  isOverlay?: boolean
  draggable?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  style?: React.CSSProperties
}) {
  return (
    <CardBody
      task={task}
      onOpen={onOpen}
      showStatus={showStatus}
      isOverlay={isOverlay}
      draggable={draggable}
      dragHandleProps={dragHandleProps}
      style={style}
    />
  )
})

function CardBody({
  task,
  onOpen,
  showStatus,
  isOverlay,
  draggable,
  dragHandleProps,
  style,
}: {
  task: Task
  onOpen: (task: Task) => void
  showStatus: boolean
  isOverlay?: boolean
  draggable: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  style?: React.CSSProperties
}) {
  const sortable = useSortable({ id: task.id, disabled: !draggable || isOverlay || task.locked })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, transform: CSS.Translate.toString(transform), transition }}
      className={cn('group relative', isDragging && 'z-10 opacity-40')}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(task)
          }
        }}
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xs transition',
            'hover:border-slate-300 hover:shadow-sm',
            'dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700',
          task.locked && 'border-dashed border-slate-300 bg-slate-50/70 dark:border-slate-700/70 dark:bg-slate-900/50',
          isOverlay && 'rotate-2 shadow-lg',
        )}
      >
        <div className="flex items-start gap-2">
          {showStatus && <StatusDot status={task.status} className="mt-1.5" />}
          <p
            className={cn(
              'min-w-0 flex-1 text-sm leading-snug font-medium text-slate-800 dark:text-slate-100',
              task.status === 'done' && !task.locked && 'text-slate-500 dark:text-slate-400',
            )}
          >
            {task.title}
          </p>
          {task.locked && <LockIcon className="mt-0.5 shrink-0 text-slate-400" />}
          <PriorityFlag priority={task.priority} />
        </div>

        {(task.due_date || task.work_day_count > 0) && (
          <div className={cn('mt-2 flex flex-wrap items-center gap-2', showStatus ? 'pl-4' : '')}>
            {task.due_date && <DueBadge date={task.due_date} done={task.status === 'done'} />}
            {task.work_day_count > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <WorkDayStrip days={task.work_days ?? []} />
                {task.work_day_count} day{task.work_day_count === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </button>

      {draggable && !task.locked && !isOverlay && (
        <button
          type="button"
          aria-label={`Reorder ${task.title}`}
          className={cn(
            'absolute top-1.5 -left-1 flex size-6 cursor-grab items-center justify-center rounded-md text-slate-300',
            'opacity-0 transition group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-500',
            'focus-visible:opacity-100 active:cursor-grabbing dark:text-slate-600 dark:hover:bg-slate-700',
          )}
          {...attributes}
          {...listeners}
          {...dragHandleProps}
        >
          <svg viewBox="0 0 12 16" className="size-2.5" fill="currentColor" aria-hidden>
            <circle cx="4" cy="3" r="1.4" />
            <circle cx="8" cy="3" r="1.4" />
            <circle cx="4" cy="8" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="4" cy="13" r="1.4" />
            <circle cx="8" cy="13" r="1.4" />
          </svg>
        </button>
      )}
    </div>
  )
}
