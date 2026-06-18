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
  | 'data-collection'
  | 'staff-profiles'
  | 'recruitment'
  | 'benefits'
  | 'workforce-assessments'
  | 'employment-skill-status'
  | 'programme-enrollment'
  | 'course-unit-enrollment';

const VALID_TABS = new Set<string>([
  'data-collection',
  'staff-profiles',
  'recruitment',
  'benefits',
  'workforce-assessments',
  'employment-skill-status',
  'programme-enrollment',
  'course-unit-enrollment',
]);

const HR_ONLY_TABS = new Set<string>([
  'staff-profiles',
  'recruitment',
  'benefits',
  'workforce-assessments',
  'employment-skill-status',
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
  const [canManageHrWorkforce, setCanManageHrWorkforce] = useState(false);

  const scopeProps = useMemo(
    () => ({
      scopeFaculty: canManageHrWorkforce ? undefined : managedUnitName,
      lockFaculty: false,
      managedUnitId: canManageHrWorkforce ? undefined : managedUnitId ?? undefined,
    }),
    [managedUnitName, managedUnitId, canManageHrWorkforce]
  );

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const metaRes = await axios.get('/api/ambassador/reports/staff-options');
        setManagedUnitName(metaRes.data.managedUnitName ?? null);
        setManagedUnitId(metaRes.data.managedUnitId ?? null);
        setCanManageEnrollment(Boolean(metaRes.data.canManageEnrollment));
        setCanManageHrWorkforce(Boolean(metaRes.data.canManageHrWorkforce));
      } catch (err: unknown) {
        console.error('Ambassador reporting meta error:', err);
      }
    };
    loadMeta();
  }, []);

  const visibleTabs = useMemo(() => {
    const tabs: AmbassadorReportingTab[] = ['data-collection'];
    if (canManageHrWorkforce) {
      tabs.push(
        'recruitment',
        'benefits',
        'workforce-assessments',
        'employment-skill-status',
        'staff-profiles'
      );
    }
    if (canManageEnrollment) {
      tabs.push('programme-enrollment', 'course-unit-enrollment');
    }
    return tabs;
  }, [canManageEnrollment, canManageHrWorkforce]);

  const hrTabDenied = HR_ONLY_TABS.has(activeTab) && !canManageHrWorkforce;
  const enrollmentTabDenied = REGISTRAR_ONLY_TABS.has(activeTab) && !canManageEnrollment;

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

      {hrTabDenied && (
        <div className="alert alert-warning">
          HR workforce data may only be viewed and entered by the Strategic Plan Ambassador assigned to the{' '}
          <strong>Human Resources directorate</strong>.
        </div>
      )}

      {enrollmentTabDenied && (
        <div className="alert alert-warning">
          Programme and course unit enrollment data may only be entered by the Strategic Plan Ambassador
          assigned to the <strong>School Registrar&apos;s Office</strong>.
        </div>
      )}

      {activeTab === 'data-collection' && <AmbassadorDataCollection />}

      {activeTab === 'staff-profiles' && canManageHrWorkforce && <AmbassadorStaffProfilePanel />}

      {activeTab === 'recruitment' && canManageHrWorkforce && <StaffRecruitmentPanel {...scopeProps} />}

      {activeTab === 'benefits' && canManageHrWorkforce && <AmbassadorBenefitsDataPanel {...scopeProps} />}

      {activeTab === 'workforce-assessments' && canManageHrWorkforce && (
        <AmbassadorWorkforceDataPanel
          managedUnitId={canManageHrWorkforce ? undefined : managedUnitId ?? undefined}
        />
      )}

      {activeTab === 'employment-skill-status' && canManageHrWorkforce && (
        <AmbassadorSkillsDataPanel
          managedUnitId={canManageHrWorkforce ? undefined : managedUnitId ?? undefined}
        />
      )}

      {activeTab === 'programme-enrollment' && canManageEnrollment && <AmbassadorProgrammeEnrollmentPanel />}

      {activeTab === 'course-unit-enrollment' && canManageEnrollment && (
        <AmbassadorCourseUnitEnrollmentPanel />
      )}
    </div>
  );
}
