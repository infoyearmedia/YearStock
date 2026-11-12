// API layer — talks to the real YearMedia API (apps/api) when VITE_API_URL
// is set, otherwise the app runs in DEMO MODE with honest client-side
// fallbacks labelled as such in the UI. No real backend keys are required
// to run the app.
//
// Contract with apps/api (keep in sync):
//   POST /api/auth/login | /api/auth/signup  {email,password} -> {user, token}
//   POST /api/metadata        multipart image (optional) + marketplace + keywordCount
//                              -> {title, description, keywords, categories, marketplace, source, warning?}
//   POST /api/quality         multipart image -> {source, metrics, risks, overallRisk, note}
//   POST /api/tools/remove-bg multipart image -> PNG bytes (or JSON error)
//   POST /api/tools/upscale   multipart image + ?scale=2|4 -> image bytes
//   POST /api/tools/convert   multipart image + target=svg|eps|psd|jpg|png -> file bytes
// Auth: Bearer JWT from /api/auth/*, stored in localStorage 'ym_api_token'.

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export const isDemoMode = API_URL === ''

const TOKEN_KEY = 'ym_api_token'

export function getApiToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setApiToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearApiToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export interface ApiResult<T> {
  ok: boolean
  data?: T
  error?: string
  status?: number
}

function authHeaders(): Record<string, string> {
  const token = getApiToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function readError(res: Response): Promise<string> {
  try {
    const j = await res.clone().json()
    if (typeof j?.message === 'string') return j.message
    if (typeof j?.error === 'string') return j.error
  } catch {
    /* not JSON */
  }
  return `API error ${res.status}`
}

async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  if (isDemoMode) return { ok: false, error: 'API not connected (demo mode)' }
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false, error: await readError(res), status: res.status }
    return { ok: true, data: (await res.json()) as T, status: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

async function postForm<T>(path: string, form: FormData): Promise<ApiResult<T>> {
  if (isDemoMode) return { ok: false, error: 'API not connected (demo mode)' }
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: form,
    })
    if (!res.ok) return { ok: false, error: await readError(res), status: res.status }
    return { ok: true, data: (await res.json()) as T, status: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/** POST a form and expect binary bytes back (image/file result). */
async function postFormBlob(
  path: string,
  form: FormData,
): Promise<ApiResult<{ url: string; filename: string; contentType: string }>> {
  if (isDemoMode) return { ok: false, error: 'API not connected (demo mode)' }
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: form,
    })
    if (!res.ok) return { ok: false, error: await readError(res), status: res.status }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const cd = res.headers.get('Content-Disposition') ?? ''
    const m = /filename="?([^";]+)"?/.exec(cd)
    return {
      ok: true,
      data: { url, filename: m?.[1] ?? 'result', contentType: res.headers.get('Content-Type') ?? blob.type },
      status: res.status,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/** Rebuild a File from a stored data URL (assets transferred between tools). */
export async function fileFromDataUrl(name: string, type: string, dataUrl: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], name, { type: type || blob.type })
}

// --- Auth ---

export interface AuthResponse {
  user: { id: string; email: string; plan: 'free' | 'pro' | 'premium' }
  token: string
}

export async function loginApi(email: string, password: string): Promise<ApiResult<AuthResponse>> {
  const r = await postJson<AuthResponse>('/api/auth/login', { email, password })
  if (r.ok && r.data) setApiToken(r.data.token)
  return r
}

export async function signupApi(email: string, password: string): Promise<ApiResult<AuthResponse>> {
  const r = await postJson<AuthResponse>('/api/auth/signup', { email, password })
  if (r.ok && r.data) setApiToken(r.data.token)
  return r
}

// --- Metadata ---

export interface MetadataResponse {
  title: string
  description: string
  category: string
  contentType: 'photo' | 'illustration' | 'vector'
  keywords: string[]
  source?: string
  warning?: string
}

export async function generateMetadataApi(
  file: File | null,
  marketplace: string,
  keywordCount: number,
  filename?: string,
): Promise<ApiResult<MetadataResponse>> {
  const form = new FormData()
  if (file) form.append('image', file, file.name)
  else form.append('filename', filename ?? 'untitled.jpg')
  form.append('marketplace', marketplace)
  form.append('keywordCount', String(keywordCount))
  const raw = await postForm<{
    title: string
    description: string
    keywords: string[]
    categories?: string[]
    category?: string
    source?: string
    warning?: string
  }>('/api/metadata', form)
  if (!raw.ok || !raw.data) return { ok: false, error: raw.error, status: raw.status }
  const d = raw.data
  const name = file?.name ?? filename ?? ''
  return {
    ok: true,
    status: raw.status,
    data: {
      title: d.title ?? '',
      description: d.description ?? '',
      category: d.category ?? d.categories?.[0] ?? '',
      contentType: /\.(eps|ai|svg)$/i.test(name) ? 'vector' : 'photo',
      keywords: Array.isArray(d.keywords) ? d.keywords : [],
      source: d.source,
      warning: d.warning,
    },
  }
}

// --- Quality ---

export interface QualityApiResponse {
  source: string
  metrics: Record<string, unknown>
  risks: { code: string; message: string; severity: 'low' | 'medium' | 'high' }[]
  overallRisk: 'low' | 'medium' | 'high'
  note?: string
}

export function checkQualityApi(file: File): Promise<ApiResult<QualityApiResponse>> {
  const form = new FormData()
  form.append('image', file, file.name)
  return postForm<QualityApiResponse>('/api/quality', form)
}

// --- Background removal / upscale / convert (binary results) ---

export type FileResult = { url: string; filename: string; contentType: string }

export function removeBackgroundApi(file: File): Promise<ApiResult<FileResult>> {
  const form = new FormData()
  form.append('image', file, file.name)
  return postFormBlob('/api/tools/remove-bg', form)
}

export function upscaleApi(file: File, scale: 2 | 4): Promise<ApiResult<FileResult>> {
  const form = new FormData()
  form.append('image', file, file.name)
  return postFormBlob(`/api/tools/upscale?scale=${scale}`, form)
}

export function convertApi(file: File, target: string): Promise<ApiResult<FileResult>> {
  const form = new FormData()
  form.append('image', file, file.name)
  form.append('target', target.toLowerCase())
  return postFormBlob('/api/tools/convert', form)
}
