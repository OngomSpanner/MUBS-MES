import { query } from '@/lib/db';

export type DepartmentRow = {
  id: number;
  name: string;
  external_name?: string | null;
  unit_type?: string | null;
};

let cache: DepartmentRow[] | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** HR and M&E name variants for matching */
function deptAliases(hrDept: string): string[] {
  const base = norm(hrDept);
  const aliases = new Set<string>([base]);
  if (base.startsWith('department of ')) {
    aliases.add(base.slice('department of '.length).trim());
  }
  if (base.startsWith('dept of ')) {
    aliases.add(base.slice('dept of '.length).trim());
  }
  const noParen = base.replace(/\s*\(dept\)\s*$/i, '').trim();
  if (noParen) aliases.add(noParen);
  return [...aliases];
}

async function loadDepartments(): Promise<DepartmentRow[]> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;
  let rows: DepartmentRow[];
  try {
    rows = (await query({
      query: `SELECT id, name, external_name, unit_type
              FROM departments WHERE is_active = 1 OR is_active IS NULL`,
      values: [],
    })) as DepartmentRow[];
  } catch {
    rows = (await query({
      query: `SELECT id, name, external_name, unit_type FROM departments`,
      values: [],
    })) as DepartmentRow[];
  }
  cache = rows;
  cacheAt = now;
  return rows;
}

export function clearDepartmentCache(): void {
  cache = null;
  cacheAt = 0;
}

function unitTypeBonus(unitType: string | null | undefined): number {
  const t = (unitType || '').toLowerCase();
  if (t === 'department' || t === 'unit') return 15;
  if (t === 'office') return 0;
  return 5;
}

function scoreDepartment(d: DepartmentRow, aliases: string[]): number {
  const n = norm(d.name);
  const e = d.external_name ? norm(d.external_name) : '';
  let best = 0;

  for (const alias of aliases) {
    if (!alias) continue;
    if (n === alias || e === alias) {
      best = Math.max(best, 100);
    } else if (n.includes(alias) || alias.includes(n) || (e && (e.includes(alias) || alias.includes(e)))) {
      best = Math.max(best, 60);
    }
  }

  if (best === 0) return 0;
  return best + unitTypeBonus(d.unit_type);
}

/**
 * Match HR dept (department/unit) to M&E departments.id.
 * Prefers unit_type department/unit over office (e.g. E-LEARNING dept id 64, not office id 16).
 */
export async function resolveDepartmentId(hrDept: string | null | undefined): Promise<number | null> {
  if (!hrDept || hrDept === 'N/A') return null;
  const departments = await loadDepartments();
  const aliases = deptAliases(String(hrDept).trim());
  if (aliases.length === 0) return null;

  let bestId: number | null = null;
  let bestScore = 0;

  for (const d of departments) {
    const score = scoreDepartment(d, aliases);
    if (score > bestScore) {
      bestScore = score;
      bestId = d.id;
    }
  }

  return bestScore >= 60 ? bestId : null;
}
