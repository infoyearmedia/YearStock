import { useRef, useState } from 'react'

interface Props {
  accept: string
  label: string
  hint?: string
  onFile: (file: File) => void
  /** 0–100 upload/read progress, shown when set. */
  progress?: number | null
}

export default function UploadDropzone({ accept, label, hint, onFile, progress }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) onFile(file)
      }}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
        dragOver
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
          : 'border-slate-300 bg-slate-50 hover:border-brand-500 dark:border-slate-600 dark:bg-slate-800/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      <div className="text-4xl" aria-hidden>📁</div>
      <p className="mt-3 font-medium text-slate-800 dark:text-slate-100">{label}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Drag &amp; drop here, or click to browse
      </p>
      {hint && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      {progress !== null && progress !== undefined && (
        <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
