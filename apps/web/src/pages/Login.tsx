import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAuthSession, setAuthSession } from '../lib/session'
import { isDemoMode, loginApi } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Already signed in? Go straight to the dashboard.
  if (getAuthSession()) {
    navigate('/dashboard', { replace: true })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!isDemoMode) {
      const res = await loginApi(email, password)
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Login failed. If this is your first time, sign up first.')
        return
      }
      setAuthSession({ email: res.data.user.email, plan: res.data.user.plan, createdAt: new Date().toISOString() })
      navigate('/dashboard')
      return
    }
    setAuthSession({ email, plan: 'free', createdAt: new Date().toISOString() })
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link to="/" className="text-xl font-bold">
          <span className="text-brand-600">Year</span>Media
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isDemoMode
            ? 'Demo auth — any email and a password of 6+ characters signs you in locally. No data leaves your browser.'
            : 'Connected mode — your credentials are checked against the YearMedia API.'}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              placeholder="At least 6 characters"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="w-full rounded-xl bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700">
            Log in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          No account?{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
