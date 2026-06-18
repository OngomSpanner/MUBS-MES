import { query } from '@/lib/db';

export type MubsProgrammeLevel =
  | 'Certificate'
  | 'National Certificate'
  | 'Higher Education Certificate'
  | 'Diploma'
  | 'Bachelor'
  | 'Postgraduate Diploma'
  | 'Doctorate';

export type MubsProgramme = {
  id: number;
  name: string;
  level: MubsProgrammeLevel;
  sortOrder: number;
};

/** Official MUBS programme catalogue (source of truth for seeding). */
export const MUBS_PROGRAMME_CATALOG: { name: string; level: MubsProgrammeLevel }[] = [
  { name: 'CERTIFICATE IN ENTREPRENEURSHIP & SMALL BUSINESS', level: 'Certificate' },
  { name: 'NATIONAL CERTIFICATE IN BUSINESS ADMINISTRATION', level: 'National Certificate' },
  { name: 'HIGHER EDUCATION CERTIFICATE IN BUSINESS STUDIES', level: 'Higher Education Certificate' },
  { name: 'DIPLOMA IN PROCUREMENT AND LOGISTICS MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN HUMAN RESOURCE MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN HOTEL AND RESTAURANT BUSINESS MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN ENTREPRENEURSHIP & SMALL BUSINESS MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN COMPUTER SCIENCE', level: 'Diploma' },
  { name: 'DIPLOMA IN BUSINESS COMPUTING', level: 'Diploma' },
  { name: 'DIPLOMA IN BUSINESS ADMINISTRATION', level: 'Diploma' },
  { name: 'DIPLOMA IN ACCOUNTING & FINANCE', level: 'Diploma' },
  { name: 'DIPLOMA IN CATERING AND HOTEL OPERATIONS', level: 'Diploma' },
  { name: 'DIPLOMA IN PROCUREMENT AND SUPPLY CHAIN MANAGEMENT', level: 'Diploma' },
  { name: 'DIPLOMA IN BUSINESS INTELLIGENCE AND DATA ANALYTICS', level: 'Diploma' },
  { name: 'BACHELOR OF TRAVEL AND TOURISM MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF INTERNATIONAL BUSINESS', level: 'Bachelor' },
  { name: 'BACHELOR OF BUSINESS COMPUTING', level: 'Bachelor' },
  { name: 'BACHELOR OF BUSINESS STATISTICS', level: 'Bachelor' },
  { name: 'BACHELOR OF CATERING AND HOTEL MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF COMMERCE', level: 'Bachelor' },
  { name: 'BACHELOR OF ENTREPRENEURSHIP', level: 'Bachelor' },
  { name: 'BACHELOR OF HUMAN RESOURCE MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF LEADERSHIP AND GOVERNANCE', level: 'Bachelor' },
  { name: 'BACHELOR OF TRANSPORT AND LOGISTICS MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF LEISURE AND HOSPITALITY MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF OFFICE AND INFORMATION MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF PROCUREMENT AND SUPPLY CHAIN MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF REAL ESTATE MANAGEMENT', level: 'Bachelor' },
  { name: 'BACHELOR OF SCIENCE IN ACCOUNTING', level: 'Bachelor' },
  { name: 'BACHELOR OF SCIENCE IN FINANCE', level: 'Bachelor' },
  { name: 'BACHELOR OF SCIENCE IN MARKETING', level: 'Bachelor' },
  { name: 'BACHELOR OF ARTS IN ECONOMICS', level: 'Bachelor' },
  { name: 'BACHELOR OF BUSINESS ADMINISTRATION', level: 'Bachelor' },
  { name: 'BACHELOR OF LEISURE EVENTS & HOTEL MANAGEMENT', level: 'Bachelor' },
  { name: 'POSTGRADUATE DIPLOMA OF BUSINESS ADMINISTRATION', level: 'Postgraduate Diploma' },
  { name: 'POST GRADUATE DIPLOMA IN BUSINESS EDUCATION', level: 'Postgraduate Diploma' },
  {
    name: 'POSTGRADUATE DIPLOMA IN BUSINESS INTELLIGENCE AND DATA ANALYTICS (PBDA)',
    level: 'Postgraduate Diploma',
  },
  { name: 'POST GRADUATE DIPLOMA IN PUBLIC ADMINISTRATION', level: 'Postgraduate Diploma' },
  { name: 'DOCTOR OF ENERGY ECONOMICS AND GOVERNANCE', level: 'Doctorate' },
  { name: 'DOCTOR OF BUSINESS ADMINISTRATION', level: 'Doctorate' },
  { name: 'DOCTOR OF PHILOSOPHY', level: 'Doctorate' },
];

const LEVEL_SORT: Record<MubsProgrammeLevel, number> = {
  Certificate: 1,
  'National Certificate': 2,
  'Higher Education Certificate': 3,
  Diploma: 4,
  Bachelor: 5,
  'Postgraduate Diploma': 6,
  Doctorate: 7,
};

export async function listMubsProgrammes(): Promise<MubsProgramme[]> {
  try {
    const rows = (await query({
      query: `
        SELECT id, name, level, sort_order
        FROM mubs_programmes
        WHERE is_active = 1
        ORDER BY sort_order ASC, name ASC
      `,
      values: [],
    })) as { id: number; name: string; level: string; sort_order: number }[];

    return rows.map((r) => ({
      id: r.id,
      name: (r.name || '').trim(),
      level: r.level as MubsProgrammeLevel,
      sortOrder: Number(r.sort_order ?? 0),
    }));
  } catch {
    return MUBS_PROGRAMME_CATALOG.map((p, index) => ({
      id: index + 1,
      name: p.name,
      level: p.level,
      sortOrder: index + 1,
    }));
  }
}

export function catalogueSortOrder(level: MubsProgrammeLevel, index: number): number {
  return (LEVEL_SORT[level] ?? 99) * 1000 + index;
}
