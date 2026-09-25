import { useState } from 'react'
import { Button } from './ui/Button'
import { Field, Input, Textarea } from './ui/Input'
import { Dialog } from './ui/Overlay'
import { useToast } from './ToastProvider'
import { useCreateProject, useUpdateProject } from '../lib/queries'
import type { Project } from '../lib/types'

export const PROJECT_SWATCHES = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#64748b',
]

interface FormState {
  name: string
  description: string
  color: string
}

const EMPTY: FormState = { name: '', description: '', color: PROJECT_SWATCHES[0] }

export function ProjectFormDialog({
  open,
  project,
  onClose,
  onCreated,
}: {
  open: boolean
  project: Project | null
  onClose: () => void
  /** Called with the new project's id after a successful create. */
  onCreated?: (id: number) => void
}) {
  // Keying on the identity remounts the form, so its fields start from the right
  // values without a state-syncing effect.
  const key = project ? `edit-${project.id}` : 'create'
  return (
    <ProjectForm
      key={key}
      open={open}
      project={project}
      onClose={onClose}
      onCreated={onCreated}
      // A fresh colour each time the create dialog is opened.
      initialColor={project ? project.color : PROJECT_SWATCHES[Math.floor(Math.random() * PROJECT_SWATCHES.length)]}
    />
  )
}

function ProjectForm({
  open,
  project,
  onClose,
  onCreated,
  initialColor,
}: {
  open: boolean
  project: Project | null
  onClose: () => void
  onCreated?: (id: number) => void
  initialColor: string
}) {
  const create = useCreateProject()
  const update = useUpdateProject()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() =>
    project ? { name: project.name, description: project.description, color: project.color } : { ...EMPTY, color: initialColor },
  )

  const busy = create.isPending || update.isPending
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = () => {
    const name = form.name.trim()
    if (!name) return
    const input = { name, description: form.description, color: form.color }
    const onError = () => toast.error(project ? 'Could not save the project' : 'Could not create the project')

    if (project) {
      update.mutate(
        { id: project.id, input },
        {
          onSuccess: () => {
            toast.success('Project updated')
            onClose()
          },
          onError,
        },
      )
      return
    }

    create.mutate(input, {
      onSuccess: (created) => {
        toast.success('Project created')
        onClose()
        onCreated?.(created.id)
      },
      onError,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={project ? 'Edit project' : 'New project'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit} disabled={!form.name.trim()}>
            {project ? 'Save' : 'Create project'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="project-name">
          <Input
            id="project-name"
            data-autofocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. Website redesign"
          />
        </Field>

        <Field label="Description" htmlFor="project-description">
          <Textarea
            id="project-description"
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="What is this project about?"
          />
        </Field>

        <Field label="Colour">
          <div className="flex flex-wrap gap-2">
            {PROJECT_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => set('color', swatch)}
                aria-label={`Use colour ${swatch}`}
                aria-pressed={form.color === swatch}
                className={`size-7 rounded-full transition dark:ring-offset-slate-900 ${
                  form.color === swatch ? 'ring-2 ring-ink ring-offset-2 dark:ring-white' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </Field>
      </div>
    </Dialog>
  )
}

/** A self-contained "New project" button that owns its dialog. */
export function NewProjectButton({
  label = 'New project',
  variant = 'primary',
  size = 'md',
  onCreated,
}: {
  label?: string
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md'
  onCreated?: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
          <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {label}
      </Button>
      {open && (
        <ProjectFormDialog
          open
          project={null}
          onClose={() => setOpen(false)}
          onCreated={(id) => {
            onCreated?.(id)
            // Reopening should offer a different colour, so remount the form.
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
