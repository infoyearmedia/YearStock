import { Router, type Response } from 'express';
import multer from 'multer';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { requirePlan } from '../middleware/requirePlan';
import { proxyToAi } from '../lib/aiProxy';
import { FEATURE_MIN_PLAN, PLAN_ORDER } from '../lib/plans';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

function aiUnavailable(res: Response): void {
  res.status(503).json({ error: 'ai_unavailable', message: 'AI service unavailable' });
}

function forwardFile(req: AuthRequest, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  const file = (req as any).file as Express.Multer.File | undefined;
  if (file) {
    form.append('image', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  }
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

async function proxyOr503(res: Response, path: string, form: FormData): Promise<void> {
  const proxied = await proxyToAi(path, { method: 'POST', body: form });
  if (!proxied) {
    aiUnavailable(res);
    return;
  }
  res.status(proxied.status);
  if (proxied.contentType) res.setHeader('Content-Type', proxied.contentType);
  res.send(proxied.body);
}

// POST /api/tools/remove-bg — pro+
router.post('/remove-bg', requireAuth, requirePlan('remove-bg'), upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'invalid_input', message: 'An image file is required (field: image).' });
    return;
  }
  await proxyOr503(res, '/remove-bg', forwardFile(req));
});

// POST /api/tools/upscale — pro (2x), premium (4x). scale in body/query.
router.post('/upscale', requireAuth, requirePlan('upscale'), upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'invalid_input', message: 'An image file is required (field: image).' });
    return;
  }
  const scale = Number(req.body?.scale ?? req.query?.scale ?? 2);
  if (![2, 4].includes(scale)) {
    res.status(400).json({ error: 'invalid_input', message: 'scale must be 2 or 4.' });
    return;
  }
  if (scale === 4 && req.user!.plan !== 'premium') {
    res.status(403).json({
      error: 'upgrade_required',
      feature: 'upscale',
      requiredPlan: 'premium',
      message: '4x upscaling requires the premium plan (pro allows 2x).',
    });
    return;
  }
  await proxyOr503(res, '/upscale', forwardFile(req, { scale: String(scale) }));
});

// POST /api/tools/convert — target: svg (free), eps (pro), psd (premium), jpg/png (free).
router.post('/convert', requireAuth, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'invalid_input', message: 'An image file is required (field: image).' });
    return;
  }
  const target = String(req.body?.target ?? req.query?.target ?? '').toLowerCase();
  const planForTarget: Record<string, 'converters-svg' | 'converters-eps' | 'converters-psd'> = {
    svg: 'converters-svg',
    eps: 'converters-eps',
    psd: 'converters-psd',
  };
  if (!['svg', 'eps', 'psd', 'jpg', 'jpeg', 'png'].includes(target)) {
    res.status(400).json({ error: 'invalid_input', message: 'target must be one of svg, eps, psd, jpg, png.' });
    return;
  }
  // Plan gate for the paid converters; jpg/png/svg are free-tier.
  if (target in planForTarget) {
    const feature = planForTarget[target];
    const required = FEATURE_MIN_PLAN[feature];
    if (PLAN_ORDER[req.user!.plan] < PLAN_ORDER[required]) {
      res.status(403).json({
        error: 'upgrade_required',
        feature,
        requiredPlan: required,
        message: `Converting to ${target.toUpperCase()} requires the ${required} plan.`,
      });
      return;
    }
  }
  // The AI service expects from_format/to_format (not `target`) and the
  // file field named `image` — derive the source format from the filename.
  const fromFormat = (req.file.originalname.split('.').pop() || '').toLowerCase();
  await proxyOr503(res, '/convert', forwardFile(req, { from_format: fromFormat, to_format: target }));
});

export default router;
