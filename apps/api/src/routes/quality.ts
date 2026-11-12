import { Router, type Response } from 'express';
import multer from 'multer';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { requirePlan } from '../middleware/requirePlan';
import { aiServiceReachable, proxyToAi } from '../lib/aiProxy';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

type Risk = 'low' | 'medium' | 'high';

/**
 * Local quality analysis (used when the AI service is unreachable).
 *
 * Method — all values are MEASURED, never invented:
 * - resolution/format/file size: from the file itself / sharp metadata.
 * - compression estimate: bytes per pixel (file size / pixel count). A very
 *   low bytes-per-pixel for a photo suggests heavy JPEG compression.
 * - exposure: mean brightness from sharp().stats() channel means (0-255).
 * - sharpness: Laplacian variance proxy. The image is converted to
 *   greyscale, convolved with the Laplacian kernel
 *   [[0,1,0],[1,-4,1],[0,1,0]], and the standard deviation of the
 *   convolved image is reported as `laplacianStddev`. Higher = more edge
 *   energy = sharper (relative only; there is no universal pass threshold,
 *   so we report the number and flag only very low values as a risk).
 * No 0-100 "approval score" is produced — only measured metrics plus
 * risks[] derived from documented thresholds, and an overallRisk of
 * low/medium/high derived from how many risks fired.
 */
async function localAnalysis(file: Express.Multer.File) {
  const metrics: Record<string, unknown> = {
    filename: file.originalname,
    fileSizeBytes: file.size,
    mimetype: file.mimetype,
  };
  const risks: { code: string; message: string; severity: Risk }[] = [];

  let sharpAvailable = true;
  try {
    const sharpMod = await import('sharp');
    const img = sharpMod.default(file.buffer);
    const meta = await img.metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    const pixels = width * height;
    metrics.width = width;
    metrics.height = height;
    metrics.format = meta.format;
    metrics.hasAlpha = meta.hasAlpha;
    if (pixels > 0) {
      metrics.bytesPerPixel = Number((file.size / pixels).toFixed(4));
      if (file.size / pixels < 0.15 && (meta.format === 'jpeg' || meta.format === 'jpg')) {
        risks.push({
          code: 'heavy_compression',
          message: 'Very low bytes-per-pixel for a JPEG — likely heavy compression / artefacts.',
          severity: 'medium',
        });
      }
    }
    if (width > 0 && (width < 1000 || height < 1000)) {
      risks.push({
        code: 'low_resolution',
        message: `Resolution ${width}x${height} is below 1000px on a side; most marketplaces prefer 2000px+.`,
        severity: 'medium',
      });
    }
    if (width > 0 && width < 500) {
      risks.push({ code: 'very_low_resolution', message: 'Resolution below 500px is too small for stock.', severity: 'high' });
    }

    const stats = await img.stats();
    // Mean brightness across channels (0-255).
    const means = stats.channels.map((c) => c.mean);
    const meanBrightness = means.reduce((a, b) => a + b, 0) / Math.max(means.length, 1);
    metrics.meanBrightness = Number(meanBrightness.toFixed(1));
    if (meanBrightness < 30) {
      risks.push({ code: 'underexposed', message: 'Mean brightness is very low — image looks underexposed.', severity: 'medium' });
    } else if (meanBrightness > 235) {
      risks.push({ code: 'overexposed', message: 'Mean brightness is very high — image looks overexposed / blown out.', severity: 'medium' });
    }

    // Sharpness proxy: Laplacian variance via convolve, then stddev of result.
    const grey = sharpMod.default(file.buffer).greyscale().resize(800, 800, { fit: 'inside', withoutEnlargement: true });
    const lap = await grey
      .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const vals = lap.data;
    let sum = 0;
    for (let i = 0; i < vals.length; i++) sum += vals[i];
    const mean = sum / vals.length;
    let sq = 0;
    for (let i = 0; i < vals.length; i++) sq += (vals[i] - mean) ** 2;
    const laplacianStddev = Math.sqrt(sq / vals.length);
    metrics.laplacianStddev = Number(laplacianStddev.toFixed(2));
    metrics.sharpnessNote =
      'Laplacian stddev is a relative edge-energy proxy (higher = sharper); no universal pass threshold exists.';
    if (laplacianStddev < 5) {
      risks.push({ code: 'possibly_blurry', message: 'Very low Laplacian edge energy — image may be blurry or out of focus.', severity: 'medium' });
    }
  } catch {
    sharpAvailable = false;
    metrics.sharpNote = 'sharp unavailable — resolution/brightness/sharpness could not be measured locally.';
  }

  const highCount = risks.filter((r) => r.severity === 'high').length;
  const medCount = risks.filter((r) => r.severity === 'medium').length;
  const overallRisk: Risk = highCount > 0 || medCount >= 2 ? 'high' : medCount === 1 ? 'medium' : 'low';

  return {
    source: 'local-analysis',
    sharpAvailable,
    metrics,
    risks,
    overallRisk,
    note: 'Measured metrics only — no approval score. Check risks[] against marketplace requirements.',
  };
}

// POST /api/quality — multipart image. Proxies to the AI service when it is
// reachable, otherwise runs the honest local analysis above.
router.post('/', requireAuth, requirePlan('quality'), upload.single('image'), async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'invalid_input', message: 'An image file is required (field: image).' });
    return;
  }

  if (await aiServiceReachable()) {
    const form = new FormData();
    form.append('image', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    const proxied = await proxyToAi('/quality', { method: 'POST', body: form });
    if (proxied) {
      res.status(proxied.status);
      if (proxied.contentType) res.setHeader('Content-Type', proxied.contentType);
      res.send(proxied.body);
      return;
    }
    // AI service was reachable at /health but the proxy call failed — fall through to local.
  }

  const result = await localAnalysis(file);
  res.json(result);
});

export default router;
