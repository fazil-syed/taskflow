import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { cardVariants } from '../lib/motion'
import type { Task } from '../lib/types'
import { DueBadge, LockIcon, PriorityFlag, StatusDot, WorkDayStrip } from './ui/primitives'

export const TaskCard = memo(function TaskCard({
  task,
  onOpen,
  showStatus = false,
  isOverlay = false,
  draggable = true,
  index = 0,
}: {
  task: Task
  onOpen: (task: Task) => void
  showStatus?: boolean
  /** True while rendering the drag preview, where the sortable hook is skipped. */
  isOverlay?: boolean
  draggable?: boolean
  /** Position in the queue, used to stagger the entry animation. */
  index?: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !draggable || isOverlay || task.locked,
  })

  const canDrag = draggable && !isOverlay && !task.locked

  return (
    // The outer element animates position when a card lands in a different
    // queue; the inner one carries the dnd-kit drag offset. Keeping them
    // separate stops the two transform systems from fighting.
    <motion.div
      // No `layout` here on purpose: Framer's layout engine and dnd-kit both
      // drive transforms on the same cards, and the layout pass wins often
      // enough to break the drag's hit-testing. dnd-kit already animates
      // reordering, and the enter/exit variants cover queue changes.
      initial={isOverlay ? false : 'hidden'}
      animate="visible"
      exit="exit"
      variants={cardVariants}
      transition={{ delay: isOverlay ? 0 : Math.min(index, 8) * 0.022 }}
      className={cn(isDragging && 'z-10')}
    >
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Translate.toString(transform),
          transition,
          // Keeps touch scrolling working in the column while still letting the
          // pointer sensor track a drag.
          touchAction: 'manipulation',
        }}
        className={cn(
          // select-none stops a text selection starting under the pointer and
          // cancelling the drag mid-gesture.
          'group relative select-none rounded-xl',
          canDrag && 'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-40',
        )}
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
      >
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={cn(
            'w-full rounded-xl border border-line bg-surface p-3 text-left shadow-xs transition-colors',
            'hover:border-line-strong hover:shadow-sm',
            'dark:bg-elevated dark:hover:border-line-strong',
            task.locked && 'border-dashed bg-canvas dark:bg-surface',
            isOverlay && 'rotate-2 shadow-lg',
          )}
        >
          <div className="flex items-start gap-2">
            {showStatus && <StatusDot status={task.status} className="mt-1.5" />}
            <p
              className={cn(
                'min-w-0 flex-1 text-sm leading-snug font-medium text-ink',
                task.status === 'done' && !task.locked && 'text-ink-soft',
              )}
            >
              {task.title}
            </p>
            {task.locked && <LockIcon className="mt-0.5 shrink-0 text-ink-faint" />}
            <PriorityFlag priority={task.priority} />
          </div>

          {(task.due_date || task.work_day_count > 0) && (
            <div className={cn('mt-2 flex flex-wrap items-center gap-2', showStatus ? 'pl-4' : '')}>
              {task.due_date && <DueBadge date={task.due_date} done={task.status === 'done'} />}
              {task.work_day_count > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                  <WorkDayStrip days={task.work_days ?? []} />
                  {task.work_day_count} day{task.work_day_count === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}
        </button>

        {canDrag && (
          // A purely visual hint. It must not capture pointer events, otherwise
          // it would become the only working drag target.
          <span
            aria-hidden
            className="pointer-events-none absolute top-2 -left-1 flex size-5 items-center justify-center rounded-md text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
          >
            <svg viewBox="0 0 12 16" className="size-2" fill="currentColor">
              <circle cx="4" cy="3" r="1.4" />
              <circle cx="8" cy="3" r="1.4" />
              <circle cx="4" cy="8" r="1.4" />
              <circle cx="8" cy="8" r="1.4" />
              <circle cx="4" cy="13" r="1.4" />
              <circle cx="8" cy="13" r="1.4" />
            </svg>
          </span>
        )}
      </div>
    </motion.div>
  )
})
