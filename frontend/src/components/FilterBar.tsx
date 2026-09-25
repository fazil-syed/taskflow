import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { useDebounced, useDismissable, useFilters, type DueFilter } from '../lib/filters'
import { useProjects } from '../lib/queries'
import type { TaskPriority, TaskStatus } from '../lib/types'
import { Button, IconButton } from './ui/Button'
import { Input, Select } from './ui/Input'
import { CloseIcon } from './ui/Overlay'
import { PRIORITY_META, PRIORITY_ORDER, ProjectBadge, STATUS_META } from './ui/primitives'

const STATUS_OPTIONS: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'todo', label: 'To do' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'done', label: 'Done' },
]

const PRIORITY_OPTIONS: { value: TaskPriority | ''; label: string }[] = [
  { value: '', label: 'All priorities' },
  ...PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_META[p].label })),
]

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: '', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'Due this week' },
  { value: 'none', label: 'No due date' },
]

export function FilterBar({
  showPriority = true,
  right,
}: {
  /** The calendar deliberately hides the priority filter. */
  showPriority?: boolean
  right?: React.ReactNode
}) {
  const { filters, update, clear, count } = useFilters()
  const { data: projects = [] } = useProjects()
  const [query, setQuery] = useState(filters.q)
  const debounced = useDebounced(query, 250)

  // The search box is not URL-driven while typing; once it settles, commit it.
  // The equality guard makes this a no-op on every other render.
  useEffect(() => {
    if (debounced.trim() !== filters.q) update({ q: debounced })
  }, [debounced, filters.q, update])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
        <svg
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
          <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="pl-9"
        />
      </div>

      <ProjectFilter projects={projects} selected={filters.projects} onChange={(ids) => update({ projects: ids })} />

      <Select
        aria-label="Filter by status"
        value={filters.status}
        onChange={(e) => update({ status: e.target.value as TaskStatus | '' })}
        className="w-auto min-w-[8.5rem]"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      {showPriority && (
        <Select
          aria-label="Filter by priority"
          value={filters.priority}
          onChange={(e) => update({ priority: e.target.value as TaskPriority | '' })}
          className="w-auto min-w-[8.5rem]"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}

      <Select
        aria-label="Filter by due date"
        value={filters.due}
        onChange={(e) => update({ due: e.target.value as DueFilter })}
        className="w-auto min-w-[9rem]"
      >
        {DUE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      {count > 0 && (
        <Button variant="ghost" size="sm" onClick={clear} className="text-slate-500">
          <CloseIcon className="size-3.5" />
          Clear
        </Button>
      )}

      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  )
}

function ProjectFilter({
  projects,
  selected,
  onChange,
}: {
  projects: { id: number; name: string; color: string }[]
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismissable(ref, () => setOpen(false), open)

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        size="md"
        variant={selected.length > 0 ? 'subtle' : 'secondary'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {selected.length === 0
          ? 'All projects'
          : selected.length === 1
            ? (projects.find((p) => p.id === selected[0])?.name ?? '1 project')
            : `${selected.length} projects`}
        <svg viewBox="0 0 20 20" className="size-3.5 opacity-60" fill="none" aria-hidden>
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>

      {open && (
        <div
          role="listbox"
          className="animate-pop absolute z-30 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
        >
          {projects.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">No projects yet</p>}
          {projects.map((project) => {
            const isSelected = selected.includes(project.id)
            return (
              <button
                key={project.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(project.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                  'hover:bg-slate-100 dark:hover:bg-slate-700/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border',
                    isSelected
                      ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
                      : 'border-slate-300 dark:border-slate-600',
                  )}
                >
                  {isSelected && (
                    <svg viewBox="0 0 12 12" className="size-3 text-white" fill="none" aria-hidden>
                      <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <ProjectBadge name={project.name} color={project.color} />
              </button>
            )
          })}
          {selected.length > 0 && (
            <>
              <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
              <button
                onClick={() => onChange([])}
                className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60"
              >
                Clear project filter
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** The row of removable chips describing what is currently filtered. */
export function ActiveFilterChips() {
  const { filters, update, clear } = useFilters()
  const { data: projects = [] } = useProjects()
  if (filters.projects.length === 0 && !filters.status && !filters.priority && !filters.due && !filters.q) {
    return null
  }

  const chips: { key: string; label: string; onRemove: () => void }[] = []

  for (const id of filters.projects) {
    const project = projects.find((p) => p.id === id)
    chips.push({
      key: `project-${id}`,
      label: project?.name ?? `Project ${id}`,
      onRemove: () => update({ projects: filters.projects.filter((x) => x !== id) }),
    })
  }
  if (filters.status) {
    chips.push({
      key: 'status',
      label: STATUS_META[filters.status].label,
      onRemove: () => update({ status: '' }),
    })
  }
  if (filters.priority) {
    chips.push({
      key: 'priority',
      label: `${PRIORITY_META[filters.priority].label} priority`,
      onRemove: () => update({ priority: '' }),
    })
  }
  if (filters.due) {
    chips.push({
      key: 'due',
      label: DUE_OPTIONS.find((o) => o.value === filters.due)?.label ?? filters.due,
      onRemove: () => update({ due: '' }),
    })
  }
  if (filters.q) {
    chips.push({ key: 'q', label: `“${filters.q}”`, onRemove: () => update({ q: '' }) })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full bg-slate-200 py-0.5 pr-1 pl-2.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {chip.label}
          <IconButton
            label={`Remove ${chip.label} filter`}
            size="sm"
            onClick={chip.onRemove}
            className="size-5 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700"
          >
            <CloseIcon className="size-3" />
          </IconButton>
        </span>
      ))}
      <button
        onClick={clear}
        className="rounded-full px-2 py-0.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Clear all
      </button>
    </div>
  )
}
