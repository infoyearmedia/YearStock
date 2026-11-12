import { useState } from 'react'
import { BILLING_PERIODS, PLANS, getPlan } from '../lib/plans'
import { getAuthSession } from '../lib/session'

export default function Subscription() {
  const session = getAuthSession()
  const current = getPlan(session?.plan ?? 'free')
  const [period, setPeriod] = useState(12)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          Your current plan is <strong>{current.name}</strong>. Pro and Premium features are locked until pricing is confirmed.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">Current plan: {current.name}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{current.tagline} — {current.priceNote}</p>
        <h3 className="mt-4 text-sm font-medium">Included</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {current.features.map((f) => (
            <li key={f}>✓ {f}</li>
          ))}
        </ul>
        {current.lockedFeatures.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-medium">Locked on this plan</h3>
            <ul className="mt-1 space-y-1 text-sm text-slate-500 dark:text-slate-400">
              {current.lockedFeatures.map((f) => (
                <li key={f}>🔒 {f}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div>
        <h2 className="font-semibold">Billing period</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {BILLING_PERIODS.map((p) => (
            <button
              key={p.months}
              onClick={() => setPeriod(p.months)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                period === p.months
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === current.id
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-5 ${
                plan.id === 'pro' ? 'border-brand-600 ring-2 ring-brand-600/30' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <h3 className="font-bold">{plan.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{plan.tagline}</p>
              <p className="mt-3 text-xl font-bold">
                {plan.id === 'free' ? '$0' : 'TBD'}
                <span className="ml-1 text-sm font-normal text-slate-500">
                  / {BILLING_PERIODS.find((p) => p.months === period)?.label}
                </span>
              </p>
              <p className="text-xs text-slate-400">{plan.priceNote}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
                {plan.lockedFeatures.map((f) => (
                  <li key={f} className="text-slate-400">🔒 {f}</li>
                ))}
              </ul>
              <button
                disabled
                title="Pricing TBD — contact Year Media"
                className="mt-4 w-full cursor-not-allowed rounded-xl bg-slate-200 py-2.5 text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              >
                {isCurrent ? 'Current plan' : 'Upgrade — pricing TBD'}
              </button>
            </div>
          )
        })}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Upgrade buttons are disabled: pricing is TBD. To upgrade, contact Year Media.
      </p>
    </div>
  )
}
