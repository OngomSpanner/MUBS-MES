import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireSchoolRegistrarAmbassador } from '@/lib/ambassador/school-registrar';
import { parseEnrollmentCounts, type ProgrammeEnrollmentRecord } from '@/lib/ambassador/enrollment-records';

function mapRow(r: {
  id: number;
  programme_name: string;
  total_students: number;
  male_count: number;
  female_count: number;
  pwd_count: number;
  pwd_details: string | null;
  updated_at: string | null;
}): ProgrammeEnrollmentRecord {
  return {
    id: r.id,
    programmeName: (r.programme_name || '').trim(),
    totalStudents: Number(r.total_students ?? 0),
    maleCount: Number(r.male_count ?? 0),
    femaleCount: Number(r.female_count ?? 0),
    pwdCount: Number(r.pwd_count ?? 0),
    pwdDetails: r.pwd_details?.trim() || null,
    updatedAt: r.updated_at,
  };
}

export async function GET() {
  const auth = await requireSchoolRegistrarAmbassador();
  if ('error' in auth) return auth.error;

  try {
    const rows = (await query({
      query: `
        SELECT id, programme_name, total_students, male_count, female_count, pwd_count, pwd_details, updated_at
        FROM staff_programme_enrollment
        ORDER BY programme_name ASC
      `,
      values: [],
    })) as Parameters<typeof mapRow>[0][];

    return NextResponse.json({ records: rows.map(mapRow) });
  } catch {
    return NextResponse.json({ records: [] });
  }
}

export async function POST(request: Request) {
  const auth = await requireSchoolRegistrarAmbassador();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const programmeName = String(body.programmeName || '').trim();
  if (!programmeName) {
    return NextResponse.json({ message: 'Programme name is required' }, { status: 400 });
  }

  const counts = parseEnrollmentCounts(body);
  if ('error' in counts) {
    return NextResponse.json({ message: counts.error }, { status: 400 });
  }

  const pwdDetails = body.pwdDetails != null ? String(body.pwdDetails).trim() || null : null;

  try {
    const result = (await query({
      query: `
        INSERT INTO staff_programme_enrollment
          (programme_name, total_students, male_count, female_count, pwd_count, pwd_details)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      values: [
        programmeName,
        counts.totalStudents,
        counts.maleCount,
        counts.femaleCount,
        counts.pwdCount,
        pwdDetails,
      ],
    })) as { insertId: number };

    return NextResponse.json({ message: 'Programme enrollment saved', id: result.insertId }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Duplicate') || msg.includes('uq_programme_enrollment')) {
      return NextResponse.json({ message: 'This programme already exists' }, { status: 409 });
    }
    throw e;
  }
}
