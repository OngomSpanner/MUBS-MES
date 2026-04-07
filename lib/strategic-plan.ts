/**
 * Strategic Plan 2025-2030 – pillars and core objectives.
 * Use these constants across the app for dropdowns, filters, and DB alignment.
 */

/** Key Strategic Pillars (2025-2030) */
export const STRATEGIC_PILLARS_2025_2030 = [
  'Teaching, Learning and Student Success',
  'Infrastructure Development and Digital Transformation',
  'Research, Innovation, Employability and Community Engagement',
  'Equity, Inclusivity and Social Safeguards',
  'Human Capital, Governance, and Institutional Sustainability',
  'Partnerships, Collaborations and Internationalisation'
] as const;

export type StrategicPillar = (typeof STRATEGIC_PILLARS_2025_2030)[number];

/** Core Objectives (2025-2030) */
export const CORE_OBJECTIVES_2025_2030 = [
  'To equip learners with essential skills, comprehensive knowledge and a strong ethical foundation through engaging and contextualised learning experiences.',
  'To enhance student and staff well-being and holistic development through promotion of sports, recreation, and physical wellness.',
  'To empower students, staff, and surrounding communities to actively participate in national development through MUBS programmes.',
  'To strengthen governance, policy frameworks, and coordination mechanisms to enhance efficiency, accountability, and effective delivery of the MUBS mandate.',
] as const;

export type CoreObjective = (typeof CORE_OBJECTIVES_2025_2030)[number];

/** Optional: short labels for compact UI */
export const PILLAR_LABELS: Record<StrategicPillar, string> = {
  'Teaching, Learning and Student Success': 'Teaching & Learning',
  'Infrastructure Development and Digital Transformation': 'Infrastructure & Digital',
  'Research, Innovation, Employability and Community Engagement': 'Research & Community',
  'Equity, Inclusivity and Social Safeguards': 'Equity & Safeguards',
  'Human Capital, Governance, and Institutional Sustainability': 'Human Capital',
  'Partnerships, Collaborations and Internationalisation': 'Partnerships & International',
};
