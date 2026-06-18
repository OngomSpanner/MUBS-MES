import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';

export type AcademicStaffContext = {
  userId: number;
  departmentId: number;
  staffName: string;
  positionDesignation: string;
};

export function formatPositionDesignation(
  position: string | null | undefined,
  designationGrade: string | null | undefined
): string {
  const designation = (designationGrade || '').trim();
  const pos = (position || '').trim();
  if (designation && pos && designation.toLowerCase() !== pos.toLowerCase()) {
    return `${designation} — ${pos}`;
  }
  return designation || pos || '—';
}

export async function loadAcademicStaffProfile(userId: number): Promise<AcademicStaffContext | null> {
  const rows = (await query({
    query: `
      SELECT u.id, u.department_id,
             TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.surname, ''))) AS full_name,
             u.position, u.designation_grade, u.staff_category
      FROM users u
      WHERE u.id = ?
      LIMIT 1
    `,
    values: [userId],
  })) as {
    id: number;
    department_id: number | null;
    full_name: string | null;
    position: string | null;
    designation_grade: string | null;
    staff_category: string | null;
  }[];

  const row = rows[0];
  if (!row?.department_id) return null;
  if (String(row.staff_category || '').trim().toLowerCase() !== 'academic') return null;

  return {
    userId: row.id,
    departmentId: row.department_id,
    staffName: (row.full_name || '').trim() || `Staff #${row.id}`,
    positionDesignation: formatPositionDesignation(row.position, row.designation_grade),
  };
}

export async function requireAcademicStaffContext(): Promise<
  AcademicStaffContext | { error: NextResponse }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  const decoded = verifyToken(token) as { userId?: number } | null;
  if (!decoded?.userId) {
    return { error: NextResponse.json({ message: 'Invalid token' }, { status: 401 }) };
  }

  const profile = await loadAcademicStaffProfile(decoded.userId);
  if (!profile) {
    return {
      error: NextResponse.json(
        { message: 'Academic teaching data is only available for academic staff with a department.' },
        { status: 403 }
      ),
    };
  }

  return profile;
}

export async function isAcademicTeachingStaff(userId: number): Promise<boolean> {
  return (await loadAcademicStaffProfile(userId)) != null;
}
