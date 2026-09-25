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

function parse(raw: string | null): Filters {
  return {
    projects: raw ? raw.split(',').filter(Boolean).map(Number) : [],
    status: (raw ?? '') as TaskStatus | '',
    priority: (raw ?? '') as TaskPriority | '',
    due: (raw ?? '') as DueFilter,
    q: '',
  }
}

function serialize(f: Filters): URLSearchParams {
  const params = new URLSearchParams()
  if (f.projects.length) params.set('projects', f.projects.join(','))
  if (f.status) params.set('status', f.status)
  if (f.priority) params.set('priority', f.priority)
  if (f.due) params.set('due', f.due)
  return params
}

/**
 * Filter state lives in the URL so a view can be bookmarked and the back button
 * steps through filter changes. The free-text box is kept out of the URL (it
 * would spam history) and read from `?q=` on first mount only.
 */
export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(
    () => ({ ...parse(searchParams.get('projects')), q: searchParams.get('q') ?? '' }),
    [searchParams],
  )

  const commit = useCallback(
    (next: Filters, opts: { replace?: boolean } = {}) => {
      const params = serialize(next)
      if (next.q.trim()) params.set('q', next.q.trim())
      setSearchParams(params, { replace: opts.replace ?? true })
    },
    [setSearchParams],
  )

  const update = useCallback(
    (patch: Partial<Filters>) => {
      commit({ ...filters, ...patch })
    },
    [commit, filters],
  )

  const clear = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

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
