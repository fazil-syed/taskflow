import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Board, CalendarResponse, Project, ProjectDetail, Task, TaskPriority, TaskStatus } from './types'
import type { Filters } from './filters'
import { EMPTY_FILTERS } from './filters'

export const keys = {
  projects: (includeArchived = false) => ['projects', { includeArchived }] as const,
  board: (projectId: number, filters: Filters) => ['board', projectId, filters] as const,
  task: (id: number) => ['task', id] as const,
  tasks: (filters: Filters) => ['tasks', filters] as const,
  calendar: (from: string, to: string, filters: Filters) => ['calendar', from, to, filters] as const,
}

function projectIds(f: Filters) {
  return f.projects.map(String)
}

export function useProjects(includeArchived = false) {
  return useQuery({
    queryKey: keys.projects(includeArchived),
    queryFn: () => api.get<Project[]>('/api/projects', { include_archived: includeArchived ? 1 : 0 }),
    staleTime: 15_000,
  })
}

export function useBoard(projectId: number | null, filters: Filters) {
  return useQuery({
    queryKey: keys.board(projectId ?? -1, filters),
    queryFn: () =>
      api.get<Board>(`/api/projects/${projectId}/board`, {
        project_id: projectIds(filters),
        status: filters.status,
        priority: filters.priority,
        due: filters.due,
        q: filters.q,
      }),
    enabled: projectId !== null,
    // Filters are user-driven, so showing stale cards while refetching is worse
    // than a brief skeleton.
    placeholderData: (prev) => (prev?.project.id === projectId ? prev : undefined),
  })
}

export function useTasks(filters: Filters) {
  return useQuery({
    queryKey: keys.tasks(filters),
    queryFn: () =>
      api.get<Task[]>('/api/tasks', {
        project_id: projectIds(filters),
        status: filters.status,
        priority: filters.priority,
        due: filters.due,
        q: filters.q,
      }),
    placeholderData: (prev) => prev,
  })
}

export function useCalendar(from: string, to: string, filters: Filters) {
  // The calendar intentionally ignores the priority filter: a heatmap answers
  // "where did the work happen", not "how urgent was it".
  const effective: Filters = { ...filters, priority: '' }
  return useQuery({
    queryKey: keys.calendar(from, to, effective),
    queryFn: () =>
      api.get<CalendarResponse>('/api/calendar', {
        from,
        to,
        project_id: projectIds(effective),
        status: effective.status,
        q: effective.q,
      }),
    placeholderData: (prev) => prev,
  })
}

export function useTask(id: number | null) {
  return useQuery({
    queryKey: keys.task(id ?? -1),
    queryFn: () => api.get<Task>(`/api/tasks/${id}`),
    enabled: id !== null,
  })
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

export interface TaskInput {
  title: string
  description: string
  priority: TaskPriority
  due_date: string
}

function useInvalidate() {
  const qc = useQueryClient()
  return (taskId?: number) => {
    void qc.invalidateQueries({ queryKey: ['projects'] })
    void qc.invalidateQueries({ queryKey: ['board'] })
    void qc.invalidateQueries({ queryKey: ['tasks'] })
    void qc.invalidateQueries({ queryKey: ['calendar'] })
    if (taskId !== undefined) {
      qc.setQueryData<Task>(keys.task(taskId), (prev) =>
        prev ? { ...prev, updated_at: new Date().toISOString() } : prev,
      )
      void qc.invalidateQueries({ queryKey: keys.task(taskId) })
    }
  }
}

export function useCreateTask(projectId: number) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: TaskInput) => api.post<Task>(`/api/projects/${projectId}/tasks`, input),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TaskInput }) => api.patch<Task>(`/api/tasks/${id}`, input),
    onSuccess: (task) => invalidate(task.id),
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, force }: { id: number; force?: boolean }) => api.delete<void>(`/api/tasks/${id}`, force ? { force: 1 } : undefined),
    onSuccess: (_, vars) => invalidate(vars.id),
  })
}

export function useMoveTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      id,
      status,
      beforeId,
      afterId,
    }: {
      id: number
      status: TaskStatus
      beforeId?: number | null
      afterId?: number | null
    }) => api.post<Task>(`/api/tasks/${id}/move`, { status, before_id: beforeId ?? null, after_id: afterId ?? null }),
    onSuccess: (task) => invalidate(task.id),
  })
}

export function useStartTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, startDate }: { id: number; startDate?: string }) =>
      api.post<Task>(`/api/tasks/${id}/start`, { start_date: startDate ?? '' }),
    onSuccess: (task) => invalidate(task.id),
  })
}

export function useSetTaskStatus() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) => api.post<Task>(`/api/tasks/${id}/status`, { status }),
    onSuccess: (task) => invalidate(task.id),
  })
}

export function useCompleteTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.post<Task>(`/api/tasks/${id}/complete`),
    onSuccess: (task) => invalidate(task.id),
  })
}

export function useUnlockTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.post<Task>(`/api/tasks/${id}/unlock`),
    onSuccess: (task) => invalidate(task.id),
  })
}

export function useLockTask() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.post<Task>(`/api/tasks/${id}/lock`),
    onSuccess: (task) => invalidate(task.id),
  })
}

export function useAddWorkDay() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, workDate, note }: { id: number; workDate: string; note?: string }) =>
      api.post<Task>(`/api/tasks/${id}/work-days`, { work_date: workDate, note: note ?? '' }),
    onSuccess: (task) => invalidate(task.id),
  })
}

export function useRemoveWorkDay() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) => api.delete<Task>(`/api/tasks/${id}/work-days/${date}`),
    onSuccess: (task) => invalidate(task.id),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; description: string; color: string }) => api.post<ProjectDetail>('/api/projects', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: { name: string; description: string; color: string } }) =>
      api.patch<ProjectDetail>(`/api/projects/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/api/projects/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useArchiveProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, archived }: { id: number; archived: boolean }) => api.post<ProjectDetail>(`/api/projects/${id}/archive`, { archived }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useReorderProjects() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { id: number; sort_order: number }[]) => api.post<Project[]>('/api/projects/reorder', items),
    onSuccess: (projects) => qc.setQueryData(keys.projects(false), projects),
  })
}

export { EMPTY_FILTERS }
