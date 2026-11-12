import { useState } from 'react'

interface Props {
  keywords: string[]
  onChange: (keywords: string[]) => void
  max: number
}

export default function KeywordEditor({ keywords, onChange, max }: Props) {
  const [input, setInput] = useState('')

  const addKeyword = (raw: string) => {
    const value = raw.trim().toLowerCase().replace(/,+$/, '')
    if (!value) return
    if (keywords.includes(value)) return
    if (keywords.length >= max) return
    onChange([...keywords, value])
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        {keywords.length === 0 && (
          <span className="text-sm text-slate-400">No keywords yet</span>
        )}
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-sm text-brand-700 dark:bg-brand-500/20 dark:text-brand-100"
          >
            {kw}
            <button
              type="button"
              aria-label={`Remove ${kw}`}
              onClick={() => onChange(keywords.filter((k) => k !== kw))}
              className="font-bold hover:text-red-600"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addKeyword(input)
            }
          }}
          onBlur={() => addKeyword(input)}
          placeholder="Add keyword…"
          className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {keywords.length} / {max} keywords — press Enter or comma to add, click × to remove.
      </p>
    </div>
  )
}
