// Server-side plan gating. Reads req.user.plan (set by requireAuth) and
// returns 403 {error:'upgrade_required', feature, requiredPlan} when the
// user's plan is below the feature's minimum plan. Enforced on the server,
// not just in the UI.

import type { NextFunction, Response } from 'express';
import { FEATURE_MIN_PLAN, PLAN_ORDER, type Feature } from '../lib/plans';
import type { AuthRequest } from './auth';

export function requirePlan(feature: Feature) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const requiredPlan = FEATURE_MIN_PLAN[feature];
    const userPlan = req.user?.plan || 'free';
    if (PLAN_ORDER[userPlan] < PLAN_ORDER[requiredPlan]) {
      res.status(403).json({
        error: 'upgrade_required',
        feature,
        requiredPlan,
        currentPlan: userPlan,
        message: `This feature requires the ${requiredPlan} plan (you are on ${userPlan}).`,
      });
      return;
    }
    next();
  };
}
