import type { WorkingAsset } from '../lib/session'

interface Props {
  asset: WorkingAsset | null
  onClear?: () => void
}

export default function AssetPreview({ asset, onClear }: Props) {
  if (!asset) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400 dark:bg-slate-800">
        No file selected yet
      </div>
    )
  }

  const isImage = asset.dataUrl !== null && asset.type.startsWith('image/')

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {isImage ? (
        <img src={asset.dataUrl as string} alt={asset.name} className="max-h-80 w-full object-contain bg-slate-100 dark:bg-slate-900" />
      ) : (
        <div className="flex h-48 flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900">
          <span className="text-4xl" aria-hidden>📄</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Preview not available for this file type
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 p-3 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-800 dark:text-slate-100">{asset.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {(asset.size / 1024).toFixed(1)} KB · {asset.type || 'unknown type'} · from {asset.sourceTool}
          </p>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
