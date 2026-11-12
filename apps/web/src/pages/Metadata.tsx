import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadDropzone from '../components/UploadDropzone'
import AssetPreview from '../components/AssetPreview'
import KeywordEditor from '../components/KeywordEditor'
import { MARKETPLACES, enforceLimit, getMarketplace } from '../lib/marketplaces'
import { generateMetadataApi, isDemoMode, type MetadataResponse } from '../lib/api'
import {
  clearWorkingAsset,
  getWorkingAsset,
  saveHistoryEntry,
  setWorkingAsset,
  type WorkingAsset,
} from '../lib/session'

const ACCEPT = '.jpg,.jpeg,.png,.eps,.ai,.psd,.pdf,image/jpeg,image/png,application/pdf,application/postscript'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'of', 'in', 'on', 'for', 'with', 'to', 'at', 'by',
  'img', 'image', 'photo', 'pic', 'picture', 'final', 'copy', 'edit', 'edited',
  'v1', 'v2', 'new', 'untitled', 'dsc', 'screenshot',
])

function slugWords(fileName: string): string[] {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
  return base
    .split(/[^a-zA-Z0-9]+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

const DEMO_KEYWORD_POOL = [
  'background', 'concept', 'design', 'illustration', 'isolated', 'nature',
  'outdoor', 'landscape', 'abstract', 'texture', 'colorful', 'modern',
  'minimal', 'creative', 'stock', 'vector', 'graphic', 'art', 'travel',
  'business', 'lifestyle', 'season', 'light', 'shadow', 'pattern',
]

/** Honest demo fallback: metadata built from the filename only. Clearly labelled in the UI. */
function demoMetadata(fileName: string, keywordCount: number): MetadataResponse {
  const words = slugWords(fileName)
  const topic = words.length > 0 ? words.join(' ') : 'stock asset'
  const titleWords = topic.replace(/\b\w/g, (c) => c.toUpperCase())
  const keywords = [...words]
  for (const w of DEMO_KEYWORD_POOL) {
    if (keywords.length >= keywordCount) break
    if (!keywords.includes(w)) keywords.push(w)
  }
  return {
    title: `${titleWords} — stock photo`,
    description: `A stock asset showing ${topic}. Suitable for commercial use on microstock marketplaces.`,
    category: words.includes('nature') || words.includes('mountain') || words.includes('forest')
      ? 'Nature'
      : 'General',
    contentType: /\.(eps|ai|svg)$/i.test(fileName) ? 'vector' : 'photo',
    keywords: keywords.slice(0, keywordCount),
  }
}

function seoFilename(title: string, ext: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${slug || 'stock-asset'}.${ext}`
}

export default function Metadata() {
  const navigate = useNavigate()
  const [asset, setAsset] = useState<WorkingAsset | null>(() => getWorkingAsset())
  const [file, setFile] = useState<File | null>(null)
  const [marketplaceId, setMarketplaceId] = useState('adobe')
  const [keywordCount, setKeywordCount] = useState(30)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [contentType, setContentType] = useState<'photo' | 'illustration' | 'vector'>('photo')
  const [keywords, setKeywords] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [generating, setGenerating] = useState(false)
  const [truncated, setTruncated] = useState<string[]>([])
  const [copied, setCopied] = useState('')
  const [progress, setProgress] = useState<number | null>(null)

  const preset = getMarketplace(marketplaceId)
  const isVectorish = asset ? /\.(eps|ai|psd|pdf)$/i.test(asset.name) : false

  useEffect(() => {
    // Re-apply marketplace limits when the preset changes.
    const notes: string[] = []
    const t = enforceLimit(title, preset.titleMax)
    if (t.truncated) notes.push('title')
    const d = enforceLimit(description, preset.descriptionMax)
    if (d.truncated) notes.push('description')
    if (t.truncated) setTitle(t.value)
    if (d.truncated) setDescription(d.value)
    if (keywords.length > preset.keywordMax) {
      setKeywords(keywords.slice(0, preset.keywordMax))
      notes.push('keywords')
    }
    setTruncated(notes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketplaceId])

  const handleFile = (file: File) => {
    setFile(file)
    setProgress(10)
    const reader = new FileReader()
    reader.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 90) + 10)
    }
    reader.onload = () => {
      const dataUrl = file.type.startsWith('image/') ? String(reader.result) : null
      const next: WorkingAsset = {
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
        sourceTool: 'Metadata Generator',
      }
      setAsset(next)
      setWorkingAsset(next)
      setProgress(100)
      setTimeout(() => setProgress(null), 600)
      setStatus('')
    }
    reader.readAsDataURL(file)
  }

  const generate = async () => {
    if (!asset) {
      setStatus('Upload a file first.')
      return
    }
    setGenerating(true)
    setStatus('')
    try {
      // Use the real file when available; a transferred asset (no File) still
      // works via filename-only generation on the API side.
      let uploadFile = file
      if (!uploadFile && asset.dataUrl) {
        try {
          const res = await fetch(asset.dataUrl)
          uploadFile = new File([await res.blob()], asset.name, { type: asset.type })
        } catch {
          uploadFile = null
        }
      }
      const api = await generateMetadataApi(uploadFile, marketplaceId, keywordCount, asset.name)
      let result: MetadataResponse
      if (api.ok && api.data) {
        result = api.data
        setStatus(
          api.data.warning
            ? `Generated (${api.data.source ?? 'api'}) — ${api.data.warning}`
            : `Metadata generated by the connected AI service (${api.data.source ?? 'api'}).`,
        )
      } else {
        result = demoMetadata(asset.name, keywordCount)
        setStatus(
          api.error
            ? `API error: ${api.error} — showing demo metadata from the filename only.`
            : 'Demo metadata — Gemini not connected. Generated from the filename only; connect the API for real AI metadata.',
        )
      }
      const notes: string[] = []
      const t = enforceLimit(result.title, preset.titleMax)
      if (t.truncated) notes.push('title')
      const d = enforceLimit(result.description, preset.descriptionMax)
      if (d.truncated) notes.push('description')
      setTitle(t.value)
      setDescription(d.value)
      setCategory(result.category)
      setContentType(result.contentType)
      setKeywords(result.keywords.slice(0, preset.keywordMax))
      setTruncated(notes)
      saveHistoryEntry({
        id: `${Date.now()}`,
        tool: 'Metadata Generator',
        marketplace: preset.name,
        fileName: asset.name,
        date: new Date().toISOString(),
        dataUrl: asset.dataUrl,
        summary: t.value,
      })
    } finally {
      setGenerating(false)
    }
  }

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      setCopied('')
    }
  }

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const rows = [
      ['filename', 'title', 'description', 'category', 'content_type', 'keywords'].join(','),
      [
        seoFilename(title || asset?.name || 'asset', 'jpg'),
        esc(title),
        esc(description),
        esc(category),
        contentType,
        esc(keywords.join(preset.keywordSeparator)),
      ].join(','),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yearmedia-metadata-${preset.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const transfer = (to: string) => {
    if (asset) setWorkingAsset({ ...asset, sourceTool: 'Metadata Generator' })
    navigate(to)
  }

  const ext = asset?.name.split('.').pop()?.toLowerCase() ?? 'jpg'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Metadata Generator</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">
          Upload an asset, pick a marketplace, and generate SEO titles, descriptions and keywords.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <UploadDropzone
            accept={ACCEPT}
            label="Upload your asset"
            hint="JPG, PNG, EPS, AI, PSD, PDF accepted. EPS / AI / PSD / PDF metadata is limited — no image preview and keyword suggestions come from the filename only."
            onFile={handleFile}
            progress={progress}
          />
          <AssetPreview asset={asset} onClear={() => { setAsset(null); clearWorkingAsset() }} />
          {isVectorish && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              Vector / layered file ({ext.toUpperCase()}): metadata is limited for this format — no preview, and AI can only work from the filename.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="marketplace" className="text-sm font-medium">Marketplace</label>
            <select
              id="marketplace"
              value={marketplaceId}
              onChange={(e) => setMarketplaceId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              {MARKETPLACES.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{preset.notes}</p>
          </div>

          <div>
            <label htmlFor="kwcount" className="text-sm font-medium">
              Keyword count: {keywordCount}
            </label>
            <input
              id="kwcount"
              type="range"
              min={5}
              max={50}
              value={keywordCount}
              onChange={(e) => setKeywordCount(Number(e.target.value))}
              className="mt-1 w-full"
            />
            <p className="text-xs text-slate-500">5–50 keywords (marketplace cap: {preset.keywordMax})</p>
          </div>

          <button
            onClick={generate}
            disabled={generating || !asset}
            className="w-full rounded-xl bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {generating ? 'Generating…' : isDemoMode ? 'Generate metadata (demo)' : 'Generate metadata'}
          </button>
          {status && (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">{status}</p>
          )}
          {truncated.length > 0 && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              ⚠️ Truncated to fit {preset.name} limits: {truncated.join(', ')}.
            </p>
          )}
        </div>
      </div>

      {(title || keywords.length > 0) && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">Generated metadata — {preset.name}</h2>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="title" className="text-sm font-medium">
                Title {preset.titleMax !== null && `(${title.length}/${preset.titleMax})`}
              </label>
              <button onClick={() => copy('title', title)} className="text-xs font-medium text-brand-600">Copy{copied === 'title' ? ' ✓' : ''}</button>
            </div>
            <input
              id="title"
              value={title}
              maxLength={preset.titleMax ?? undefined}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {preset.descriptionMax !== null && (
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="desc" className="text-sm font-medium">
                  Description ({description.length}/{preset.descriptionMax})
                </label>
                <button onClick={() => copy('description', description)} className="text-xs font-medium text-brand-600">Copy{copied === 'description' ? ' ✓' : ''}</button>
              </div>
              <textarea
                id="desc"
                value={description}
                maxLength={preset.descriptionMax}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="text-sm font-medium">Category</label>
              <input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label htmlFor="ctype" className="text-sm font-medium">Content type</label>
              <select
                id="ctype"
                value={contentType}
                onChange={(e) => setContentType(e.target.value as 'photo' | 'illustration' | 'vector')}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="photo">Photo</option>
                <option value="illustration">Illustration</option>
                <option value="vector">Vector</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Keywords</span>
              <button onClick={() => copy('keywords', keywords.join(preset.keywordSeparator))} className="text-xs font-medium text-brand-600">Copy all{copied === 'keywords' ? ' ✓' : ''}</button>
            </div>
            <div className="mt-1">
              <KeywordEditor keywords={keywords} onChange={setKeywords} max={preset.keywordMax} />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <span className="font-medium">SEO filename suggestion: </span>
            <code className="break-all">{seoFilename(title || asset?.name || 'asset', ext)}</code>
            <button
              onClick={() => copy('filename', seoFilename(title || asset?.name || 'asset', ext))}
              className="ml-2 text-xs font-medium text-brand-600"
            >
              Copy{copied === 'filename' ? ' ✓' : ''}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900">
              Export CSV ({preset.name})
            </button>
            <button onClick={() => transfer('/dashboard/quality')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              Send to Quality Checker →
            </button>
            <button onClick={() => transfer('/dashboard/remove-bg')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              Send to Background Remover →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
