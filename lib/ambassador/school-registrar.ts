import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAmbassador, type AmbassadorContext } from '@/lib/ambassador/context';

/** Department/unit or parent office name for School Registrar enrolment M&E. */
export function isSchoolRegistrarUnitName(unitName: string): boolean {
  const normalized = unitName
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "'");
  return (
    normalized === "school registrar's office" ||
    normalized.includes('school registrar')
  );
}

export async function isSchoolRegistrarManagedUnit(
  managedUnitId: number,
  managedUnitName: string
): Promise<boolean> {
  if (isSchoolRegistrarUnitName(managedUnitName)) return true;

  const rows = (await query({
    query: `
      SELECT COALESCE(p.name, '') AS parent_name
      FROM departments d
      LEFT JOIN departments p ON p.id = d.parent_id
      WHERE d.id = ?
    `,
    values: [managedUnitId],
  })) as { parent_name: string }[];

  return rows.length > 0 && isSchoolRegistrarUnitName(rows[0].parent_name);
}

export async function requireSchoolRegistrarAmbassador(): Promise<
  AmbassadorContext | { error: NextResponse }
> {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth;

  const allowed = await isSchoolRegistrarManagedUnit(auth.managedUnitId, auth.managedUnitName);
  if (!allowed) {
    return {
      error: NextResponse.json(
        {
          message:
            'Programme and course unit enrollment data may only be entered by the Strategic Plan Ambassador assigned to the School Registrar\'s Office (or its department/unit).',
        },
        { status: 403 }
      ),
    };
  }

  return auth;
}
