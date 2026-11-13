import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { requirePlan } from '../middleware/requirePlan';
import { addHistory, deleteHistory, listHistory } from '../lib/db';

const router = Router();

// History is only ever returned here — upload/tool endpoints never
// auto-return history.

router.get('/', requireAuth, requirePlan('history'), async (req: AuthRequest, res: Response) => {
  try {
    res.json({ history: await listHistory(req.user!.id) });
  } catch (err) {
    console.error('[history] list failed:', (err as Error).message);
    res.status(500).json({ error: 'internal_error', message: 'Could not load history.' });
  }
});

router.post('/', requireAuth, requirePlan('history'), async (req: AuthRequest, res: Response) => {
  const assetName = typeof req.body?.assetName === 'string' ? req.body.assetName.trim() : '';
  const tool = typeof req.body?.tool === 'string' ? req.body.tool.trim() : '';
  if (!assetName || !tool) {
    res.status(400).json({ error: 'invalid_input', message: 'assetName and tool are required.' });
    return;
  }
  try {
    const entry = await addHistory({
      userId: req.user!.id,
      assetName,
      tool,
      marketplace: typeof req.body?.marketplace === 'string' ? req.body.marketplace : undefined,
      resultSummary: typeof req.body?.resultSummary === 'string' ? req.body.resultSummary : undefined,
    });
    res.status(201).json({ history: entry });
  } catch (err) {
    console.error('[history] add failed:', (err as Error).message);
    res.status(500).json({ error: 'internal_error', message: 'Could not save history.' });
  }
});

router.delete('/:id', requireAuth, requirePlan('history'), async (req: AuthRequest, res: Response) => {
  try {
    const ok = await deleteHistory(req.user!.id, req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'not_found', message: 'History entry not found.' });
      return;
    }
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    console.error('[history] delete failed:', (err as Error).message);
    res.status(500).json({ error: 'internal_error', message: 'Could not delete history.' });
  }
});

export default router;
