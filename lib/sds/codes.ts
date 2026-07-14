import { STRATEGIC_PILLARS_2025_2030 } from '@/lib/strategic-plan';

/** Code pattern: MUBS/P1/OBJ1/TLSS/SR/S001 (some rows have spaces around slashes). */
export type ParsedSdsCode = {
  raw: string;
  normalized: string;
  pillarNum: number | null;
  objectiveNum: number | null;
  pillarAbbrev: string | null;
  ownerAbbrev: string | null;
  standardNo: string | null;
  pillar: string | null;
};

const PILLAR_BY_ABBREV: Record<string, string> = {
  TLSS: STRATEGIC_PILLARS_2025_2030[0],
  IDDT: STRATEGIC_PILLARS_2025_2030[1],
  'R&I': STRATEGIC_PILLARS_2025_2030[2],
  RI: STRATEGIC_PILLARS_2025_2030[2],
  EISG: STRATEGIC_PILLARS_2025_2030[3],
  HCG: STRATEGIC_PILLARS_2025_2030[4],
  PCI: STRATEGIC_PILLARS_2025_2030[5],
};

/** Owner abbreviations commonly used in SDS codes → search hints for departments.name */
export const OWNER_ABBREV_HINTS: Record<string, string[]> = {
  SR: ['SCHOOL REGISTRAR'],
  'F&Ds': [], // multi-owner (faculty deans) — leave for admin assignment
  FGSR: ['FACULTY OF GRADUATE STUDIES'],
  MIS: ['MANAGEMENT OF INFORMATION SYSTEM'],
  'S&P': ['STRATEGY & PROJECTS', 'STRATEGY AND PROJECTS'],
  'E&W': ['ESTATES AND WORKS', 'ESTATES & WORKS'],
  HS: ['HEALTH SERVICES'],
  DOS: ['DEAN OF STUDENTS'],
  DoS: ['DEAN OF STUDENTS'],
  DRLC: ['DISABILITY'],
  SO: ['SECURITY SECTION'],
  DLA: ['LEGAL AFFAIRS'],
  HRD: ['HUMAN RESOURCE'],
  IA: ['INTERNAL AUDIT'],
  PDU: ['PROCUREMENT AND DISPOSAL'],
  SB: ['SCHOOL BURSAR'],
  SS: ['SCHOOL SECRETARY'],
  OCs: ['OUTREACH', 'COMMUNITY'],
  PRO: ['PUBLIC RELATIONS'],
  SL: ['SCHOOL LIBRARIAN'],
  QAD: ['QUALITY ASSURANCE'],
};

export function normalizeSdsCode(raw: string): string {
  return String(raw || '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSdsStandardCode(raw: string): ParsedSdsCode {
  const normalized = normalizeSdsCode(raw);
  const parts = normalized.split('/').map((p) => p.trim()).filter(Boolean);
  // Expected: MUBS, Pn, OBJn, ABBREV, OWNER, Snnn
  const pillarPart = parts.find((p) => /^P\d+$/i.test(p));
  const objPart = parts.find((p) => /^OBJ\d+$/i.test(p));
  const standardPart = parts.find((p) => /^S\d+/i.test(p)) || parts[parts.length - 1] || null;
  const pillarNum = pillarPart ? Number(pillarPart.replace(/\D/g, '')) : null;
  const objectiveNum = objPart ? Number(objPart.replace(/\D/g, '')) : null;

  let pillarAbbrev: string | null = null;
  let ownerAbbrev: string | null = null;
  if (parts.length >= 6) {
    pillarAbbrev = parts[3] || null;
    ownerAbbrev = parts[4] || null;
  } else if (parts.length >= 5) {
    pillarAbbrev = parts[3] || null;
    ownerAbbrev = parts[3] || null;
  }

  const pillar =
    (pillarAbbrev && PILLAR_BY_ABBREV[pillarAbbrev]) ||
    (pillarNum && pillarNum >= 1 && pillarNum <= STRATEGIC_PILLARS_2025_2030.length
      ? STRATEGIC_PILLARS_2025_2030[pillarNum - 1]
      : null);

  return {
    raw,
    normalized,
    pillarNum: Number.isFinite(pillarNum as number) ? pillarNum : null,
    objectiveNum: Number.isFinite(objectiveNum as number) ? objectiveNum : null,
    pillarAbbrev,
    ownerAbbrev,
    standardNo: standardPart,
    pillar,
  };
}

/** Parse duration like "2 weeks", "1 month", "Immediate" to approximate days (informational). */
export function durationTextToDays(raw: string | null | undefined): number | null {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'immediate' || s === 'instant') return 0;

  const dayMatch = s.match(/(\d+)\s*day/);
  if (dayMatch) return Number(dayMatch[1]);

  const weekMatch = s.match(/(\d+)\s*week/);
  if (weekMatch) return Number(weekMatch[1]) * 7;

  const monthMatch = s.match(/(\d+)\s*month/);
  if (monthMatch) return Number(monthMatch[1]) * 30;

  // "Day 1", "Day 0"
  const dayN = s.match(/^day\s*(\d+)$/);
  if (dayN) return Number(dayN[1]);

  return null;
}

export function addDaysIso(from: Date, days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  const d = new Date(from);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}
