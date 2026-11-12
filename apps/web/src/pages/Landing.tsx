import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MARKETPLACES } from '../lib/marketplaces'
import { BILLING_PERIODS, PLANS } from '../lib/plans'
import { getTheme, setTheme } from '../lib/session'
import { isDemoMode } from '../lib/api'

const MODULES = [
  { name: 'AI Metadata Generator', desc: 'SEO titles, descriptions, categories and keywords tuned per marketplace.', icon: '🏷️' },
  { name: 'Image Quality Checker', desc: 'Resolution, sharpness, blur, noise, exposure and rejection-risk checks.', icon: '🔍' },
  { name: 'AI Background Remover', desc: 'Clean cut-outs for product and isolated-object stock assets.', icon: '✂️' },
  { name: 'Image Upscaler', desc: '2x and 4x upscaling for low-resolution sources.', icon: '🔎' },
  { name: 'JPG / PNG → SVG', desc: 'Convert raster artwork into scalable vector graphics.', icon: '🖼️' },
  { name: 'SVG → EPS', desc: 'Export vectors in the EPS format marketplaces require.', icon: '📐' },
  { name: 'EPS → JPG', desc: 'Render vector previews as high-quality JPGs.', icon: '🖨️' },
  { name: 'JPG / PNG → PSD', desc: 'Layered Photoshop files from your raster images.', icon: '🎨' },
  { name: 'Asset History & Workflow', desc: 'Track every asset, tool and marketplace submission in one place.', icon: '🗂️' },
]

const SAMPLES = [
  { label: 'Mountain sunrise', gradient: 'from-amber-400 via-orange-500 to-rose-500', emoji: '⛰️' },
  { label: 'Forest trail', gradient: 'from-emerald-400 via-green-600 to-teal-700', emoji: '🌲' },
  { label: 'Ocean waves', gradient: 'from-sky-400 via-blue-500 to-indigo-600', emoji: '🌊' },
  { label: 'Product flat-lay', gradient: 'from-slate-300 via-slate-400 to-slate-600', emoji: '📦' },
]

export default function Landing() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme())
  const [period, setPeriod] = useState(12)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <span className="text-xl font-bold">
            <span className="text-brand-600">Year</span>Media
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark'
                setTheme(next)
                setThemeState(next)
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <Link to="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
              Login
            </Link>
            <Link to="/signup" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Get started
            </Link>
          </div>
        </div>
        {isDemoMode && (
          <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
            Demo mode — API not connected
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:py-24">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
          AI-powered tools for <span className="text-brand-600">microstock creators</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Metadata, quality checks, background removal, upscaling and file conversion —
          built for Adobe Stock, Freepik, Shutterstock, Dreamstime, 123RF, iStock and Alamy contributors.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/signup" className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700">
            Start free trial
          </Link>
          <a href="#modules" className="rounded-xl border border-slate-300 px-6 py-3 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">
            Explore the 9 modules
          </a>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {SAMPLES.map((s) => (
            <figure key={s.label} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <div className={`flex h-28 items-center justify-center bg-gradient-to-br text-4xl ${s.gradient}`} aria-label={s.label}>
                {s.emoji}
              </div>
              <figcaption className="bg-slate-50 px-2 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {s.label} — sample
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Sample visuals are abstract / nature / product placeholders — no people, no haram content.
        </p>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-center text-3xl font-bold">Nine modules, one workflow</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div key={m.name} className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
              <div className="text-3xl">{m.icon}</div>
              <h3 className="mt-3 font-semibold">{m.name}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Marketplace presets */}
      <section className="bg-slate-50 py-12 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold">Marketplace presets</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-slate-600 dark:text-slate-300">
            Title, description and keyword limits enforced per marketplace — so your metadata is never rejected for being too long.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MARKETPLACES.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="font-semibold">{m.name}</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <li>Title: {m.titleMax ? `≤ ${m.titleMax} chars` : '—'}</li>
                  <li>Description: {m.descriptionMax ? `≤ ${m.descriptionMax} chars` : '—'}</li>
                  <li>Keywords: ≤ {m.keywordMax}</li>
                </ul>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{m.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">Pricing</h2>
        <p className="mt-2 text-center text-slate-600 dark:text-slate-300">
          Final prices are still being set — shown as TBD below.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {BILLING_PERIODS.map((p) => (
            <button
              key={p.months}
              onClick={() => setPeriod(p.months)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                period === p.months
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-6 ${
                plan.id === 'pro' ? 'border-brand-600 ring-2 ring-brand-600/30' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{plan.tagline}</p>
              <p className="mt-4 text-2xl font-bold">
                {plan.id === 'free' ? '$0' : 'TBD'}
                <span className="ml-1 text-sm font-normal text-slate-500">/ {BILLING_PERIODS.find((p) => p.months === period)?.label}</span>
              </p>
              <p className="text-xs text-slate-400">{plan.priceNote}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
                {plan.lockedFeatures.map((f) => (
                  <li key={f} className="text-slate-400">🔒 {f}</li>
                ))}
              </ul>
              <Link
                to="/signup"
                className="mt-6 block rounded-xl bg-brand-600 px-4 py-2.5 text-center font-medium text-white hover:bg-brand-700"
              >
                {plan.id === 'free' ? 'Start free trial' : 'Choose ' + plan.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        YearMedia — AI-powered microstock creator platform. Built for contributors.
      </footer>
    </div>
  )
}
