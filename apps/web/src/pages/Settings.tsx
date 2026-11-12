import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearAuthSession,
  clearHistory,
  clearWorkingAsset,
  getAuthSession,
  getTheme,
  setTheme,
} from '../lib/session'
import { API_URL, isDemoMode } from '../lib/api'

export default function Settings() {
  const navigate = useNavigate()
  const session = getAuthSession()
  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme())
  const [apiUrl, setApiUrl] = useState(API_URL)
  const [notice, setNotice] = useState('')

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  const saveApiUrl = () => {
    // The API URL is a build-time setting (VITE_API_URL). Changing it here
    // stores an override note only — a rebuild is needed for it to take effect.
    localStorage.setItem('ym_api_url_override', apiUrl)
    setNotice(
      'Saved as a note. Note: VITE_API_URL is a build-time setting — set it in the .env file and rebuild for it to take effect.',
    )
  }

  const clearSession = () => {
    clearWorkingAsset()
    setNotice('Working session cleared (temporary sessionStorage asset removed).')
  }

  const clearHistoryClick = () => {
    clearHistory()
    setNotice('Permanent history cleared from this browser.')
  }

  const logout = () => {
    clearAuthSession()
    navigate('/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Profile, theme, API connection and local data.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Profile</h2>
        <p className="mt-2 text-sm"><span className="text-slate-500">Email: </span>{session?.email ?? '—'}</p>
        <p className="mt-1 text-sm"><span className="text-slate-500">Plan: </span>{session?.plan === 'free' ? 'Free Trial' : session?.plan}</p>
        <p className="mt-1 text-sm"><span className="text-slate-500">Account created: </span>{session?.createdAt ? new Date(session.createdAt).toLocaleString() : '—'}</p>
        <p className="mt-2 text-xs text-slate-400">Demo auth — no server account exists; your session lives only in this browser.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Theme</h2>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => { setTheme('light'); setThemeState('light') }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${theme === 'light' ? 'bg-brand-600 text-white' : 'border border-slate-300 dark:border-slate-700'}`}
          >
            ☀️ Light
          </button>
          <button
            onClick={() => { setTheme('dark'); setThemeState('dark') }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${theme === 'dark' ? 'bg-brand-600 text-white' : 'border border-slate-300 dark:border-slate-700'}`}
          >
            🌙 Dark
          </button>
          <button onClick={toggleTheme} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700">
            Toggle
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">API connection</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Status: {isDemoMode ? 'Demo mode — API not connected' : `Connected to ${API_URL}`}
        </p>
        <label htmlFor="apiurl" className="mt-3 block text-sm font-medium">API URL (VITE_API_URL)</label>
        <div className="mt-1 flex gap-2">
          <input
            id="apiurl"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.example.com (leave empty for demo mode)"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
          />
          <button onClick={saveApiUrl} className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          This is a build-time variable — saving here records your intent; set VITE_API_URL in the environment and rebuild to actually connect.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Local data</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={clearSession} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            Clear working session
          </button>
          <button onClick={clearHistoryClick} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            Clear history
          </button>
          <button onClick={logout} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900">
            Log out
          </button>
        </div>
        {notice && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{notice}</p>}
      </section>
    </div>
  )
}
