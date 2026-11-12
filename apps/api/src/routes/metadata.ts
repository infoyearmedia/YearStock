import { Router, type Response } from 'express';
import multer from 'multer';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { requirePlan } from '../middleware/requirePlan';
import {
  FREE_METADATA_MONTHLY_LIMIT,
  MARKETPLACE_PRESETS,
  getPreset,
  type MarketplacePreset,
} from '../lib/plans';
import { addJob, countJobsThisMonth } from '../lib/store';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash'; // fallback model: gemini-1.5-flash

interface MetadataResult {
  title: string;
  description: string;
  keywords: string[];
  categories: string[];
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function titleCase(words: string[]): string {
  return words
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Honest demo fallback: derive metadata from the filename only.
 * No AI is involved here — the response is labelled source:'demo-fallback'.
 */
function fallbackFromFilename(filename: string, preset: MarketplacePreset, keywordCount: number): MetadataResult {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = base.split(' ').filter(Boolean);
  const title = truncate(titleCase(tokens) || 'Untitled stock asset', preset.titleMaxChars);
  const description = truncate(
    `${title} — stock photo / illustration for ${preset.marketplace}.`,
    preset.descriptionMaxChars,
  );
  const generic = ['stock', 'background', 'concept', 'design', 'isolated', 'creative'];
  const keywords: string[] = [];
  for (const w of [...tokens.map((t) => t.toLowerCase()), ...generic]) {
    if (!keywords.includes(w)) keywords.push(w);
    if (keywords.length >= Math.min(keywordCount, preset.keywordLimit)) break;
  }
  return { title, description, keywords, categories: [] };
}

async function geminiMetadata(
  image: { buffer: Buffer; mimetype: string } | null,
  filename: string,
  preset: MarketplacePreset,
  keywordCount: number,
): Promise<MetadataResult | null> {
  const prompt =
    `You generate microstock metadata. Return ONLY valid JSON with keys ` +
    `title (<=${preset.titleMaxChars} chars), description (<=${preset.descriptionMaxChars} chars), ` +
    `keywords (array of ${Math.min(keywordCount, preset.keywordLimit)} single-word or short-phrase keywords, ` +
    `no duplicates), categories (array of 1-2 marketplace categories). ` +
    `Marketplace: ${preset.marketplace}. Filename hint: ${filename}.`;
  const parts: any[] = [{ text: prompt }];
  if (image) {
    parts.push({
      inlineData: { mimeType: image.mimetype, data: image.buffer.toString('base64') },
    });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonText = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonText) as MetadataResult;
    return {
      title: truncate(String(parsed.title || ''), preset.titleMaxChars),
      description: truncate(String(parsed.description || ''), preset.descriptionMaxChars),
      keywords: (Array.isArray(parsed.keywords) ? parsed.keywords : [])
        .map(String)
        .slice(0, preset.keywordLimit),
      categories: (Array.isArray(parsed.categories) ? parsed.categories : []).map(String),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseKeywordCount(body: any): number {
  const n = Number(body?.keywordCount);
  if (!Number.isFinite(n)) return 30;
  return Math.min(50, Math.max(5, Math.floor(n)));
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildCsv(items: any[], preset: MarketplacePreset): string {
  const rows: string[][] = [preset.csvColumns];
  for (const item of items) {
    const keywords = Array.isArray(item.keywords)
      ? item.keywords.join(', ')
      : String(item.keywords || '');
    const categories = Array.isArray(item.categories)
      ? item.categories.join(', ')
      : String(item.categories || '');
    const map: Record<string, string> = {
      Filename: String(item.filename || ''),
      Title: truncate(String(item.title || ''), preset.titleMaxChars),
      Description: truncate(String(item.description || ''), preset.descriptionMaxChars),
      Keywords: keywords,
      Categories: categories,
    };
    rows.push(preset.csvColumns.map((c) => map[c] ?? ''));
  }
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

// POST /api/metadata — multipart image OR JSON {filename, marketplace, keywordCount}
router.post(
  '/',
  requireAuth,
  requirePlan('metadata'),
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    // Free-plan demo cap: 5 generations / calendar month.
    if (user.plan === 'free' && countJobsThisMonth(user.id, 'metadata') >= FREE_METADATA_MONTHLY_LIMIT) {
      res.status(403).json({
        error: 'upgrade_required',
        feature: 'metadata',
        requiredPlan: 'pro',
        message: `Free plan allows ${FREE_METADATA_MONTHLY_LIMIT} metadata generations per month. Upgrade to Pro for unlimited.`,
      });
      return;
    }
    const filename =
      req.file?.originalname ||
      (typeof req.body?.filename === 'string' ? req.body.filename : '') ||
      'untitled.jpg';
    const preset = getPreset(req.body?.marketplace);
    const keywordCount = parseKeywordCount(req.body);
    addJob(user.id, 'metadata', 'done');

    if (GEMINI_API_KEY) {
      const image = req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : null;
      const result = await geminiMetadata(image, filename, preset, keywordCount);
      if (result) {
        res.json({ ...result, marketplace: preset.marketplace, source: 'gemini', model: GEMINI_MODEL });
        return;
      }
      // Gemini configured but the call failed — fall back honestly, don't invent.
      const fallback = fallbackFromFilename(filename, preset, keywordCount);
      res.json({
        ...fallback,
        marketplace: preset.marketplace,
        source: 'demo-fallback',
        warning: 'Gemini API call failed — metadata derived from filename only',
      });
      return;
    }

    const fallback = fallbackFromFilename(filename, preset, keywordCount);
    res.json({
      ...fallback,
      marketplace: preset.marketplace,
      source: 'demo-fallback',
      warning: 'Gemini API key not configured — metadata derived from filename only',
    });
  },
);

// GET /api/metadata/presets — marketplace presets (keyword limits, CSV columns).
router.get('/presets', (_req, res: Response) => {
  res.json({ presets: Object.values(MARKETPLACE_PRESETS) });
});

// POST /api/metadata/csv — marketplace-specific CSV (pro+).
router.post('/csv', requireAuth, requirePlan('csv-export'), (req: AuthRequest, res: Response) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'invalid_input', message: 'items must be a non-empty array.' });
    return;
  }
  const preset = getPreset(req.body?.marketplace);
  const csv = buildCsv(items, preset);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="metadata-${preset.marketplace}.csv"`);
  res.send(csv);
});

// POST /api/metadata/embed — embed title/keywords into a JPG/PNG file.
// Honest status: NOT implemented yet. sharp can read/verify an image but
// cannot write IPTC/XMP keyword metadata; that needs exiftool (planned).
// EPS/AI/PSD/PDF are not supported for embedding at all (yet).
router.post('/embed', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'invalid_input', message: 'An image file is required (field: image).' });
    return;
  }
  const ext = (file.originalname.split('.').pop() || '').toLowerCase();
  if (['eps', 'ai', 'psd', 'pdf'].includes(ext)) {
    res.status(501).json({
      error: 'not_implemented',
      message: `Metadata embedding not supported for .${ext} files yet.`,
    });
    return;
  }
  if (!['jpg', 'jpeg', 'png'].includes(ext)) {
    res.status(400).json({ error: 'invalid_input', message: 'Only JPG/PNG files are supported for embedding.' });
    return;
  }
  // Verify the file is a readable image with sharp if available, then report
  // honestly that embedding itself is not implemented yet.
  try {
    const sharpMod = await import('sharp');
    await sharpMod.default(file.buffer).metadata();
  } catch {
    // sharp unavailable or file unreadable — still 501, embedding is the gap.
  }
  res.status(501).json({
    error: 'not_implemented',
    message:
      'Metadata embedding is not implemented yet — sharp cannot write IPTC/XMP keywords; exiftool support is planned.',
  });
});

export default router;
