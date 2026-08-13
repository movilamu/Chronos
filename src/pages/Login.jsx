import { useAuth } from '../context/AuthContext'
import { CalendarCheck2 } from 'lucide-react'

export default function Login() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
          <CalendarCheck2 size={26} />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Life Planner</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Plan your day. Stay on track. Stress-free.
        </p>

        <button
          onClick={signInWithGoogle}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)]"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.6 3 24 3c-7.7 0-14.3 4.4-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.6C29.6 36 26.9 37 24 37c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.6 40.5 16.2 45 24 45z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5.001 0 .001 0 0 0l6.6 5.6C37.6 41.1 44 36 44 24c0-1.4-.1-2.7-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-6 text-xs text-[var(--text-secondary)]">
          Your tasks sync automatically across your phone and laptop.
        </p>
      </div>
    </div>
  )
}
