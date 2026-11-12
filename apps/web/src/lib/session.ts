// Session handling: two separate stores with different lifetimes.
//
// 1. Temporary WORKING session — sessionStorage. Holds the asset currently
//    being worked on (e.g. passed from Metadata Generator to Quality Checker).
//    Cleared when the browser tab/session ends. A fresh session starts empty.
// 2. Permanent HISTORY — localStorage. Only read/written when the user
//    explicitly clicks "Load history" / saves an entry. NEVER auto-displayed
//    in a fresh session.
//
// Auth session is also localStorage (demo mode only, no server).

export interface AuthSession {
  email: string
  plan: 'free' | 'pro' | 'premium'
  createdAt: string
}

export interface WorkingAsset {
  name: string
  type: string
  size: number
  /** Data URL of the file (images only; other types store no preview). */
  dataUrl: string | null
  sourceTool: string
  /** Serialised metadata carried between tools, if any. */
  metadata?: Record<string, unknown>
}

export interface HistoryEntry {
  id: string
  tool: string
  marketplace: string
  fileName: string
  date: string
  /** Data URL for re-download (images only). */
  dataUrl: string | null
  summary: string
}

const AUTH_KEY = 'ym_auth'
const WORKING_KEY = 'ym_working_asset'
const HISTORY_KEY = 'ym_history'

// --- Auth (localStorage, demo mode) ---

export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem('ym_api_token')
  // A logout ends the working session too.
  sessionStorage.removeItem(WORKING_KEY)
}

// --- Working session (sessionStorage, temporary) ---

export function getWorkingAsset(): WorkingAsset | null {
  try {
    const raw = sessionStorage.getItem(WORKING_KEY)
    return raw ? (JSON.parse(raw) as WorkingAsset) : null
  } catch {
    return null
  }
}

export function setWorkingAsset(asset: WorkingAsset): void {
  sessionStorage.setItem(WORKING_KEY, JSON.stringify(asset))
}

export function clearWorkingAsset(): void {
  sessionStorage.removeItem(WORKING_KEY)
}

// --- History (localStorage, explicit load/save only) ---

/** Read history ONLY after the user clicks "Load history". */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

export function saveHistoryEntry(entry: HistoryEntry): void {
  const existing = loadHistory()
  existing.unshift(entry)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(existing.slice(0, 200)))
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
}

// --- Theme ---

export function getTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('ym_theme')
  return stored === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem('ym_theme', theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
