import { NextResponse } from 'next/server';
import { requireAmbassador } from '@/lib/ambassador/context';
import { listFacultyStaff } from '@/lib/ambassador/faculty-staff';
import { getAmbassadorReportYearOptions } from '@/lib/ambassador/report-years';
import { BENEFIT_TYPES } from '@/lib/hrms/staff-benefits';
import { isSchoolRegistrarManagedUnit } from '@/lib/ambassador/school-registrar';

export async function GET() {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const staff = await listFacultyStaff(auth.managedUnitId, auth.managedUnitName);
  const canManageEnrollment = await isSchoolRegistrarManagedUnit(
    auth.managedUnitId,
    auth.managedUnitName
  );

  return NextResponse.json({
    managedUnitId: auth.managedUnitId,
    managedUnitName: auth.managedUnitName,
    canManageEnrollment,
    years: getAmbassadorReportYearOptions(),
    benefitTypes: BENEFIT_TYPES,
    staff,
  });
}
