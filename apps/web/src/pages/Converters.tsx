import { useState } from 'react'
import UploadDropzone from '../components/UploadDropzone'
import AssetPreview from '../components/AssetPreview'
import { convertApi, fileFromDataUrl, isDemoMode } from '../lib/api'
import { clearWorkingAsset, getWorkingAsset, setWorkingAsset, type WorkingAsset } from '../lib/session'

interface Converter {
  id: string
  label: string
  from: string
  to: string
  accept: string
  note: string
}

const CONVERTERS: Converter[] = [
  {
    id: 'raster-svg',
    label: 'JPG / PNG → SVG',
    from: 'JPG/PNG',
    to: 'SVG',
    accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
    note: 'Raster images are traced into vector paths (Potrace). Fine detail and photos convert poorly — best for logos and simple artwork.',
  },
  {
    id: 'svg-eps',
    label: 'SVG → EPS',
    from: 'SVG',
    to: 'EPS',
    accept: '.svg,image/svg+xml',
    note: 'EPS is the vector format most microstock marketplaces require for vector uploads.',
  },
  {
    id: 'eps-jpg',
    label: 'EPS → JPG',
    from: 'EPS',
    to: 'JPG',
    accept: '.eps,application/postscript',
    note: 'Renders a high-quality JPG preview of your vector file (Ghostscript).',
  },
  {
    id: 'raster-psd',
    label: 'JPG / PNG → PSD',
    from: 'JPG/PNG',
    to: 'PSD',
    accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
    note: 'Produces a layered Photoshop file. The image becomes a single raster layer — no automatic layer separation.',
  },
]

export default function Converters() {
  const [activeId, setActiveId] = useState(CONVERTERS[0].id)
  const [asset, setAsset] = useState<WorkingAsset | null>(() => getWorkingAsset())
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<{ url: string; filename: string } | null>(null)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  const active = CONVERTERS.find((c) => c.id === activeId) ?? CONVERTERS[0]

  const handleFile = (file: File) => {
    setProgress(50)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = file.type.startsWith('image/') ? String(reader.result) : null
      const next: WorkingAsset = { name: file.name, type: file.type, size: file.size, dataUrl, sourceTool: `Converter (${active.label})` }
      setAsset(next)
      setWorkingAsset(next)
      setStatus('')
      setProgress(100)
      setTimeout(() => setProgress(null), 600)
    }
    reader.readAsDataURL(file)
  }

  const convert = async () => {
    if (!asset) {
      setStatus('Upload a file first.')
      return
    }
    setWorking(true)
    setResult(null)
    try {
      let file: File
      if (asset.dataUrl) {
        file = await fileFromDataUrl(asset.name, asset.type, asset.dataUrl)
      } else {
        // Non-image files (EPS/SVG) have no data URL preview; they cannot be
        // rebuilt in the browser — ask for a fresh upload in this tab.
        setStatus('This file was transferred from another tool without its bytes — please upload it again here.')
        setWorking(false)
        return
      }
      const res = await convertApi(file, active.to)
      if (res.ok && res.data) {
        setResult({ url: res.data.url, filename: res.data.filename })
        setStatus(`Converted ${active.from} → ${active.to} by the connected service.`)
      } else {
        setStatus(
          `${active.label} failed: ${res.error ?? 'service not connected'} — no file was produced. Nothing was faked.`,
        )
      }
    } catch {
      setStatus('Could not read the uploaded file.')
    }
    setWorking(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Converters</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          Four format converters in one place. Each one needs the conversion service — in demo mode they report honestly instead of faking a file.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Converters">
        {CONVERTERS.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={activeId === c.id}
            onClick={() => { setActiveId(c.id); setStatus('') }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeId === c.id
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <UploadDropzone
            accept={active.accept}
            label={`Upload a ${active.from} file`}
            hint={active.note}
            onFile={handleFile}
            progress={progress}
          />
          <AssetPreview asset={asset} onClear={() => { setAsset(null); clearWorkingAsset() }} />
          <button
            onClick={convert}
            disabled={working || !asset}
            className="w-full rounded-xl bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {working ? 'Converting…' : `Convert to ${active.to}`}
          </button>
          {status && (
            <p className={`rounded-lg px-3 py-2 text-sm ${isDemoMode ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {status}
            </p>
          )}
        </div>
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
          {result ? (
            <div>
              <p className="text-slate-700 dark:text-slate-200">Conversion complete.</p>
              <a href={result.url} download={result.filename} className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
                Download {result.filename}
              </a>
            </div>
          ) : isDemoMode ? (
            `No result yet — the ${active.label} service is not connected in demo mode. Connect the API to get a real converted file.`
          ) : (
            'Your converted file will be offered for download here once the service returns it.'
          )}
        </div>
      </div>
    </div>
  )
}
