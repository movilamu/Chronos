import { NavLink, Outlet } from 'react-router-dom'
import { Home, ListTodo, BarChart3, Bell, Settings, LogOut, CalendarCheck2, Kanban, FolderKanban, Rocket } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import VoiceButton from './VoiceButton'
import { useGlobalNotifier } from '../hooks/useGlobalNotifier'

const navItems = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/board', label: 'Board', icon: Kanban },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/sprints', label: 'Sprints', icon: Rocket },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/needs-input', label: 'Needs Input', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  useGlobalNotifier()

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] md:flex">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-[var(--border-color)] md:bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <CalendarCheck2 size={20} />
          </div>
          <span className="font-semibold">Life Planner</span>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-500'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--border-color)] p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-brand-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.full_name || 'You'}</p>
            </div>
            <button
              onClick={signOut}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </div>

      <VoiceButton />

      {/* Bottom nav - mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex overflow-x-auto border-t border-[var(--border-color)] bg-[var(--bg-secondary)] md:hidden">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-w-[64px] flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
                isActive ? 'text-brand-600' : 'text-[var(--text-secondary)]'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
