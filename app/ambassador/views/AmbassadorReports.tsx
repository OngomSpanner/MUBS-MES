'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import StaffRecruitmentPanel from '@/components/Reports/StaffRecruitmentPanel';
import AmbassadorBenefitsDataPanel from '@/components/Ambassador/reports/AmbassadorBenefitsDataPanel';
import AmbassadorWorkforceDataPanel from '@/components/Ambassador/reports/AmbassadorWorkforceDataPanel';
import AmbassadorSkillsDataPanel from '@/components/Ambassador/reports/AmbassadorSkillsDataPanel';
import AmbassadorStaffProfilePanel from '@/components/Ambassador/reports/AmbassadorStaffProfilePanel';
import AmbassadorCompliancePanel from '@/components/Ambassador/reports/AmbassadorCompliancePanel';
import AmbassadorProgrammeEnrollmentPanel from '@/components/Ambassador/reports/AmbassadorProgrammeEnrollmentPanel';
import AmbassadorCourseUnitEnrollmentPanel from '@/components/Ambassador/reports/AmbassadorCourseUnitEnrollmentPanel';

export type AmbassadorReportsTab =
    | 'compliance'
    | 'staff-profiles'
    | 'recruitment'
    | 'benefits'
    | 'workforce-assessments'
    | 'employment-skill-status'
    | 'programme-enrollment'
    | 'course-unit-enrollment';

const VALID_TABS = new Set<string>([
    'compliance',
    'staff-profiles',
    'recruitment',
    'benefits',
    'workforce-assessments',
    'employment-skill-status',
    'programme-enrollment',
    'course-unit-enrollment',
]);

const REGISTRAR_ONLY_TABS = new Set<string>(['programme-enrollment', 'course-unit-enrollment']);

function parseTab(value: string | null): AmbassadorReportsTab {
    if (value && VALID_TABS.has(value)) {
        return value as AmbassadorReportsTab;
    }
    return 'compliance';
}

export default function AmbassadorReports() {
    const searchParams = useSearchParams();
    const activeTab = parseTab(searchParams.get('tab'));

    const [managedUnitName, setManagedUnitName] = useState<string | null>(null);
    const [managedUnitId, setManagedUnitId] = useState<number | null>(null);
    const [canManageEnrollment, setCanManageEnrollment] = useState(false);

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
            } catch (err: unknown) {
                console.error('Ambassador reports meta error:', err);
            }
        };
        loadMeta();
    }, []);

    const enrollmentTabDenied =
        REGISTRAR_ONLY_TABS.has(activeTab) && !canManageEnrollment;

    return (
        <div className="page-section active-page">
            {enrollmentTabDenied && (
                <div className="alert alert-warning">
                    Programme and course unit enrollment data may only be entered by the Strategic Plan Ambassador
                    assigned to the <strong>School Registrar&apos;s Office</strong>.
                </div>
            )}

            {activeTab === 'compliance' && <AmbassadorCompliancePanel />}

            {activeTab === 'staff-profiles' && <AmbassadorStaffProfilePanel />}

            {activeTab === 'recruitment' && (
                <StaffRecruitmentPanel {...scopeProps} />
            )}

            {activeTab === 'benefits' && (
                <AmbassadorBenefitsDataPanel {...scopeProps} />
            )}

            {activeTab === 'workforce-assessments' && (
                <AmbassadorWorkforceDataPanel managedUnitId={managedUnitId ?? undefined} />
            )}

            {activeTab === 'employment-skill-status' && (
                <AmbassadorSkillsDataPanel managedUnitId={managedUnitId ?? undefined} />
            )}

            {activeTab === 'programme-enrollment' && canManageEnrollment && (
                <AmbassadorProgrammeEnrollmentPanel />
            )}

            {activeTab === 'course-unit-enrollment' && canManageEnrollment && (
                <AmbassadorCourseUnitEnrollmentPanel />
            )}
        </div>
    );
}
