import { query } from '@/lib/db';
import { OWNER_ABBREV_HINTS } from '@/lib/sds/codes';

type DeptRow = { id: number; name: string };

function normalizeName(s: string): string {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function loadDepartmentsForSdsMatching(): Promise<DeptRow[]> {
  const rows = (await query({
    query: `
      SELECT id, COALESCE(NULLIF(TRIM(external_name), ''), name) AS name
      FROM departments
      ORDER BY name
    `,
    values: [],
  })) as DeptRow[];
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name || '').trim() }));
}

/**
 * Best-effort match of SDS owner abbreviation / free-text owner label
 * to an existing departments row. Returns null if ambiguous/unmatched.
 * When multiple department rows share a name (duplicate campus copies), prefer lowest id.
 */
export function matchOwnerToDepartment(
  ownerAbbrev: string | null | undefined,
  ownerLabel: string | null | undefined,
  departments: DeptRow[],
): { department_id: number; department_name: string; confidence: 'exact' | 'hint' | 'label' | 'none' } {
  const pickPreferred = (hits: DeptRow[]) =>
    [...hits].sort((a, b) => a.id - b.id)[0];

  const labelNorm = normalizeName(ownerLabel || '');
  if (labelNorm) {
    const exactHits = departments.filter((d) => normalizeName(d.name) === labelNorm);
    if (exactHits.length) {
      const exact = pickPreferred(exactHits);
      return { department_id: exact.id, department_name: exact.name, confidence: 'exact' };
    }
    const containsHits = departments.filter((d) => {
      const n = normalizeName(d.name);
      return n.includes(labelNorm) || labelNorm.includes(n);
    });
    if (containsHits.length) {
      const contains = pickPreferred(containsHits);
      return { department_id: contains.id, department_name: contains.name, confidence: 'label' };
    }
  }

  const abbrev = String(ownerAbbrev || '').trim();
  const hints = OWNER_ABBREV_HINTS[abbrev] || (abbrev ? [abbrev] : []);
  for (const hint of hints) {
    const h = normalizeName(hint);
    if (!h) continue;
    const hits = departments.filter((d) => normalizeName(d.name).includes(h));
    if (hits.length >= 1) {
      // Prefer exact main office rows: exclude nested "(SOMETHING)" suffixes when a cleaner hit exists
      const main = hits.filter((d) => !/\(/.test(d.name)) ;
      const chosen = pickPreferred(main.length ? main : hits);
      return { department_id: chosen.id, department_name: chosen.name, confidence: 'hint' };
    }
  }

  return { department_id: 0, department_name: '', confidence: 'none' };
}
