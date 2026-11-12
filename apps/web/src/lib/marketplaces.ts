// Marketplace presets for the YearMedia metadata generator.
//
// NOTE: limits from marketplace contributor guides, verify before launch.
// Limits change over time — re-check each marketplace's contributor guide
// before publishing metadata generated with these presets.

export interface MarketplacePreset {
  id: string
  name: string
  titleMax: number | null
  descriptionMax: number | null
  keywordMax: number
  keywordSeparator: string
  notes: string
}

export const MARKETPLACES: MarketplacePreset[] = [
  {
    id: 'adobe',
    name: 'Adobe Stock',
    titleMax: 200,
    descriptionMax: 200,
    keywordMax: 200,
    keywordSeparator: ', ',
    notes: 'Title and description up to 200 characters; up to 200 keywords. First 10 keywords matter most.',
  },
  {
    id: 'shutterstock',
    name: 'Shutterstock',
    titleMax: 200,
    descriptionMax: 200,
    keywordMax: 50,
    keywordSeparator: ', ',
    notes: 'Up to 200-char title/description; up to 50 keywords. Keywords are ordered by relevance.',
  },
  {
    id: 'freepik',
    name: 'Freepik',
    titleMax: 200,
    descriptionMax: null,
    keywordMax: 50,
    keywordSeparator: ', ',
    notes: 'Up to 50 keywords/tags. Title up to 200 characters; no separate description field.',
  },
  {
    id: 'dreamstime',
    name: 'Dreamstime',
    titleMax: 200,
    descriptionMax: null,
    keywordMax: 50,
    keywordSeparator: ', ',
    notes: 'Up to 50 keywords. Title up to 200 characters.',
  },
  {
    id: '123rf',
    name: '123RF',
    titleMax: null,
    descriptionMax: null,
    keywordMax: 50,
    keywordSeparator: ', ',
    notes: 'Up to 50 keywords. No strict title/description limits enforced here — check the contributor guide.',
  },
  {
    id: 'istock',
    name: 'iStock',
    titleMax: 200,
    descriptionMax: null,
    keywordMax: 50,
    keywordSeparator: ', ',
    notes: 'Up to 50 keywords. Title up to 200 characters.',
  },
  {
    id: 'alamy',
    name: 'Alamy',
    titleMax: 200,
    descriptionMax: null,
    keywordMax: 50,
    keywordSeparator: ', ',
    notes: 'Up to 50 keywords. Title up to 200 characters.',
  },
]

export function getMarketplace(id: string): MarketplacePreset {
  return MARKETPLACES.find((m) => m.id === id) ?? MARKETPLACES[0]
}

/** Truncate a string to a marketplace limit, reporting whether it was cut. */
export function enforceLimit(value: string, max: number | null): { value: string; truncated: boolean } {
  if (max === null) return { value, truncated: false }
  if (value.length <= max) return { value, truncated: false }
  return { value: value.slice(0, max), truncated: true }
}
