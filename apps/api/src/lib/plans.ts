// Plans, features, periods and marketplace limits for YearMedia.
// Prices are intentionally TBD (null) until Boss sets them.

export type PlanId = 'free' | 'pro' | 'premium';

export const PLAN_ORDER: Record<PlanId, number> = { free: 0, pro: 1, premium: 2 };

export interface PlanInfo {
  id: PlanId;
  name: string;
  price: number | null; // null = TBD, not yet set by Boss
  priceNote: string;
  features: string[];
}

export const PLANS: PlanInfo[] = [
  {
    id: 'free',
    name: 'Free (Trial)',
    price: null,
    priceNote: 'Free trial — pricing TBD',
    features: [
      'AI metadata: 5 generations / month (demo limit)',
      'Image quality checker',
      'JPG/PNG to SVG converter',
      'Asset history',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: null,
    priceNote: 'Pricing TBD',
    features: [
      'AI metadata: unlimited',
      'Image quality checker',
      'AI background remover',
      'Image upscaler up to 2x',
      'JPG/PNG to SVG converter',
      'SVG to EPS converter',
      'Asset history',
      'CSV export',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: null,
    priceNote: 'Pricing TBD',
    features: [
      'Everything in Pro',
      'Image upscaler up to 4x',
      'JPG/PNG to PSD converter',
      'Priority processing (planned)',
    ],
  },
];

/** Subscription periods in months: 1, 6, 12, 60 (5 years). */
export const PERIODS_MONTHS = [1, 6, 12, 60] as const;
export type PeriodMonths = (typeof PERIODS_MONTHS)[number];

/**
 * Feature -> minimum plan required. Server-enforced by requirePlan().
 * 'metadata' is available on free but capped at 5 generations/month
 * (enforced separately in the metadata route, see FREE_METADATA_MONTHLY_LIMIT).
 */
export type Feature =
  | 'metadata'
  | 'quality'
  | 'remove-bg'
  | 'upscale'
  | 'converters-svg'
  | 'converters-eps'
  | 'converters-psd'
  | 'history'
  | 'csv-export';

export const FEATURE_MIN_PLAN: Record<Feature, PlanId> = {
  metadata: 'free',
  quality: 'free',
  'remove-bg': 'pro',
  upscale: 'pro',
  'converters-svg': 'free',
  'converters-eps': 'pro',
  'converters-psd': 'premium',
  history: 'free',
  'csv-export': 'pro',
};

/** Free-plan demo cap for AI metadata generations per calendar month. */
export const FREE_METADATA_MONTHLY_LIMIT = 5;

/** Marketplace keyword / title limits enforced server-side. */
export interface MarketplacePreset {
  marketplace: string;
  keywordLimit: number;
  titleMaxChars: number;
  descriptionMaxChars: number;
  csvColumns: string[];
}

export const MARKETPLACE_PRESETS: Record<string, MarketplacePreset> = {
  adobe: {
    marketplace: 'adobe',
    keywordLimit: 200,
    titleMaxChars: 200,
    descriptionMaxChars: 200,
    csvColumns: ['Filename', 'Title', 'Description', 'Keywords', 'Categories'],
  },
  shutterstock: {
    marketplace: 'shutterstock',
    keywordLimit: 50,
    titleMaxChars: 200,
    descriptionMaxChars: 200,
    csvColumns: ['Filename', 'Description', 'Keywords', 'Categories'],
  },
  freepik: {
    marketplace: 'freepik',
    keywordLimit: 50,
    titleMaxChars: 200,
    descriptionMaxChars: 200,
    csvColumns: ['Title', 'Keywords'],
  },
  dreamstime: {
    marketplace: 'dreamstime',
    keywordLimit: 50,
    titleMaxChars: 200,
    descriptionMaxChars: 200,
    csvColumns: ['Filename', 'Title', 'Description', 'Keywords', 'Categories'],
  },
  '123rf': {
    marketplace: '123rf',
    keywordLimit: 50,
    titleMaxChars: 200,
    descriptionMaxChars: 200,
    csvColumns: ['Filename', 'Title', 'Description', 'Keywords', 'Categories'],
  },
  istock: {
    marketplace: 'istock',
    keywordLimit: 50,
    titleMaxChars: 200,
    descriptionMaxChars: 200,
    csvColumns: ['Filename', 'Title', 'Description', 'Keywords', 'Categories'],
  },
  alamy: {
    marketplace: 'alamy',
    keywordLimit: 50,
    titleMaxChars: 200,
    descriptionMaxChars: 200,
    csvColumns: ['Filename', 'Title', 'Description', 'Keywords', 'Categories'],
  },
};

export const DEFAULT_MARKETPLACE = 'adobe';

export function getPreset(marketplace?: string): MarketplacePreset {
  const key = (marketplace || DEFAULT_MARKETPLACE).toLowerCase();
  return MARKETPLACE_PRESETS[key] || MARKETPLACE_PRESETS[DEFAULT_MARKETPLACE];
}
