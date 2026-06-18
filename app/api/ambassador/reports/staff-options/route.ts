import { NextResponse } from 'next/server';
import { requireAmbassador } from '@/lib/ambassador/context';
import { listFacultyStaff, listInstitutionSyncedStaff } from '@/lib/ambassador/faculty-staff';
import { getAmbassadorReportYearOptions } from '@/lib/ambassador/report-years';
import { BENEFIT_TYPES } from '@/lib/hrms/staff-benefits';
import { isSchoolRegistrarManagedUnit } from '@/lib/ambassador/school-registrar';
import { isHrManagedUnit } from '@/lib/ambassador/hr-unit';

export async function GET() {
  const auth = await requireAmbassador();
  if ('error' in auth) return auth.error;

  const [canManageEnrollment, canManageHrWorkforce] = await Promise.all([
    isSchoolRegistrarManagedUnit(auth.managedUnitId, auth.managedUnitName),
    isHrManagedUnit(auth.managedUnitId, auth.managedUnitName),
  ]);

  const staff = canManageHrWorkforce
    ? await listInstitutionSyncedStaff()
    : await listFacultyStaff(auth.managedUnitId, auth.managedUnitName);

  return NextResponse.json({
    managedUnitId: auth.managedUnitId,
    managedUnitName: auth.managedUnitName,
    canManageEnrollment,
    canManageHrWorkforce,
    /** @deprecated use canManageHrWorkforce */
    canViewStaffProfiles: canManageHrWorkforce,
    years: getAmbassadorReportYearOptions(),
    benefitTypes: BENEFIT_TYPES,
    staff,
  });
}
