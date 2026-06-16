'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import StaffRecruitmentPanel from '@/components/Reports/StaffRecruitmentPanel';
import AmbassadorBenefitsDataPanel from '@/components/Ambassador/reports/AmbassadorBenefitsDataPanel';
import AmbassadorWorkforceDataPanel from '@/components/Ambassador/reports/AmbassadorWorkforceDataPanel';
import AmbassadorSkillsDataPanel from '@/components/Ambassador/reports/AmbassadorSkillsDataPanel';
import AmbassadorStaffProfilePanel from '@/components/Ambassador/reports/AmbassadorStaffProfilePanel';
import AmbassadorProgrammeEnrollmentPanel from '@/components/Ambassador/reports/AmbassadorProgrammeEnrollmentPanel';
import AmbassadorCourseUnitEnrollmentPanel from '@/components/Ambassador/reports/AmbassadorCourseUnitEnrollmentPanel';
import AmbassadorDataCollection from './AmbassadorDataCollection';

export type AmbassadorReportingTab =
  | 'staff-profiles'
  | 'recruitment'
  | 'benefits'
  | 'workforce-assessments'
  | 'employment-skill-status'
  | 'programme-enrollment'
  | 'course-unit-enrollment'
  | 'data-collection';

const VALID_TABS = new Set<string>([
  'staff-profiles',
  'recruitment',
  'benefits',
  'workforce-assessments',
  'employment-skill-status',
  'programme-enrollment',
  'course-unit-enrollment',
  'data-collection',
]);

const REGISTRAR_ONLY_TABS = new Set<string>(['programme-enrollment', 'course-unit-enrollment']);

const TAB_LABELS: Record<AmbassadorReportingTab, string> = {
  'data-collection': 'Performance Indicators',
  recruitment: 'Recruitment',
  benefits: 'Benefits',
  'workforce-assessments': 'Workforce',
  'employment-skill-status': 'Skills',
  'staff-profiles': 'Staff profiles',
  'programme-enrollment': 'Programmes',
  'course-unit-enrollment': 'Course units',
};

function parseTab(value: string | null): AmbassadorReportingTab {
  if (value && VALID_TABS.has(value)) {
    return value as AmbassadorReportingTab;
  }
  return 'data-collection';
}

export default function AmbassadorReporting() {
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));

  const [managedUnitName, setManagedUnitName] = useState<string | null>(null);
  const [managedUnitId, setManagedUnitId] = useState<number | null>(null);
  const [canManageEnrollment, setCanManageEnrollment] = useState(false);
  const [canViewStaffProfiles, setCanViewStaffProfiles] = useState(false);

  const scopeProps = useMemo(
    () => ({
      scopeFaculty: managedUnitName,
      lockFaculty: Boolean(managedUnitName),
      managedUnitId: managedUnitId ?? undefined,
    }),
    [managedUnitName, managedUnitId]
  );

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const metaRes = await axios.get('/api/ambassador/reports/staff-options');
        setManagedUnitName(metaRes.data.managedUnitName ?? null);
        setManagedUnitId(metaRes.data.managedUnitId ?? null);
        setCanManageEnrollment(Boolean(metaRes.data.canManageEnrollment));
        setCanViewStaffProfiles(Boolean(metaRes.data.canViewStaffProfiles));
      } catch (err: unknown) {
        console.error('Ambassador reporting meta error:', err);
      }
    };
    loadMeta();
  }, []);

  const visibleTabs = useMemo(() => {
    const tabs: AmbassadorReportingTab[] = [
      'data-collection',
      'recruitment',
      'benefits',
      'workforce-assessments',
      'employment-skill-status',
    ];
    if (canViewStaffProfiles) tabs.push('staff-profiles');
    if (canManageEnrollment) {
      tabs.push('programme-enrollment', 'course-unit-enrollment');
    }
    return tabs;
  }, [canManageEnrollment, canViewStaffProfiles]);

  const enrollmentTabDenied = REGISTRAR_ONLY_TABS.has(activeTab) && !canManageEnrollment;
  const staffProfilesTabDenied = activeTab === 'staff-profiles' && !canViewStaffProfiles;

  return (
    <div className="page-section active-page">
      <div className="d-flex flex-wrap gap-2 mb-4">
        {visibleTabs.map((tab) => (
          <Link
            key={tab}
            href={`/ambassador?pg=reporting&tab=${tab}`}
            className={`btn btn-sm fw-bold ${activeTab === tab ? 'btn-primary' : 'btn-outline-secondary'}`}
            style={activeTab === tab ? { background: 'var(--mubs-blue)', borderColor: 'var(--mubs-blue)' } : undefined}
          >
            {TAB_LABELS[tab]}
          </Link>
        ))}
      </div>

      {enrollmentTabDenied && (
        <div className="alert alert-warning">
          Programme and course unit enrollment data may only be entered by the Strategic Plan Ambassador
          assigned to the <strong>School Registrar&apos;s Office</strong>.
        </div>
      )}

      {staffProfilesTabDenied && (
        <div className="alert alert-warning">
          Full staff profiles are only available to the Strategic Plan Ambassador assigned to the{' '}
          <strong>Human Resources</strong> unit.
        </div>
      )}

      {activeTab === 'data-collection' && <AmbassadorDataCollection />}

      {activeTab === 'staff-profiles' && canViewStaffProfiles && <AmbassadorStaffProfilePanel />}

      {activeTab === 'recruitment' && <StaffRecruitmentPanel {...scopeProps} />}

      {activeTab === 'benefits' && <AmbassadorBenefitsDataPanel {...scopeProps} />}

      {activeTab === 'workforce-assessments' && (
        <AmbassadorWorkforceDataPanel managedUnitId={managedUnitId ?? undefined} />
      )}

      {activeTab === 'employment-skill-status' && (
        <AmbassadorSkillsDataPanel managedUnitId={managedUnitId ?? undefined} />
      )}

      {activeTab === 'programme-enrollment' && canManageEnrollment && <AmbassadorProgrammeEnrollmentPanel />}

      {activeTab === 'course-unit-enrollment' && canManageEnrollment && (
        <AmbassadorCourseUnitEnrollmentPanel />
      )}
    </div>
  );
}
