import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearAuthSession, getAuthSession, getTheme, setTheme } from '../lib/session'
import { isDemoMode } from '../lib/api'
import { canAccess, type FeatureId } from '../lib/plans'

const NAV: { to: string; label: string; feature: FeatureId }[] = [
  { to: '/dashboard', label: 'Dashboard', feature: 'metadata' },
  { to: '/dashboard/metadata', label: 'Metadata Generator', feature: 'metadata' },
  { to: '/dashboard/quality', label: 'Quality Checker', feature: 'quality' },
  { to: '/dashboard/remove-bg', label: 'Background Remover', feature: 'remove-bg' },
  { to: '/dashboard/upscale', label: 'Upscaler', feature: 'upscale' },
  { to: '/dashboard/converters', label: 'Converters', feature: 'converters' },
  { to: '/dashboard/history', label: 'History', feature: 'history' },
  { to: '/dashboard/subscription', label: 'Subscription', feature: 'metadata' },
  { to: '/dashboard/settings', label: 'Settings', feature: 'metadata' },
]

export default function Layout() {
  const navigate = useNavigate()
  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme())
  const [menuOpen, setMenuOpen] = useState(false)
  const session = getAuthSession()
  const plan = session?.plan ?? 'free'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  const logout = () => {
    clearAuthSession()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <Link to="/dashboard" className="text-xl font-bold">
              <span className="text-brand-600">Year</span>Media
            </Link>
            <span className="hidden rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 sm:inline dark:bg-brand-500/20 dark:text-brand-100">
              {plan === 'free' ? 'Free Trial' : plan === 'pro' ? 'Pro' : 'Premium'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              aria-label="Toggle dark / light theme"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <span className="hidden max-w-48 truncate text-sm text-slate-500 md:inline dark:text-slate-400">
              {session?.email}
            </span>
            <button
              onClick={logout}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Logout
            </button>
          </div>
        </div>
        {isDemoMode && (
          <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
            Demo mode — API not connected. AI features use local demo fallbacks; no data leaves your browser.
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside
          className={`${
            menuOpen ? 'block' : 'hidden'
          } w-64 shrink-0 lg:block`}
        >
          <nav className="sticky top-24 space-y-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            {NAV.map((item) => {
              const locked = !canAccess(plan, item.feature)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <span>{item.label}</span>
                  {locked && <span className="text-xs opacity-70">🔒 Pro</span>}
                </NavLink>
              )
            })}
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Signed in as <span className="font-medium text-slate-700 dark:text-slate-200">{session?.email}</span>
              <br />
              Working session is temporary — it clears when this tab closes. History is only loaded when you ask for it.
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export type { ReactNode }
