import { useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../lib/cn'
import { useDismissable } from '../lib/filters'
import { useArchiveProject, useDeleteProject, useProjects, useReorderProjects } from '../lib/queries'
import type { Project } from '../lib/types'
import { Button, IconButton } from './ui/Button'
import { Dialog } from './ui/Overlay'
import { ProjectFormDialog } from './ProjectDialog'
import { useToast } from './ToastProvider'

export function ProjectRail({
  selectedId,
  onSelect,
}: {
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const { data: projects = [], isLoading } = useProjects()
  const toast = useToast()
  const reorder = useReorderProjects()
  const [editing, setEditing] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null)
  const deleteProject = useDeleteProject()
  const archiveProject = useArchiveProject()
  const menuRef = useRef<HTMLDivElement>(null)
  useDismissable(menuRef, () => setMenuFor(null), menuFor !== null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const ids = projects.map((p) => p.id)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = ids.indexOf(Number(active.id))
    const to = ids.indexOf(Number(over.id))
    if (from < 0 || to < 0) return
    const next = [...projects]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    // Re-number 0..n-1; the server stores whatever we send.
    reorder.mutate(
      next.map((p, i) => ({ id: p.id, sort_order: i })),
      { onError: () => toast.error('Could not save the new project order') },
    )
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-elevated/60 dark:bg-surface/40">
      <div className="flex items-center justify-between px-3 py-3">
        <h2 className="text-xs font-semibold tracking-wider text-ink-faint uppercase dark:text-ink-soft">Projects</h2>
        <IconButton label="New project" size="sm" onClick={() => setCreating(true)}>
          <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
            <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </IconButton>
      </div>

      <div ref={menuRef} className="panel-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading && (
          <div className="space-y-1.5 px-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-strong dark:bg-elevated" />
            ))}
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-faint dark:text-ink-soft">
            No projects yet. Create one to start tracking work.
          </p>
        )}

        {projects.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="space-y-0.5">
                {projects.map((project) => (
                  <RailItem
                    key={project.id}
                    project={project}
                    selected={project.id === selectedId}
                    onSelect={() => onSelect(project.id)}
                    menuOpen={menuFor === project.id}
                    onToggleMenu={() => setMenuFor(menuFor === project.id ? null : project.id)}
                    onEdit={() => {
                      setEditing(project)
                      setMenuFor(null)
                    }}
                    onArchive={() => {
                      archiveProject.mutate(
                        { id: project.id, archived: !project.archived_at },
                        {
                          onSuccess: () => toast.success(project.archived_at ? 'Project restored' : 'Project archived'),
                          onError: () => toast.error('Could not update the project'),
                        },
                      )
                      setMenuFor(null)
                    }}
                    onDelete={() => {
                      setConfirmDelete(project)
                      setMenuFor(null)
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <ProjectFormDialog
        open={creating || editing !== null}
        project={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onCreated={onSelect}
      />

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this project?"
        description={
          confirmDelete
            ? `“${confirmDelete.name}” and all ${confirmDelete.task_count} task${confirmDelete.task_count === 1 ? '' : 's'} in it will be deleted permanently.`
            : undefined
        }
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleteProject.isPending}
              onClick={() =>
                confirmDelete &&
                deleteProject.mutate(confirmDelete.id, {
                  onSuccess: () => {
                    toast.success('Project deleted')
                    setConfirmDelete(null)
                  },
                  onError: () => toast.error('Could not delete this project'),
                })
              }
            >
              Delete
            </Button>
          </>
        }
      />
    </aside>
  )
}

function RailItem({
  project,
  selected,
  onSelect,
  menuOpen,
  onToggleMenu,
  onEdit,
  onArchive,
  onDelete,
}: {
  project: Project
  selected: boolean
  onSelect: () => void
  menuOpen: boolean
  onToggleMenu: () => void
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('group relative', isDragging && 'z-10 opacity-50')}
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg pr-1 transition-colors',
          selected
            ? 'bg-white shadow-sm ring-1 ring-line dark:bg-elevated dark:ring-line-strong'
            : 'hover:bg-strong/60 dark:hover:bg-elevated/60',
        )}
      >
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${project.name}`}
          className="ml-1 flex h-8 w-4 cursor-grab items-center justify-center text-ink-faint opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
        >
          <svg viewBox="0 0 12 16" className="size-2.5" fill="currentColor" aria-hidden>
            <circle cx="4" cy="3" r="1.3" />
            <circle cx="8" cy="3" r="1.3" />
            <circle cx="4" cy="8" r="1.3" />
            <circle cx="8" cy="8" r="1.3" />
            <circle cx="4" cy="13" r="1.3" />
            <circle cx="8" cy="13" r="1.3" />
          </svg>
        </button>

        <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: project.color }} />
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm',
              selected ? 'font-semibold text-ink dark:text-ink' : 'text-ink-soft dark:text-ink-soft',
            )}
          >
            {project.name}
          </span>
          {project.open_count > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
                selected
                  ? 'bg-elevated text-ink-soft dark:bg-strong dark:text-ink-soft'
                  : 'bg-strong/70 text-ink-faint dark:bg-elevated dark:text-ink-soft',
              )}
              title={`${project.open_count} open of ${project.task_count} tasks`}
            >
              {project.open_count}
            </span>
          )}
        </button>

        <IconButton
          label={`${project.name} options`}
          size="sm"
          onClick={onToggleMenu}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[open=true]:opacity-100"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="16" r="1.5" />
          </svg>
        </IconButton>
      </div>

      {menuOpen && (
        <div className="animate-pop absolute top-9 right-1 z-30 w-40 rounded-xl bg-white p-1 shadow-lg ring-1 ring-line dark:bg-elevated dark:ring-line-strong">
          <MenuItem onClick={onEdit}>Edit details</MenuItem>
          <MenuItem onClick={onArchive}>{project.archived_at ? 'Restore project' : 'Archive project'}</MenuItem>
          <div className="my-1 h-px bg-strong" />
          <MenuItem onClick={onDelete} danger>
            Delete
          </MenuItem>
        </div>
      )}
    </li>
  )
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
          : 'text-ink-soft hover:bg-elevated dark:text-ink dark:hover:bg-strong',
      )}
    >
      {children}
    </button>
  )
}
