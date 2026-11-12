import { Link } from 'react-router-dom'
import { getAuthSession, getWorkingAsset } from '../lib/session'
import { canAccess, getPlan } from '../lib/plans'
import { isDemoMode } from '../lib/api'

const TOOLS = [
  { to: '/dashboard/metadata', name: 'Metadata Generator', desc: 'AI titles, descriptions & keywords', feature: 'metadata' as const },
  { to: '/dashboard/quality', name: 'Quality Checker', desc: 'Resolution, sharpness & rejection risk', feature: 'quality' as const },
  { to: '/dashboard/remove-bg', name: 'Background Remover', desc: 'Clean cut-outs with BiRefNet', feature: 'remove-bg' as const },
  { to: '/dashboard/upscale', name: 'Upscaler', desc: '2x / 4x with Real-ESRGAN', feature: 'upscale' as const },
  { to: '/dashboard/converters', name: 'Converters', desc: 'SVG, EPS & PSD conversion', feature: 'converters' as const },
  { to: '/dashboard/history', name: 'History', desc: 'Your past assets & submissions', feature: 'history' as const },
]

export default function Dashboard() {
  const session = getAuthSession()
  const plan = getPlan(session?.plan ?? 'free')
  const working = getWorkingAsset()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          Welcome back{session?.email ? `, ${session.email}` : ''} — you're on the{' '}
          <strong>{plan.name}</strong> plan.
        </p>
        {isDemoMode && (
          <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            Demo mode — API not connected. AI tools run on honest local fallbacks.
          </p>
        )}
      </div>

      {working && (
        <div className="rounded-xl border border-brand-500/40 bg-brand-50 p-4 dark:bg-brand-500/10">
          <p className="font-medium">Working session: <span className="font-semibold">{working.name}</span></p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Carried over from {working.sourceTool}. This clears when the tab closes.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const locked = !canAccess(session?.plan ?? 'free', tool.feature)
          return (
            <Link
              key={tool.to}
              to={tool.to}
              className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-500 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between">
                <h2 className="font-semibold">{tool.name}</h2>
                {locked && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">🔒 Pro</span>}
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{tool.desc}</p>
              <span className="mt-3 inline-block text-sm font-medium text-brand-600">Open →</span>
            </Link>
          )
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Quick start</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Upload an asset in the Metadata Generator and pick a marketplace.</li>
          <li>Generate titles, descriptions and keywords — limits are enforced per marketplace.</li>
          <li>Send the asset to the Quality Checker before you submit it.</li>
          <li>Export a CSV for your marketplace and upload it there.</li>
        </ol>
      </div>
    </div>
  )
}
