/**
 * Strategic Plan 2025-2030 – pillars and core objectives.
 * Use these constants across the app for dropdowns, filters, and DB alignment.
 */

/** Key Strategic Pillars (2025-2030) */
export const STRATEGIC_PILLARS_2025_2030 = [
  'Research, Innovation & Community Engagement',
  'Equity & Social Safeguards',
  'Human Capital & Sustainability',
  'Partnerships & Internationalisation',
] as const;

export type StrategicPillar = (typeof STRATEGIC_PILLARS_2025_2030)[number];

/** Core Objectives (2025-2030) */
export const CORE_OBJECTIVES_2025_2030 = [
  'Digital Advancement',
  'Academic Quality',
  'Infrastructure Investment',
  'Governance & Accountability',
] as const;

export type CoreObjective = (typeof CORE_OBJECTIVES_2025_2030)[number];

/** Optional: short labels for compact UI */
export const PILLAR_LABELS: Record<StrategicPillar, string> = {
  'Research, Innovation & Community Engagement': 'Research & Community',
  'Equity & Social Safeguards': 'Equity & Safeguards',
  'Human Capital & Sustainability': 'Human Capital',
  'Partnerships & Internationalisation': 'Partnerships & International',
};
