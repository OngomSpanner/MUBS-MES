import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { STRATEGIC_PILLARS_2025_2030, PILLAR_LABELS } from '@/lib/strategic-plan';
import { generateStaffEstablishmentReport } from '@/lib/hrms/staff-establishment';
import { generateStaffPromotionReport } from '@/lib/hrms/staff-promotion';
import { generateStaffRetentionReport } from '@/lib/hrms/staff-retention';
import { generateStaffRecruitmentReport } from '@/lib/hrms/staff-recruitment';
import { generateStaffTurnoverReport } from '@/lib/hrms/staff-turnover';
import { generateStaffDevelopmentReport } from '@/lib/hrms/staff-development';
import { generateStaffPaymentsReport } from '@/lib/hrms/staff-payments';
import { generateStaffBenefitsReport } from '@/lib/hrms/staff-benefits';
import { generateStaffMiscellaneousReport } from '@/lib/hrms/staff-miscellaneous';
import { generateStaffWorkforceAssessmentsReport } from '@/lib/hrms/staff-workforce-assessments';
import { generateStaffEmploymentSkillStatusReport } from '@/lib/hrms/staff-employment-skill-status';
import { generateStaffStrategicPriorityReport } from '@/lib/hrms/staff-strategic-priority';
import { generateStaffJobDescriptionWorkplansReport } from '@/lib/hrms/staff-job-description-workplans';
import { generateStaffStudentRatioReport } from '@/lib/hrms/staff-student-ratio';
import { generateStaffProgrammeEnrollmentReport } from '@/lib/hrms/staff-programme-enrollment';
import { generateStaffCourseUnitEnrollmentReport } from '@/lib/hrms/staff-course-unit-enrollment';
import { resolveAmbassadorReportScope } from '@/lib/ambassador/reports-scope';
import { getManagedUnitDepartmentIds } from '@/lib/ambassador/managed-unit-departments';

const AMBASSADOR_ALLOWED_REPORT_TYPES = new Set([
  'staff-recruitment',
  'staff-benefits',
  'staff-workforce-assessments',
  'staff-employment-skill-status',
]);

function parseManagedUnitParam(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token) as { userId?: number } | null;
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId;
    if (!userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type) {
      const ambassadorScope = await resolveAmbassadorReportScope(userId, null);
      if (ambassadorScope.restricted && ambassadorScope.managedUnitId && !AMBASSADOR_ALLOWED_REPORT_TYPES.has(type)) {
        return NextResponse.json(
          { message: 'This report is not available for your ambassador unit scope' },
          { status: 403 }
        );
      }
    }
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const department = searchParams.get('department');
    const pwdFilter = searchParams.get('pwd');
    const genderFilter = searchParams.get('gender');
    const categoryFilter = searchParams.get('staff_category');

    let data: any;

    switch (type) {
      case 'activity-summary': {
        const vals: any[] = [];
        let whereClause = 'WHERE d.is_active = 1';
        if (from) {
          whereClause += ' AND sa.created_at >= ?';
          vals.push(from);
        }
        if (to) {
          whereClause += ' AND sa.created_at <= ?';
          vals.push(to + ' 23:59:59');
        }
        if (department && department !== 'All Departments') {
          whereClause += ' AND d.name = ?';
          vals.push(department);
        }

        const showAllDepts = !department || department === 'All Departments' ? 1 : 0;
        data = await query({
          query: `
            SELECT
              d.name AS department,
              COUNT(sa.id) AS total_activities,
              SUM(CASE WHEN sa.status = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN sa.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
              SUM(CASE
                WHEN sa.status = 'overdue' THEN 1
                WHEN sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status != 'completed' THEN 1
                ELSE 0
              END) AS delayed_cnt,
              ROUND(IFNULL(AVG(sa.progress), 0)) AS avg_progress
            FROM departments d
            LEFT JOIN strategic_activities sa ON d.id = sa.department_id AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
            ${whereClause}
            GROUP BY d.id, d.name
            HAVING COUNT(sa.id) > 0 OR ? = 1
            ORDER BY d.name ASC
          `,
          values: [...vals, showAllDepts]
        });

        if (Array.isArray(data) && data.length === 0 && showAllDepts === 1) {
          data = await query({
            query: `
              SELECT
                d.name AS department,
                0 AS total_activities,
                0 AS completed,
                0 AS in_progress,
                0 AS delayed_cnt,
                0 AS avg_progress
              FROM departments d
              WHERE d.is_active = 1
              ORDER BY d.name ASC
            `,
            values: []
          });
        }
        break;
      }

      case 'staff-evaluation': {
        const vals: any[] = [];
        /** HR-synced staff in M&E; exclude separated employment (aligned with staff establishment) */
        let whereClause = `WHERE u.hrms_staff_id IS NOT NULL
          AND (
            u.employment_status IS NULL
            OR (
              LOWER(u.employment_status) NOT LIKE '%terminated%'
              AND LOWER(u.employment_status) NOT LIKE '%resign%'
              AND LOWER(u.employment_status) NOT LIKE '%retir%'
              AND LOWER(u.employment_status) NOT LIKE '%deceas%'
              AND LOWER(u.employment_status) NOT LIKE '%dismiss%'
            )
          )`;
        if (department && department !== 'All Departments') {
          whereClause += ' AND d.name = ?';
          vals.push(department);
        }
        if (genderFilter && genderFilter !== 'All') {
          whereClause += ' AND u.gender = ?';
          vals.push(genderFilter);
        }
        if (categoryFilter && categoryFilter !== 'All') {
          whereClause += ' AND u.staff_category = ?';
          vals.push(categoryFilter);
        }
        if (pwdFilter === 'yes') {
          whereClause += " AND u.disability_status = 'Yes'";
        } else if (pwdFilter === 'no') {
          whereClause += " AND u.disability_status = 'No'";
        } else if (pwdFilter === 'not_recorded') {
          whereClause += ' AND u.disability_status IS NULL';
        }

        const rows = (await query({
          query: `
            SELECT
              u.id AS user_id,
              u.full_name AS name,
              u.email,
              COALESCE(d.name, '—') AS department,
              u.faculty_office,
              u.gender,
              u.staff_category,
              u.designation_grade,
              u.position,
              u.disability_status,
              u.disability_type,
              u.workplace_accommodation,
              u.special_support_needs,
              u.leave_status,
              u.employment_status,
              u.contract_type,
              u.nationality,
              DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS date_of_birth,
              DATE_FORMAT(u.date_first_appointment, '%Y-%m-%d') AS date_first_appointment,
              DATE_FORMAT(u.date_current_appointment, '%Y-%m-%d') AS date_current_appointment,
              DATE_FORMAT(u.date_office_assignment, '%Y-%m-%d') AS date_office_assignment,
              DATE_FORMAT(u.retirement_date, '%Y-%m-%d') AS retirement_date,
              DATE_FORMAT(COALESCE(u.contract_start_date, u.contract_start), '%Y-%m-%d') AS contract_start_date,
              DATE_FORMAT(COALESCE(u.contract_end_date, u.contract_end), '%Y-%m-%d') AS contract_end_date,
              u.status AS account_status,
              IFNULL(assigned.cnt, 0) AS assigned,
              IFNULL(compl.cnt, 0) AS completed,
              CASE
                WHEN IFNULL(assigned.cnt, 0) = 0 THEN 0
                ELSE ROUND(IFNULL(compl.cnt, 0) * 100.0 / assigned.cnt, 0)
              END AS rate,
              (
                (
                  SELECT COUNT(*) FROM activity_assignments aa_cnt
                  WHERE aa_cnt.assigned_to_user_id = u.id
                  AND LOWER(TRIM(COALESCE(aa_cnt.status, ''))) NOT IN ('completed', 'evaluated', 'not_done')
                )
                + (
                  SELECT COUNT(*) FROM staff_process_assignments spa_cnt
                  WHERE spa_cnt.staff_id = u.id
                  AND LOWER(TRIM(COALESCE(spa_cnt.status, ''))) NOT IN ('evaluated', 'completed', 'not_done')
                )
              ) AS active_tasks
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN (
              SELECT assigned_to_user_id, COUNT(*) AS cnt
              FROM activity_assignments
              GROUP BY assigned_to_user_id
            ) assigned ON assigned.assigned_to_user_id = u.id
            LEFT JOIN (
              SELECT aa.assigned_to_user_id, COUNT(*) AS cnt
              FROM activity_assignments aa
              LEFT JOIN strategic_activities sa ON aa.activity_id = sa.id
              WHERE aa.status IN ('completed', 'submitted', 'evaluated')
                 OR sa.status = 'completed'
              GROUP BY aa.assigned_to_user_id
            ) compl ON compl.assigned_to_user_id = u.id
            ${whereClause}
            ORDER BY d.name ASC, u.full_name ASC
            LIMIT 10000
          `,
          values: vals
        })) as any[];

        const summaryRows = (await query({
          query: `
            SELECT
              COUNT(*) AS total_synced,
              SUM(CASE WHEN u.status = 'Active' THEN 1 ELSE 0 END) AS active_accounts,
              SUM(CASE WHEN u.disability_status = 'Yes' THEN 1 ELSE 0 END) AS pwd_count
            FROM users u
            WHERE u.hrms_staff_id IS NOT NULL
              AND (
                u.employment_status IS NULL
                OR (
                  LOWER(u.employment_status) NOT LIKE '%terminated%'
                  AND LOWER(u.employment_status) NOT LIKE '%resign%'
                  AND LOWER(u.employment_status) NOT LIKE '%retir%'
                  AND LOWER(u.employment_status) NOT LIKE '%deceas%'
                  AND LOWER(u.employment_status) NOT LIKE '%dismiss%'
                )
              )
          `,
          values: []
        })) as any[];

        const totalSynced = Number(summaryRows[0]?.total_synced ?? 0);
        const activeAccounts = Number(summaryRows[0]?.active_accounts ?? 0);
        const pwdCount = Number(summaryRows[0]?.pwd_count ?? 0);
        const pwdPct = totalSynced > 0 ? Math.round((pwdCount * 1000) / totalSynced) / 10 : 0;

        data = {
          rows: (rows || []).map((r: any) => ({
            user_id: Number(r.user_id),
            name: r.name,
            email: r.email,
            department: r.department,
            faculty_office: r.faculty_office?.trim() || null,
            gender: r.gender ?? null,
            staff_category: r.staff_category ?? null,
            designation_grade: r.designation_grade ?? null,
            position: r.position ?? null,
            disability_status: r.disability_status ?? null,
            disability_type: r.disability_type ?? null,
            workplace_accommodation: r.workplace_accommodation ?? null,
            special_support_needs: r.special_support_needs ?? null,
            leave_status: r.leave_status ?? null,
            employment_status: r.employment_status ?? null,
            contract_type: r.contract_type ?? null,
            nationality: r.nationality ?? null,
            date_of_birth: r.date_of_birth ?? null,
            date_first_appointment: r.date_first_appointment ?? null,
            date_current_appointment: r.date_current_appointment ?? null,
            date_office_assignment: r.date_office_assignment ?? null,
            retirement_date: r.retirement_date ?? null,
            contract_start_date: r.contract_start_date ?? null,
            contract_end_date: r.contract_end_date ?? null,
            account_status: r.account_status ?? null,
            active_tasks: Number(r.active_tasks ?? 0),
            assigned: Number(r.assigned ?? 0),
            completed: Number(r.completed ?? 0),
            rate: Number(r.rate ?? 0),
          })),
          summary: {
            total_synced: totalSynced,
            active_accounts: activeAccounts,
            pwd_count: pwdCount,
            pwd_pct: pwdPct,
            filtered_count: (rows || []).length,
          },
        };
        break;
      }

      case 'strategic-plan-overview': {
        // For Performance Trends: progress by pillar + overall status counts (all activities from DB)
        try {
          // By pillar: use actual pillar values from DB (supports old and new pillar enums)
          const byPillarRaw = (await query({
            query: `
              SELECT
                pillar,
                ROUND(IFNULL(AVG(progress), 0)) AS avg_progress,
                COUNT(id) AS count
              FROM strategic_activities
              WHERE parent_id IS NULL AND COALESCE(TRIM(source), '') <> ''
              GROUP BY pillar
              ORDER BY count DESC, pillar ASC
            `,
            values: []
          })) as any[];

          const byPillar = (byPillarRaw || []).map((r: any) => {
            const pillar = r.pillar != null ? String(r.pillar) : 'Other';
            const label = (PILLAR_LABELS as Record<string, string>)[pillar] || pillar;
            return {
              pillar: pillar || 'Other',
              label: label || 'Other',
              avg_progress: Number(r.avg_progress ?? 0),
              count: Number(r.count ?? 0)
            };
          });

          // If no pillars in DB, still show 2025-2030 pillars with zeros
          if (byPillar.length === 0) {
            STRATEGIC_PILLARS_2025_2030.forEach((p) => {
              byPillar.push({ pillar: p, label: PILLAR_LABELS[p] || p, avg_progress: 0, count: 0 });
            });
          }

          // Status: DB enum is (pending, in_progress, completed, overdue)
          const statusRows = (await query({
            query: `
              SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
                SUM(CASE WHEN status = 'overdue' OR (end_date IS NOT NULL AND end_date < CURDATE() AND status != 'completed') THEN 1 ELSE 0 END) AS delayed_cnt
              FROM strategic_activities
              WHERE parent_id IS NULL AND COALESCE(TRIM(source), '') <> ''
            `,
            values: []
          })) as any[];

          const s = statusRows?.[0] || {};
          const total = Number(s.total ?? 0);
          const completed = Number(s.completed ?? 0);
          const in_progress = Number(s.in_progress ?? 0);
          const delayed = Number(s.delayed_cnt ?? 0);
          const status = {
            completed,
            in_progress,
            delayed,
            pending: Math.max(0, total - completed - in_progress - delayed)
          };

          data = { byPillar, status };
        } catch (e) {
          console.error('strategic-plan-overview error', e);
          data = {
            byPillar: STRATEGIC_PILLARS_2025_2030.map((p) => ({ pillar: p, label: PILLAR_LABELS[p] || p, avg_progress: 0, count: 0 })),
            status: { completed: 0, in_progress: 0, delayed: 0, pending: 0 }
          };
        }
        break;
      }

      case 'trend-analysis': {
        // Horizontal axis = department/unit (not faculty/office). Only units under faculties/offices (parent_id IS NOT NULL).
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const dateFilter = fromParam && toParam;
        const startDate = dateFilter ? fromParam : null;
        const endDate = dateFilter ? toParam + ' 23:59:59' : null;

        try {
          const raw = await query({
            query: dateFilter
              ? `
              SELECT
                d.id,
                d.name AS label,
                ROUND(IFNULL(AVG(sa.progress), 0)) AS avg_progress
              FROM departments d
              LEFT JOIN strategic_activities sa ON sa.department_id = d.id AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
                AND (sa.updated_at >= ? AND sa.updated_at <= ? OR (sa.updated_at IS NULL AND sa.created_at >= ? AND sa.created_at <= ?))
              WHERE d.is_active = 1 AND d.parent_id IS NOT NULL
              GROUP BY d.id, d.name
              ORDER BY d.name ASC
              `
              : `
              SELECT
                d.id,
                d.name AS label,
                ROUND(IFNULL(AVG(sa.progress), 0)) AS avg_progress
              FROM departments d
              LEFT JOIN strategic_activities sa ON sa.department_id = d.id AND sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
              WHERE d.is_active = 1 AND d.parent_id IS NOT NULL
              GROUP BY d.id, d.name
              ORDER BY d.name ASC
              `,
            values: dateFilter ? [startDate, endDate, startDate, endDate] : []
          }) as any[];

          data = (raw || []).map((r: any) => ({
            label: r.label || '—',
            avg_progress: Number(r.avg_progress ?? 0)
          }));
        } catch (_) {
          data = [];
        }
        break;
      }

      case 'delayed-activities': {
        const vals: any[] = [];
        let whereClause = `
          WHERE sa.parent_id IS NULL AND COALESCE(TRIM(sa.source), '') <> ''
            AND (sa.status = 'overdue'
            OR (sa.end_date IS NOT NULL AND sa.end_date < CURDATE() AND sa.status != 'completed'))
        `;
        if (department && department !== 'All Departments') {
          whereClause += ' AND d.name = ?';
          vals.push(department);
        }

        data = await query({
          query: `
            SELECT
              sa.title,
              d.name AS department,
              DATE_FORMAT(sa.end_date, '%d %b %Y') AS deadline,
              DATEDIFF(CURDATE(), sa.end_date) AS days_overdue,
              sa.progress,
              sa.status
            FROM strategic_activities sa
            LEFT JOIN departments d ON sa.department_id = d.id
            ${whereClause}
            ORDER BY sa.end_date ASC
          `,
          values: vals
        });
        break;
      }

      case 'staff-establishment': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const establishmentPwd = searchParams.get('pwd');
        const employmentStatus = searchParams.get('employment_status');
        data = await generateStaffEstablishmentReport({
          faculty:
            faculty && faculty !== 'All Faculties' ? faculty : null,
          department:
            dept && dept !== 'All Departments' ? dept : null,
          pwd: establishmentPwd,
          employment_status: employmentStatus,
        });
        break;
      }

      case 'staff-promotion': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const promotionPwd = searchParams.get('pwd');
        data = await generateStaffPromotionReport({
          faculty:
            faculty && faculty !== 'All Faculties' ? faculty : null,
          department:
            dept && dept !== 'All Departments' ? dept : null,
          pwd: promotionPwd,
        });
        break;
      }

      case 'staff-retention': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const retentionPwd = searchParams.get('pwd');
        data = await generateStaffRetentionReport({
          faculty:
            faculty && faculty !== 'All Faculties' ? faculty : null,
          department:
            dept && dept !== 'All Departments' ? dept : null,
          pwd: retentionPwd,
        });
        break;
      }

      case 'staff-recruitment': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const recruitmentPwd = searchParams.get('pwd');
        const requestedUnitId = parseManagedUnitParam(searchParams.get('managed_unit_id'));
        const recruitmentScope = await resolveAmbassadorReportScope(userId, requestedUnitId);
        if (recruitmentScope.restricted && !recruitmentScope.managedUnitId) {
          return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        data = await generateStaffRecruitmentReport({
          faculty:
            faculty && faculty !== 'All Faculties' ? faculty : null,
          department:
            dept && dept !== 'All Departments' ? dept : null,
          pwd: recruitmentPwd,
          managedUnitId: recruitmentScope.managedUnitId,
        });
        break;
      }

      case 'staff-turnover': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const turnoverPwd = searchParams.get('pwd');
        const turnoverReason = searchParams.get('reason');
        data = await generateStaffTurnoverReport({
          faculty:
            faculty && faculty !== 'All Faculties' ? faculty : null,
          department:
            dept && dept !== 'All Departments' ? dept : null,
          pwd: turnoverPwd,
          reason: turnoverReason,
        });
        break;
      }

      case 'staff-development': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const devStaffType = searchParams.get('staff_type');
        const devPwd = searchParams.get('pwd');
        const academicYear = searchParams.get('academic_year');
        data = await generateStaffDevelopmentReport({
          faculty:
            faculty && faculty !== 'All Faculties' ? faculty : null,
          department:
            dept && dept !== 'All Departments' ? dept : null,
          staff_type: devStaffType,
          pwd: devPwd,
          academic_year: academicYear,
        });
        break;
      }

      case 'staff-payments': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const pwd = searchParams.get('pwd');
        const paymentType = searchParams.get('payment_type');
        data = await generateStaffPaymentsReport({
          faculty: faculty && faculty !== 'All Faculties' ? faculty : null,
          department: dept && dept !== 'All Departments' ? dept : null,
          pwd,
          payment_type: paymentType,
        });
        break;
      }

      case 'staff-benefits': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const benefitsPwd = searchParams.get('pwd');
        const requestedUnitId = parseManagedUnitParam(searchParams.get('managed_unit_id'));
        const benefitsScope = await resolveAmbassadorReportScope(userId, requestedUnitId);
        if (benefitsScope.restricted && !benefitsScope.managedUnitId) {
          return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        const departmentIds =
          benefitsScope.restricted && benefitsScope.managedUnitId
            ? await getManagedUnitDepartmentIds(benefitsScope.managedUnitId)
            : undefined;
        data = await generateStaffBenefitsReport({
          faculty: faculty && faculty !== 'All Faculties' ? faculty : null,
          department: dept && dept !== 'All Departments' ? dept : null,
          pwd: benefitsPwd,
          departmentIds,
        });
        break;
      }

      case 'staff-miscellaneous': {
        data = await generateStaffMiscellaneousReport();
        break;
      }

      case 'staff-workforce-assessments': {
        const requestedUnitId = parseManagedUnitParam(searchParams.get('managed_unit_id'));
        const workforceScope = await resolveAmbassadorReportScope(userId, requestedUnitId);
        if (workforceScope.restricted && !workforceScope.managedUnitId) {
          return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        data = await generateStaffWorkforceAssessmentsReport({
          managedUnitId: workforceScope.managedUnitId,
        });
        break;
      }

      case 'staff-employment-skill-status': {
        const requestedUnitId = parseManagedUnitParam(searchParams.get('managed_unit_id'));
        const skillsScope = await resolveAmbassadorReportScope(userId, requestedUnitId);
        if (skillsScope.restricted && !skillsScope.managedUnitId) {
          return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }
        data = await generateStaffEmploymentSkillStatusReport({
          managedUnitId: skillsScope.managedUnitId,
        });
        break;
      }

      case 'staff-strategic-priority': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const priorityGender = searchParams.get('gender');
        const priorityPwd = searchParams.get('pwd');
        data = await generateStaffStrategicPriorityReport({
          faculty: faculty && faculty !== 'All Faculties' ? faculty : null,
          department: dept && dept !== 'All Departments' ? dept : null,
          gender: priorityGender,
          pwd: priorityPwd,
        });
        break;
      }

      case 'staff-job-description-workplans': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const g = searchParams.get('gender');
        const p = searchParams.get('pwd');
        data = await generateStaffJobDescriptionWorkplansReport({
          faculty: faculty && faculty !== 'All Faculties' ? faculty : null,
          department: dept && dept !== 'All Departments' ? dept : null,
          gender: g,
          pwd: p,
        });
        break;
      }

      case 'staff-student-ratio': {
        const faculty = searchParams.get('faculty');
        const dept = searchParams.get('department');
        const programme = searchParams.get('programme');
        const g = searchParams.get('gender');
        const p = searchParams.get('pwd');
        data = await generateStaffStudentRatioReport({
          faculty: faculty && faculty !== 'All Faculties' ? faculty : null,
          department: dept && dept !== 'All Departments' ? dept : null,
          programme: programme && programme !== 'All Programmes' ? programme : null,
          gender: g,
          pwd: p,
        });
        break;
      }

      case 'staff-programme-enrollment': {
        const enrollmentGender = searchParams.get('gender');
        const enrollmentPwd = searchParams.get('pwd');
        const enrollmentFaculty = searchParams.get('faculty');
        data = await generateStaffProgrammeEnrollmentReport({
          gender: enrollmentGender,
          pwd: enrollmentPwd,
          faculty: enrollmentFaculty,
        });
        break;
      }

      case 'staff-course-unit-enrollment': {
        const g = searchParams.get('gender');
        const p = searchParams.get('pwd');
        const f = searchParams.get('faculty');
        data = await generateStaffCourseUnitEnrollmentReport({
          gender: g,
          pwd: p,
          faculty: f,
        });
        break;
      }

      default:
        return NextResponse.json({ message: 'Invalid report type' }, { status: 400 });
    }

    return NextResponse.json({
      type,
      from,
      to,
      department,
      data,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ message: 'Error generating report' }, { status: 500 });
  }
}
