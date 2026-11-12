import { useState } from 'react'
import UploadDropzone from '../components/UploadDropzone'
import AssetPreview from '../components/AssetPreview'
import { fileFromDataUrl, isDemoMode, upscaleApi } from '../lib/api'
import { clearWorkingAsset, getWorkingAsset, setWorkingAsset, type WorkingAsset } from '../lib/session'

export default function Upscale() {
  const [asset, setAsset] = useState<WorkingAsset | null>(() => getWorkingAsset())
  const [scale, setScale] = useState<2 | 4>(2)
  const [status, setStatus] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus('Upscaling works on image files (JPG / PNG).')
      return
    }
    setProgress(50)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const next: WorkingAsset = { name: file.name, type: file.type, size: file.size, dataUrl, sourceTool: 'Upscaler' }
      setAsset(next)
      setWorkingAsset(next)
      setStatus('')
      setProgress(100)
      setTimeout(() => setProgress(null), 600)
    }
    reader.readAsDataURL(file)
  }

  const upscale = async () => {
    if (!asset || !asset.dataUrl) {
      setStatus('Upload an image first.')
      return
    }
    setWorking(true)
    setResultUrl(null)
    try {
      const file = await fileFromDataUrl(asset.name, asset.type, asset.dataUrl)
      const res = await upscaleApi(file, scale)
      if (res.ok && res.data) {
        setResultUrl(res.data.url)
        setStatus(`Upscaled ${scale}x by the connected Real-ESRGAN service.`)
      } else {
        setStatus(
          `Upscaling failed: ${res.error ?? 'service not connected'} — no ${scale}x result was produced. Nothing was faked.`,
        )
      }
    } catch {
      setStatus('Could not read the uploaded image.')
    }
    setWorking(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Image Upscaler</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          2x and 4x upscaling for low-resolution sources, powered by Real-ESRGAN when the API is connected.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <UploadDropzone
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            label="Upload an image"
            hint="JPG / PNG. Upscaling cannot invent detail that was never in the source."
            onFile={handleFile}
            progress={progress}
          />
          <AssetPreview asset={asset} onClear={() => { setAsset(null); clearWorkingAsset() }} />
          <div>
            <span className="text-sm font-medium">Scale</span>
            <div className="mt-1 flex gap-2">
              {([2, 4] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={`rounded-lg px-5 py-2 text-sm font-medium ${
                    scale === s ? 'bg-brand-600 text-white' : 'border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={upscale}
            disabled={working || !asset}
            className="w-full rounded-xl bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {working ? 'Upscaling…' : `Upscale ${scale}x`}
          </button>
          {status && (
            <p className={`rounded-lg px-3 py-2 text-sm ${isDemoMode ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {status}
            </p>
          )}
        </div>
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
          {resultUrl ? (
            <div className="w-full">
              <img src={resultUrl} alt={`Upscaled ${scale}x`} className="mx-auto max-h-96 rounded-lg" />
              <a href={resultUrl} download={`${asset?.name.replace(/\.[^.]+$/, '')}-${scale}x.png`} className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
                Download upscaled image
              </a>
            </div>
          ) : isDemoMode ? (
            'No result yet — the Real-ESRGAN service is not connected in demo mode, so no upscaled image is shown here. Connect the API to get a real result.'
          ) : (
            'Your upscaled image will appear here once the service returns it.'
          )}
        </div>
      </div>
    </div>
  )
}
