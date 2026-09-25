import { useState } from 'react'
import { useToast } from './ToastProvider'
import { Button } from './ui/Button'
import { Field, Input, Select } from './ui/Input'
import { Dialog } from './ui/Overlay'
import { useProjects } from '../lib/queries'
import { addDays, firstOfMonth, toDateOnly, today, type DateOnly } from '../lib/dates'
import { PRIORITY_META, PRIORITY_ORDER } from './ui/primitives'
import type { TaskPriority } from '../lib/types'

type RangePreset = 'this-month' | 'last-month' | 'this-week' | 'this-quarter' | 'custom'

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-week', label: 'This week' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'custom', label: 'Custom range' },
]

function rangeFor(preset: RangePreset): { from: DateOnly; to: DateOnly } {
  const now = today()
  const first = firstOfMonth(now)
  switch (preset) {
    case 'last-month': {
      const end = addDays(first, -1)
      return { from: firstOfMonth(end), to: end }
    }
    case 'this-week': {
      const weekday = new Date(first).getDay()
      return { from: addDays(first, -weekday), to: addDays(first, 6 - weekday) }
    }
    case 'this-quarter': {
      const month = new Date(first).getMonth()
      const quarterStartMonth = Math.floor(month / 3) * 3
      return {
        from: toDateOnly(new Date(new Date(first).getFullYear(), quarterStartMonth, 1)),
        to: toDateOnly(new Date(new Date(first).getFullYear(), quarterStartMonth + 3, 0)),
      }
    }
    case 'custom':
    case 'this-month':
    default: {
      const d = new Date(first)
      return { from: first, to: toDateOnly(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
    }
  }
}

export function ExportDialog({
  open,
  onClose,
  defaultProjectId,
}: {
  open: boolean
  onClose: () => void
  /** Pre-selects a project, e.g. the one open on the board. */
  defaultProjectId?: number | null
}) {
  const toast = useToast()
  const { data: projects = [] } = useProjects(true)
  const [preset, setPreset] = useState<RangePreset>('this-month')
  const [custom, setCustom] = useState(() => rangeFor('this-month'))
  const [projectId, setProjectId] = useState<string>('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState<TaskPriority | ''>('')
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [busy, setBusy] = useState(false)

  const range = preset === 'custom' ? custom : rangeFor(preset)
  const effectiveProject = projectId || (defaultProjectId ? String(defaultProjectId) : '')

  const download = async () => {
    setBusy(true)
    const params = new URLSearchParams({
      from: range.from,
      to: range.to,
      format,
    })
    if (effectiveProject) params.set('project_id', effectiveProject)
    if (status) params.set('status', status)
    if (priority) params.set('priority', priority)

    try {
      const response = await fetch(`/api/export?${params}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error?.message ?? `Export failed (${response.status})`)
      }
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') ?? ''
      const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? `taskflow-export.${format}`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${range.from} to ${range.to}`)
      onClose()
    } catch (error) {
      toast.error('Could not export', { detail: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Export"
      description="A CSV or JSON file of every task with activity in the chosen range."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={download}>
            Download {format.toUpperCase()}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Date range" htmlFor="export-range">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreset(option.value)}
                aria-pressed={preset === option.value}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  preset === option.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-elevated text-ink-soft hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        {preset === 'custom' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="export-from">
              <Input
                id="export-from"
                type="date"
                value={custom.from}
                max={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              />
            </Field>
            <Field label="To" htmlFor="export-to">
              <Input
                id="export-to"
                type="date"
                value={custom.to}
                min={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              />
            </Field>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">
            {range.from} → {range.to}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Project" htmlFor="export-project">
            <Select id="export-project" value={effectiveProject} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Format" htmlFor="export-format">
            <Select id="export-format" value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}>
              <option value="csv">CSV (spreadsheet)</option>
              <option value="json">JSON</option>
            </Select>
          </Field>
        </div>

        <details className="rounded-lg border border-line px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-ink-soft">Narrow it down</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Status" htmlFor="export-status">
              <Select id="export-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any status</option>
                <option value="todo">To do</option>
                <option value="ongoing">Ongoing</option>
                <option value="done">Done</option>
              </Select>
            </Field>
            <Field label="Priority" htmlFor="export-priority">
              <Select
                id="export-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority | '')}
              >
                <option value="">Any priority</option>
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </details>
      </div>
    </Dialog>
  )
}

/** The header control that opens the export dialog. */
export function ExportButton({ projectId }: { projectId?: number | null }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
          <path d="M10 3v9m0 0l3.5-3.5M10 12L6.5 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 14.5v1A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Export
      </Button>
      <ExportDialog open={open} onClose={() => setOpen(false)} defaultProjectId={projectId} />
    </>
  )
}
