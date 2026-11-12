// Proxy helper: forward a request to the Python AI service (services/ai).
// 60s timeout; returns null when the service is unreachable so callers can
// answer 503 "AI service unavailable" or fall back to local analysis.

export const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || 'http://localhost:8000';

export interface ProxyResult {
  ok: boolean;
  status: number;
  contentType: string | null;
  body: Buffer;
}

export async function proxyToAi(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<ProxyResult | null> {
  const timeoutMs = init.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${AI_SERVICE_URL.replace(/\/$/, '')}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type'),
      body: buf,
    };
  } catch {
    return null; // unreachable / timed out
  } finally {
    clearTimeout(timer);
  }
}

/** Quick reachability check (short timeout) before deciding local vs proxy. */
export async function aiServiceReachable(timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${AI_SERVICE_URL.replace(/\/$/, '')}/health`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
