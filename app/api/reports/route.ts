import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { STRATEGIC_PILLARS_2025_2030, PILLAR_LABELS } from '@/lib/strategic-plan';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
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
        let whereClause = 'WHERE u.status = ?';
        vals.push('Active');
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
            LIMIT 500
          `,
          values: vals
        })) as any[];

        const summaryRows = (await query({
          query: `
            SELECT
              COUNT(*) AS total_active,
              SUM(CASE WHEN u.disability_status = 'Yes' THEN 1 ELSE 0 END) AS pwd_count
            FROM users u
            WHERE u.status = 'Active'
          `,
          values: []
        })) as any[];

        const totalActive = Number(summaryRows[0]?.total_active ?? 0);
        const pwdCount = Number(summaryRows[0]?.pwd_count ?? 0);
        const pwdPct = totalActive > 0 ? Math.round((pwdCount * 1000) / totalActive) / 10 : 0;

        data = {
          rows: (rows || []).map((r: any) => ({
            user_id: Number(r.user_id),
            name: r.name,
            email: r.email,
            department: r.department,
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
            total_active: totalActive,
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
