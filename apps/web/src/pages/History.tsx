import { useState } from 'react'
import { clearHistory, loadHistory, type HistoryEntry } from '../lib/session'

export default function History() {
  // CORE RULE: history is NEVER auto-displayed in a fresh session.
  // It is read from localStorage only after the user clicks "Load history".
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [loadedAt, setLoadedAt] = useState<string | null>(null)

  const load = () => {
    setEntries(loadHistory())
    setLoadedAt(new Date().toLocaleString())
  }

  const clear = () => {
    clearHistory()
    setEntries([])
  }

  const download = (entry: HistoryEntry) => {
    if (!entry.dataUrl) return
    const a = document.createElement('a')
    a.href = entry.dataUrl
    a.download = entry.fileName
    a.click()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Asset History</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          Your permanent history lives in this browser only. It is <strong>never shown automatically</strong> —
          click "Load history" to view it, even if entries exist from earlier sessions.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={load} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Load history
        </button>
        {entries !== null && entries.length > 0 && (
          <button onClick={clear} className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
            Clear all history
          </button>
        )}
      </div>

      {entries === null ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
          History is hidden until you load it. Nothing from previous sessions is displayed here yet.
        </div>
      ) : entries.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
          No history entries yet. Generate metadata or run a quality check and entries will be saved here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <p className="bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            Loaded {loadedAt} — {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Tool</th>
                <th className="px-4 py-3">Marketplace</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Download</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <span className="block font-medium">{e.fileName}</span>
                    <span className="block max-w-xs truncate text-xs text-slate-500">{e.summary}</span>
                  </td>
                  <td className="px-4 py-3">{e.tool}</td>
                  <td className="px-4 py-3">{e.marketplace}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(e.date).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {e.dataUrl ? (
                      <button onClick={() => download(e)} className="font-medium text-brand-600 hover:underline">
                        Download
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
