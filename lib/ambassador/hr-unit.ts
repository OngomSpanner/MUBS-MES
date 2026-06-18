import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador, type AmbassadorContext } from '@/lib/ambassador/context';

/** Department/unit or parent office name for HR staff profile access. */
export function isHrUnitName(unitName: string): boolean {
  const normalized = unitName
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "'");
  return (
    normalized.includes('human resource') ||
    normalized === 'hr' ||
    normalized.startsWith('hr ') ||
    normalized.includes(' hr ')
  );
}

export async function isHrManagedUnit(
  managedUnitId: number,
  managedUnitName: string
): Promise<boolean> {
  if (isHrUnitName(managedUnitName)) return true;

  const rows = (await query({
    query: `
      SELECT COALESCE(p.name, '') AS parent_name
      FROM departments d
      LEFT JOIN departments p ON p.id = d.parent_id
      WHERE d.id = ?
    `,
    values: [managedUnitId],
  })) as { parent_name: string }[];

  return rows.length > 0 && isHrUnitName(rows[0].parent_name);
}

export async function requireHrAmbassador(): Promise<
  AmbassadorContext | { error: NextResponse }
> {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth;

  const allowed = await isHrManagedUnit(auth.managedUnitId, auth.managedUnitName);
  if (!allowed) {
    return {
      error: NextResponse.json(
        {
          message:
            'HR workforce data is only available to the Strategic Plan Ambassador assigned to the Human Resources directorate.',
        },
        { status: 403 }
      ),
    };
  }

  return auth;
}
