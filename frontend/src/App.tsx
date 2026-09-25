import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router'
import { motion } from 'framer-motion'
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

interface NavIconProps {
  active?: boolean
  className?: string
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
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/80 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-lg py-1 pr-2 transition-opacity hover:opacity-90"
          aria-label="TaskFlow home"
        >
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-ink">TaskFlow</span>
        </Link>

        {/* The nav is a segmented control: one raised surface that slides to the
            active tab, so the header reads as a single object. */}
        <nav className="ml-1 flex items-center gap-0.5 rounded-xl bg-canvas p-0.5 sm:ml-3 dark:bg-elevated/70">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3',
                  isActive ? 'text-ink' : 'text-ink-soft hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-[10px] bg-surface shadow-sm ring-1 ring-line dark:bg-strong dark:ring-transparent"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon className="relative size-4" active={isActive} />
                  <span className="relative hidden sm:inline">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-canvas p-0.5 dark:bg-elevated/70">
            <IconButton
              label="Use the light theme"
              onClick={() => setDark(false)}
              size="sm"
              aria-pressed={!dark}
              className={cn(
                'size-7 rounded-md',
                !dark ? 'bg-surface text-ink shadow-sm dark:bg-strong' : 'text-ink-faint hover:text-ink',
              )}
            >
              <SunIcon />
            </IconButton>
            <IconButton
              label="Use the dark theme"
              onClick={() => setDark(true)}
              size="sm"
              aria-pressed={dark}
              className={cn(
                'size-7 rounded-md',
                dark ? 'bg-surface text-ink shadow-sm dark:bg-strong' : 'text-ink-faint hover:text-ink',
              )}
            >
              <MoonIcon />
            </IconButton>
          </div>
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
    <span className="flex size-7 items-center justify-center rounded-[9px] bg-linear-to-b from-indigo-500 to-indigo-600 shadow-sm shadow-indigo-600/25 ring-1 ring-indigo-500/40">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7" stroke="white" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function BoardIcon({ active, className }: NavIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <rect x="2.75" y="3.25" width="4.25" height="13.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.75} />
      <rect x="8.4" y="3.25" width="4.25" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.75} />
      <rect x="14" y="3.25" width="3.25" height="5.5" rx="1.5" fill="currentColor" opacity={active ? 0.9 : 0.55} />
    </svg>
  )
}

function ListIcon({ active, className }: NavIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <path
        d="M7.5 5.25h8.75M7.5 10h8.75M7.5 14.75h8.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={active ? 1 : 0.8}
      />
      <circle cx="3.9" cy="5.25" r="1.35" fill="currentColor" opacity={active ? 0.9 : 0.6} />
      <circle cx="3.9" cy="10" r="1.35" fill="currentColor" opacity={active ? 0.9 : 0.6} />
      <circle cx="3.9" cy="14.75" r="1.35" fill="currentColor" opacity={active ? 0.9 : 0.6} />
    </svg>
  )
}

function CalendarIcon({ active, className }: NavIconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <rect x="2.75" y="4.25" width="14.5" height="12.5" rx="2.25" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.8} />
      <path d="M2.75 8.25h14.5M6.75 2.75v3M13.25 2.75v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={active ? 1 : 0.8} />
      <circle cx="7" cy="11.75" r="1.15" fill="currentColor" opacity={active ? 0.9 : 0.55} />
      <circle cx="11" cy="14" r="1.15" fill="currentColor" opacity={active ? 0.9 : 0.55} />
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
