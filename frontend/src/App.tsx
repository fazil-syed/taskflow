import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router'
import { ToastProvider } from './components/ToastProvider'
import { IconButton } from './components/ui/Button'
import { SpinnerBlock } from './components/ui/primitives'
import { BoardPage } from './features/board/BoardPage'
import { CalendarPage } from './features/calendar/CalendarPage'
import { TasksPage } from './features/tasks/TasksPage'
import { useProjects } from './lib/queries'
import { cn } from './lib/cn'

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}

const NAV = [
  { to: '/', label: 'Board', icon: BoardIcon },
  { to: '/tasks', label: 'Tasks', icon: ListIcon },
  { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
]

function Shell() {
  const { isLoading } = useProjects()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('taskflow-theme', dark ? 'dark' : 'light')
    } catch {
      // private mode; the theme just will not persist
    }
  }, [dark])

  // Global shortcuts: n = new view shortcut target, / = focus the first search box.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      if (typing) return

      if (event.key === '/') {
        const search = document.querySelector<HTMLInputElement>('input[aria-label="Search tasks"]')
        if (search) {
          event.preventDefault()
          search.focus()
          search.select()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-line bg-white px-4 py-2.5 dark:bg-surface">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80"
          aria-label="TaskFlow home"
        >
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-ink">TaskFlow</span>
        </Link>

        <nav className="ml-4 flex items-center gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-elevated text-ink dark:bg-elevated dark:text-ink'
                    : 'text-ink-faint hover:bg-elevated hover:text-ink dark:text-ink-soft dark:hover:bg-elevated dark:hover:text-ink',
                )
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <IconButton
            label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setDark((d) => !d)}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </IconButton>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <SpinnerBlock className="h-full" />
        ) : (
          <Routes>
            <Route path="/" element={<BoardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="*" element={<BoardPage />} />
          </Routes>
        )}
      </div>
    </div>
  )
}

function Logo() {
  return (
    <span className="flex size-7 items-center justify-center rounded-xl bg-indigo-600">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function BoardIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <rect x="2.5" y="3" width="4.5" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8.5" y="3" width="4.5" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14.5" y="3" width="3" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path d="M7 5h10M7 10h10M7 15h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="3.5" cy="5" r="1.1" fill="currentColor" />
      <circle cx="3.5" cy="10" r="1.1" fill="currentColor" />
      <circle cx="3.5" cy="15" r="1.1" fill="currentColor" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <rect x="2.5" y="4" width="15" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 8h15M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="11.5" r="1" fill="currentColor" />
      <circle cx="11" cy="14" r="1" fill="currentColor" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path
        d="M16 11.5A6.5 6.5 0 0 1 8.5 4a6.5 6.5 0 1 0 7.5 7.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2v1.5M10 16.5V18M18 10h-1.5M3.5 10H2M15.5 4.5l-1 1M5.5 14.5l-1 1M15.5 15.5l-1-1M5.5 5.5l-1-1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
