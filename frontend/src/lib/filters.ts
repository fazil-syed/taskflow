import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { TaskPriority, TaskStatus } from './types'

export type DueFilter = '' | 'overdue' | 'week' | 'none'

export interface Filters {
  projects: number[]
  status: TaskStatus | ''
  priority: TaskPriority | ''
  due: DueFilter
  q: string
}

export const EMPTY_FILTERS: Filters = {
  projects: [],
  status: '',
  priority: '',
  due: '',
  q: '',
}

export function filtersActive(f: Filters): boolean {
  return f.projects.length > 0 || f.status !== '' || f.priority !== '' || f.due !== '' || f.q.trim() !== ''
}

export function countActiveFilters(f: Filters): number {
  return (
    (f.projects.length > 0 ? 1 : 0) +
    (f.status ? 1 : 0) +
    (f.priority ? 1 : 0) +
    (f.due ? 1 : 0) +
    (f.q.trim() ? 1 : 0)
  )
}

const FILTER_KEYS = ['projects', 'status', 'priority', 'due', 'q'] as const

function parse(params: URLSearchParams): Filters {
  const raw = params.get('projects')
  return {
    projects: raw ? raw.split(',').filter(Boolean).map(Number) : [],
    status: (params.get('status') ?? '') as TaskStatus | '',
    priority: (params.get('priority') ?? '') as TaskPriority | '',
    due: (params.get('due') ?? '') as DueFilter,
    q: params.get('q') ?? '',
  }
}

/**
 * Writes the filter keys onto a copy of the current params, leaving every other
 * key alone. Replacing the whole query string would silently drop things like
 * `?project=`, which the board relies on to know which project is open.
 */
function serialize(current: URLSearchParams, f: Filters): URLSearchParams {
  const params = new URLSearchParams(current)
  for (const key of FILTER_KEYS) params.delete(key)

  if (f.projects.length) params.set('projects', f.projects.join(','))
  if (f.status) params.set('status', f.status)
  if (f.priority) params.set('priority', f.priority)
  if (f.due) params.set('due', f.due)
  if (f.q.trim()) params.set('q', f.q.trim())
  return params
}

/**
 * Filter state lives in the URL so a view can be bookmarked and the back button
 * steps through filter changes. The free-text box is kept out of the URL while
 * typing and committed once it settles.
 */
export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parse(searchParams), [searchParams])

  const commit = useCallback(
    (next: Filters) => {
      setSearchParams(serialize(searchParams, next), { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const update = useCallback(
    (patch: Partial<Filters>) => {
      commit({ ...filters, ...patch })
    },
    [commit, filters],
  )

  const clear = useCallback(() => {
    // Only the filters are removed; anything else in the URL is left in place.
    setSearchParams(serialize(searchParams, { ...EMPTY_FILTERS, q: '' }), { replace: true })
  }, [searchParams, setSearchParams])

  return { filters, update, clear, active: filtersActive(filters), count: countActiveFilters(filters) }
}

/** Delays a rapidly changing value, e.g. the search box. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Calls `handler` on Escape and on a click outside the ref. */
export function useDismissable(ref: React.RefObject<HTMLElement | null>, handler: () => void, active = true) {
  const saved = useRef(handler)
  useEffect(() => {
    saved.current = handler
  }, [handler])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') saved.current()
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) saved.current()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [ref, active])
}
