// Subscription plans and feature gating.
//
// Prices are TBD placeholders — do NOT treat these as final prices.
// Upgrade buttons in the UI are disabled until pricing is confirmed.

export type PlanId = 'free' | 'pro' | 'premium'

export type FeatureId =
  | 'metadata'
  | 'quality'
  | 'remove-bg'
  | 'upscale'
  | 'converters'
  | 'history'
  | 'bulk'
  | 'api'

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  /** Price placeholder — always shown as TBD until confirmed. */
  priceNote: string
  features: string[]
  lockedFeatures: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free Trial',
    tagline: 'Try the core tools',
    priceNote: '$0 — trial',
    features: [
      'AI Metadata Generator (limited)',
      'Image Quality Checker (basic)',
      'Asset History (local only)',
    ],
    lockedFeatures: [
      'AI Background Remover',
      'Image Upscaler (2x / 4x)',
      'File Converters (SVG / EPS / PSD)',
      'Bulk processing',
      'API access',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For regular contributors',
    priceNote: 'Pricing TBD — contact Year Media',
    features: [
      'Everything in Free Trial',
      'AI Background Remover',
      'Image Upscaler (2x / 4x)',
      'File Converters (SVG / EPS / PSD)',
      'Bulk processing',
    ],
    lockedFeatures: ['API access', 'Priority processing'],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'For high-volume studios',
    priceNote: 'Pricing TBD — contact Year Media',
    features: [
      'Everything in Pro',
      'API access',
      'Priority processing',
      'Unlimited history',
    ],
    lockedFeatures: [],
  },
]

/** Feature access per plan. Free Trial is the default plan for every new account. */
const PLAN_FEATURES: Record<PlanId, FeatureId[]> = {
  free: ['metadata', 'quality', 'history'],
  pro: ['metadata', 'quality', 'remove-bg', 'upscale', 'converters', 'history', 'bulk'],
  premium: ['metadata', 'quality', 'remove-bg', 'upscale', 'converters', 'history', 'bulk', 'api'],
}

export function canAccess(plan: PlanId, feature: FeatureId): boolean {
  return PLAN_FEATURES[plan].includes(feature)
}

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}

/** Billing periods offered (months). Prices are TBD for all periods. */
export const BILLING_PERIODS = [
  { months: 1, label: '1 month' },
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 60, label: '5 years' },
]
