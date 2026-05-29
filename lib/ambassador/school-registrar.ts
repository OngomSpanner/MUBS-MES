import { NextResponse } from 'next/server';
import { requireAmbassador, type AmbassadorContext } from '@/lib/ambassador/context';

/** Faculty/office name for the Strategic Plan Ambassador who manages enrolment M&E data. */
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

export async function requireSchoolRegistrarAmbassador(): Promise<
  AmbassadorContext | { error: NextResponse }
> {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth;

  if (!isSchoolRegistrarUnitName(auth.managedUnitName)) {
    return {
      error: NextResponse.json(
        {
          message:
            'Programme and course unit enrollment data may only be entered by the Strategic Plan Ambassador assigned to the School Registrar\'s Office.',
        },
        { status: 403 }
      ),
    };
  }

  return auth;
}
