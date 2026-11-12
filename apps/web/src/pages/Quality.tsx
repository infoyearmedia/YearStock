import { useState } from 'react'
import UploadDropzone from '../components/UploadDropzone'
import AssetPreview from '../components/AssetPreview'
import { checkQualityApi, fileFromDataUrl, isDemoMode, type QualityApiResponse } from '../lib/api'
import {
  clearWorkingAsset,
  getWorkingAsset,
  saveHistoryEntry,
  setWorkingAsset,
  type WorkingAsset,
} from '../lib/session'

interface Metrics {
  width: number
  height: number
  megapixels: number
  fileSizeKb: number
  /** 0–100, from luminance variance (higher = sharper). Client-side proxy only. */
  sharpness: number
  /** 0–100, inverse of sharpness variance spread — proxy only. */
  blur: number
  /** 0–100, estimated from high-frequency noise in flat areas — proxy only. */
  noise: number
  /** 0–100, mean brightness scaled. */
  exposure: number
  /** 0–100, mean saturation. */
  color: number
  /** 0–100, bytes-per-pixel based estimate of JPEG compression. */
  compression: number
}

function analyzeImage(img: HTMLImageElement, fileSize: number): Metrics {
  const canvas = document.createElement('canvas')
  const maxSide = 400
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data

  let sumLum = 0
  let sumSat = 0
  const lums: number[] = []
  const n = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    lums.push(lum)
    sumLum += lum
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    sumSat += max === 0 ? 0 : (max - min) / max
  }
  const meanLum = sumLum / n
  const meanSat = sumSat / n
  // Variance of luminance = sharpness proxy; local differences = blur/noise proxy.
  let variance = 0
  let edgeSum = 0
  const w = canvas.width
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const d = lums[idx] - meanLum
      variance += d * d
      if (x > 0) edgeSum += Math.abs(lums[idx] - lums[idx - 1])
    }
  }
  variance /= n
  const edgeMean = edgeSum / n
  const sharpness = Math.min(100, Math.round((variance / 2500) * 100))
  const blur = Math.max(0, Math.min(100, Math.round(100 - (edgeMean / 12) * 100)))
  const noise = Math.max(0, Math.min(100, Math.round(Math.max(0, edgeMean - 4) * 6)))
  const exposure = Math.round((meanLum / 255) * 100)
  const color = Math.round(meanSat * 100)
  const bytesPerPixel = fileSize / (img.width * img.height)
  const compression = Math.max(0, Math.min(100, Math.round(100 - bytesPerPixel * 40)))

  return {
    width: img.width,
    height: img.height,
    megapixels: Math.round(((img.width * img.height) / 1_000_000) * 10) / 10,
    fileSizeKb: Math.round(fileSize / 1024),
    sharpness,
    blur,
    noise,
    exposure,
    color,
    compression,
  }
}

function deriveRisks(m: Metrics): { level: 'low' | 'medium' | 'high'; items: string[] } {
  const items: string[] = []
  if (m.megapixels < 4) items.push(`Low resolution (${m.megapixels} MP) — most marketplaces want at least 4 MP; Adobe Stock prefers 8 MP+.`)
  if (m.sharpness < 30) items.push('Low sharpness proxy — the image may look soft or out of focus; check at 100% zoom.')
  if (m.blur > 60) items.push('High blur proxy — edges look soft; possible motion blur or missed focus.')
  if (m.noise > 50) items.push('High noise proxy — visible grain, often from high ISO or heavy compression.')
  if (m.exposure < 20) items.push('Very dark exposure — shadows may be crushed; brighten before submitting.')
  if (m.exposure > 90) items.push('Very bright exposure — highlights may be blown out.')
  if (m.compression > 70) items.push('Heavy compression — small file for its size; artefacts may be visible at 100% zoom.')
  const level = items.length === 0 ? 'low' : items.length <= 2 ? 'medium' : 'high'
  return { level, items }
}

export default function Quality() {
  const [asset, setAsset] = useState<WorkingAsset | null>(() => getWorkingAsset())
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [apiResult, setApiResult] = useState<QualityApiResponse | null>(null)
  const [risks, setRisks] = useState<{ level: 'low' | 'medium' | 'high'; items: string[] } | null>(null)
  const [status, setStatus] = useState('')
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus('Quality Checker works on image files (JPG / PNG).')
      return
    }
    setProgress(50)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const next: WorkingAsset = { name: file.name, type: file.type, size: file.size, dataUrl, sourceTool: 'Quality Checker' }
      setAsset(next)
      setWorkingAsset(next)
      setMetrics(null)
      setApiResult(null)
      setRisks(null)
      setStatus('')
      setProgress(100)
      setTimeout(() => setProgress(null), 600)
    }
    reader.readAsDataURL(file)
  }

  const runCheck = async () => {
    if (!asset || !asset.dataUrl) {
      setStatus('Upload an image first.')
      return
    }
    setChecking(true)
    setStatus('')
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Could not read image'))
        img.src = asset.dataUrl as string
      })
      const local = analyzeImage(img, asset.size)

      if (!isDemoMode) {
        try {
          const uploadFile = await fileFromDataUrl(asset.name, asset.type, asset.dataUrl)
          const api = await checkQualityApi(uploadFile)
          if (api.ok && api.data) {
            setApiResult(api.data)
            setStatus(`Checked by the connected API service (source: ${api.data.source}).`)
          } else {
            setApiResult(null)
            setStatus(`API check failed (${api.error ?? 'unknown error'}) — showing the limited client-side check instead.`)
          }
        } catch {
          setApiResult(null)
          setStatus('API check failed — showing the limited client-side check instead.')
        }
        setMetrics(local)
        setRisks(deriveRisks(local))
      } else {
        setMetrics(local)
        setRisks(deriveRisks(local))
        setStatus('Limited client-side check — dimensions and pixel statistics only. No AI judgement; connect the API for the full check.')
      }
      saveHistoryEntry({
        id: `${Date.now()}`,
        tool: 'Quality Checker',
        marketplace: '—',
        fileName: asset.name,
        date: new Date().toISOString(),
        dataUrl: asset.dataUrl,
        summary: `${img.width}×${img.height}px, ${local.megapixels} MP`,
      })
    } catch {
      setStatus('Could not analyse this image in the browser.')
    } finally {
      setChecking(false)
    }
  }

  const rows: { label: string; value: string; note: string }[] = metrics
    ? [
        { label: 'Resolution', value: `${metrics.width} × ${metrics.height} px (${metrics.megapixels} MP)`, note: 'Measured from the file.' },
        { label: 'Sharpness', value: `${metrics.sharpness} / 100`, note: 'Client-side proxy from luminance variance — not an AI verdict.' },
        { label: 'Blur', value: `${metrics.blur} / 100`, note: 'Proxy from edge softness; higher = softer.' },
        { label: 'Noise', value: `${metrics.noise} / 100`, note: 'Proxy from high-frequency variation.' },
        { label: 'Exposure', value: `${metrics.exposure} / 100`, note: 'Mean brightness; 0 = black, 100 = white.' },
        { label: 'Colour', value: `${metrics.color} / 100`, note: 'Mean saturation.' },
        { label: 'Compression', value: `${metrics.compression} / 100`, note: 'Estimated from bytes per pixel; higher = more compressed.' },
        { label: 'File size', value: `${metrics.fileSizeKb} KB`, note: 'Measured from the file.' },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Image Quality Checker</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          Measured metrics only — this tool never invents an approval score. Rejection risk is derived
          from simple thresholds, and every risk explains itself.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <UploadDropzone
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            label="Upload an image to check"
            hint="JPG / PNG only. Analysis runs in your browser in demo mode."
            onFile={handleFile}
            progress={progress}
          />
          <AssetPreview asset={asset} onClear={() => { setAsset(null); setMetrics(null); setApiResult(null); setRisks(null); clearWorkingAsset() }} />
          <button
            onClick={runCheck}
            disabled={checking || !asset}
            className="w-full rounded-xl bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'Run quality check'}
          </button>
          {status && <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{status}</p>}
        </div>

        <div className="space-y-4">
          {metrics ? (
            <>
              {apiResult && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="font-semibold">API check — {apiResult.source}</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Overall risk: <strong>{apiResult.overallRisk.toUpperCase()}</strong>
                    {apiResult.note ? ` — ${apiResult.note}` : ''}
                  </p>
                  <dl className="mt-3 space-y-2">
                    {Object.entries(apiResult.metrics).map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                        <dt className="text-sm font-medium">{k}</dt>
                        <dd className="shrink-0 text-sm font-semibold">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  {apiResult.risks.length > 0 ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                      {apiResult.risks.map((r) => (
                        <li key={r.code}>{r.message} ({r.severity})</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm">No risk flags from the API check.</p>
                  )}
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="font-semibold">Measured metrics</h2>
                <dl className="mt-3 space-y-3">
                  {rows.map((r) => (
                    <div key={r.label} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                      <div>
                        <dt className="text-sm font-medium">{r.label}</dt>
                        <dd className="text-xs text-slate-500 dark:text-slate-400">{r.note}</dd>
                      </div>
                      <dd className="shrink-0 text-sm font-semibold">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div
                className={`rounded-xl border p-5 ${
                  risks?.level === 'low'
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                    : risks?.level === 'medium'
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                      : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                }`}
              >
                <h2 className="font-semibold">Rejection risk: {risks?.level.toUpperCase()}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Derived from the thresholds above — not a marketplace decision. Marketplaces judge
                  by their own reviewers.
                </p>
                {risks && risks.items.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                    {risks.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm">No risk flags from the measured metrics. Still review the image at 100% zoom before submitting.</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-700">
              Results will appear here after you run a check.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
