export type TaskStatus = 'todo' | 'ongoing' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Project {
  id: number
  name: string
  description: string
  color: string
  sort_order: number
  archived_at: string | null
  task_count: number
  open_count: number
}

export interface ProjectDetail {
  id: number
  name: string
  description: string
  color: string
  sort_order: number
  archived_at: string | null
  created_at: string
}

export interface Task {
  id: number
  project_id: number
  project_name?: string
  project_color?: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  start_date: string | null
  completed_at: string | null
  locked: boolean
  sort_order: number
  work_day_count: number
  work_days?: string[]
  work_day_notes?: Record<string, string>
  created_at: string
  updated_at: string
}

export interface BoardColumn {
  status: TaskStatus
  total: number
  hidden: number
  is_locked: boolean
  tasks: Task[]
}

export interface Board {
  project: ProjectDetail
  columns: BoardColumn[]
  filtered: boolean
}

export interface CalendarEntry {
  task_id: number
  title: string
  status: TaskStatus
  priority: TaskPriority
  locked: boolean
  project_id: number
  project_name: string
  project_color: string
}

export interface CalendarDay {
  date: string
  total: number
  tasks: CalendarEntry[]
  counts: Record<TaskStatus, number>
}

export interface CalendarResponse {
  from: string
  to: string
  days: CalendarDay[]
}

export interface ApiErrorBody {
  error: { code: string; message: string }
}
