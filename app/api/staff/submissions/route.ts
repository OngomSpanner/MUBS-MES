import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { brandEmailWrapper, escapeHtml, sendTransactionalMail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');

        const ratingToScore: Record<string, number> = { 
            excellent: 5, 
            good: 4, 
            satisfactory: 3, 
            needs_improvement: 2, 
            poor: 1,
            'Exceptional Performance': 5,
            'Exceeds Expectations': 4,
            'Meets Expectations': 3,
            'Improvement Needed': 2,
            'Below Expectations': 1
        };

        // Fetch all submissions for this user (including drafts)
        const submissionsRecords = await query({
            query: `
                SELECT 
                    sr.id,
                    COALESCE(sr.activity_assignment_id, sr.process_assignment_id) as task_id,
                    sr.process_assignment_id,
                    sr.process_subtask_id,
                    COALESCE(sa.id, psa_sa.id) as activity_id,
                    COALESCE(
                        sa.title,
                        CASE
                            WHEN sps.id IS NOT NULL THEN CONCAT_WS(' — ', NULLIF(sp.step_name, ''), NULLIF(sps.title, ''))
                            ELSE sp.step_name
                        END
                    ) as report_name,
                    COALESCE(sa.description, psa_sa.description) as task_description,
                    st.performance_indicator as instruction,
                    COALESCE(aa.start_date, spa.start_date) as start_date,
                    COALESCE(aa.end_date, spa.end_date) as end_date,
                    COALESCE(p.title, psa_sa.title) as activity_title,
                    sr.updated_at as submitted_at,
                    sr.submitted_at as submitted_at_ts,
                    sr.status as db_status,
                    e.rating,
                    sr.progress_percentage as progress,
                    sr.kpi_actual_value,
                    sr.achievements as description,
                    sr.attachments,
                    e.qualitative_feedback as reviewer_notes,
                    e.evaluation_date as evaluation_date,
                    eval_hod.full_name as evaluated_by_name,
                    CASE
                      WHEN sr.process_subtask_id IS NOT NULL THEN 'process_subtask'
                      WHEN sr.process_assignment_id IS NOT NULL THEN 'process_task'
                      ELSE 'legacy'
                    END as assignment_type
                FROM staff_reports sr
                LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                LEFT JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
                LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
                LEFT JOIN standard_processes sp ON spa.standard_process_id = sp.id
                LEFT JOIN standards st ON sp.standard_id = st.id
                LEFT JOIN strategic_activities psa_sa ON spa.activity_id = psa_sa.id
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                LEFT JOIN users eval_hod ON e.evaluated_by = eval_hod.id
                WHERE (aa.assigned_to_user_id = ? OR spa.staff_id = ? OR sps.assigned_to = ?)
                ORDER BY sr.updated_at DESC
            `,
            values: [decoded.userId, decoded.userId, decoded.userId]
        }) as any[];

        const statusMap: Record<string, string | ((r: any) => string)> = {
            'draft': (r: any) => (r.rating != null ? 'Returned' : 'In Progress'),
            'submitted': 'Under Review',
            'evaluated': 'Completed',
            'acknowledged': 'Completed',
            'incomplete': 'Incomplete',
            'not_done': 'Not Done'
        };

        const submissions = submissionsRecords.map((r: any) => {
            const rawStatus = statusMap[r.db_status];
            const status = typeof rawStatus === 'function' ? rawStatus(r) : (rawStatus || 'Unknown');
            const score = r.rating ? ratingToScore[r.rating] : null;
            return {
                id: r.id,
                task_id: r.task_id,
                process_assignment_id: r.process_assignment_id ?? null,
                process_subtask_id: r.process_subtask_id ?? null,
                report_name: r.report_name,
                activity_title: r.activity_title,
                task_description: r.task_description,
                start_date: r.start_date,
                end_date: r.end_date,
                submitted_at: r.submitted_at_ts || r.submitted_at,
                status,
                score,
                progress: r.progress,
                kpi_actual_value: r.kpi_actual_value,
                description: r.description,
                attachments: r.attachments,
                reviewer_notes: r.reviewer_notes,
                evaluated_by_name: r.evaluated_by_name ?? null,
                evaluation_date: r.evaluation_date ?? null,
                assignment_type: r.assignment_type === 'process_subtask' ? 'process_subtask' : (r.assignment_type === 'process_task' ? 'process_task' : 'legacy'),
            };
        });

        // Stats: total submitted = non-draft; under review = submitted; reviewed = evaluated/acknowledged; returned = draft with evaluation
        const reviewed = submissions.filter((r: any) => r.status === 'Completed').length;
        const returned = submissions.filter((r: any) => r.status === 'Returned').length;
        const totalEvaluations = reviewed + returned;

        const incomplete = submissions.filter((r: any) => r.status === 'Incomplete').length;
        const stats = {
            totalSubmitted: submissionsRecords.filter((r: any) => r.db_status !== 'draft').length,
            underReview: submissions.filter((r: any) => r.status === 'Under Review').length,
            reviewed,
            returned,
            incomplete,
            totalEvaluations,
            completionRate: totalEvaluations > 0 ? Math.round((reviewed / totalEvaluations) * 100) : 0
        };

        return NextResponse.json({
            submissions,
            stats
        });

    } catch (error: any) {
        console.error('Staff Submissions API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching staff submissions', detail: error.message },
            { status: error.message === 'Unauthorized' ? 401 : 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');

        const formData = await req.formData();
        const taskId = formData.get('taskId') as string; // aa.id, spa.id, or subtask id
        const assignmentType = (formData.get('assignmentType') as string) || 'legacy';
        const description = (formData.get('description') as string)?.trim() ?? '';
        const evidenceLink = formData.get('evidenceLink') as string;
        const isDraft = formData.get('isDraft') === 'true';
        const progress = formData.get('progress') ? parseInt(formData.get('progress') as string) : (isDraft ? 0 : 100);
        const file = formData.get('file') as File | null;

        if (!taskId) throw new Error('Task ID is required');

        let assignmentId = parseInt(taskId);
        
        // Validate assignment based on type
        if (assignmentType === 'process_subtask') {
            const subId = assignmentId;
            const subRows = await query({
                query: `
                  SELECT s.id, s.process_assignment_id, spa.start_date
                  FROM staff_process_subtasks s
                  JOIN staff_process_assignments spa ON s.process_assignment_id = spa.id
                  WHERE s.id = ? AND s.assigned_to = ?
                `,
                values: [subId, decoded.userId],
            }) as { id: number; process_assignment_id: number; start_date: string | null }[];
            if (subRows.length === 0) {
                return NextResponse.json({ message: 'No subtask assignment found' }, { status: 404 });
            }
            const startMissing =
                subRows[0].start_date == null || String(subRows[0].start_date).trim() === '';
            if (startMissing) {
                return NextResponse.json(
                    { message: 'This process has not been opened by your HOD yet. You can submit once they set a start date.' },
                    { status: 403 }
                );
            }
        } else if (assignmentType === 'process_task') {
            const spaRecords = await query({
                query: 'SELECT id, start_date FROM staff_process_assignments WHERE id = ? AND staff_id = ?',
                values: [assignmentId, decoded.userId]
            }) as { id: number; start_date: string | null }[];
            if (spaRecords.length === 0) {
                console.warn(`Staff Submissions: POST 404 - Process assignment ${assignmentId} not found for user ${decoded.userId}`);
                return NextResponse.json({ message: 'No process assignment found' }, { status: 404 });
            }
            const startMissing =
                spaRecords[0].start_date == null || String(spaRecords[0].start_date).trim() === '';
            if (startMissing) {
                return NextResponse.json(
                    {
                        message:
                            'This process has not been opened by your HOD yet. You can submit once they set a start date.',
                    },
                    { status: 403 }
                );
            }
        } else {
            const aaRecords = await query({
                query: 'SELECT id FROM activity_assignments WHERE id = ? AND assigned_to_user_id = ?',
                values: [assignmentId, decoded.userId]
            }) as any[];
            if (aaRecords.length === 0) {
                console.warn(`Staff Submissions: POST 404 - Activity assignment ${assignmentId} not found for user ${decoded.userId}`);
                return NextResponse.json({ message: 'No activity assignment found' }, { status: 404 });
            }
        }

        let fileUrl = '';
        if (file && file.size > 0) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            const uploadDir = path.join(process.cwd(), 'public/uploads');
            try {
                await mkdir(uploadDir, { recursive: true });
            } catch (err) { }

            const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\\-_]/g, '')}`;
            const filepath = path.join(uploadDir, uniqueFilename);
            await writeFile(filepath, buffer);
            fileUrl = `/uploads/${uniqueFilename}`;
        }

        let combinedEvidence = evidenceLink || '';
        if (fileUrl) {
            if (combinedEvidence) combinedEvidence += ` | ${fileUrl}`;
            else combinedEvidence = fileUrl;
        }

        const reportStatus = isDraft ? 'draft' : 'submitted';

        // Insert or update staff report
        const filterColumn =
            assignmentType === 'process_subtask'
                ? 'process_subtask_id'
                : assignmentType === 'process_task'
                  ? 'process_assignment_id'
                  : 'activity_assignment_id';
        
        const existingReport = await query({
            query: `SELECT id FROM staff_reports WHERE ${filterColumn} = ? AND submitted_by = ?`,
            values: [assignmentId, decoded.userId]
        }) as any[];

        if (existingReport.length > 0) {
            await query({
                query: `
                    UPDATE staff_reports 
                    SET progress_percentage = ?, 
                        achievements = ?, 
                        attachments = ?, 
                        kpi_actual_value = ?,
                        updated_at = NOW(),
                        status = ?,
                        submitted_at = IF(? = 'submitted', NOW(), submitted_at)
                    WHERE id = ?
                `,
                values: [progress, description || null, combinedEvidence || null, formData.get('kpiActualValue') || null, reportStatus, reportStatus, existingReport[0].id]
            });
        } else {
            const columns = `(activity_assignment_id, process_assignment_id, process_subtask_id, submitted_by, report_date, progress_percentage, achievements, attachments, kpi_actual_value, status, submitted_at)`;
            const values =
                assignmentType === 'process_subtask'
                    ? [null, null, assignmentId]
                    : assignmentType === 'process_task'
                      ? [null, assignmentId, null]
                      : [assignmentId, null, null];
            
            await query({
                query: `
                    INSERT INTO staff_reports 
                    ${columns}
                    VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, IF(? = 'submitted', NOW(), NULL))
                `,
                values: [...values, decoded.userId, progress, description || null, combinedEvidence || null, formData.get('kpiActualValue') || null, reportStatus, reportStatus]
            });
        }

        // Update the assignment status
        if (assignmentType === 'process_subtask') {
            await query({
                query: 'UPDATE staff_process_subtasks SET status = ? WHERE id = ?',
                values: [reportStatus === 'submitted' ? 'submitted' : 'in_progress', assignmentId],
            });
        } else if (assignmentType === 'process_task') {
            await query({
                query: 'UPDATE staff_process_assignments SET status = ? WHERE id = ?',
                values: [reportStatus === 'submitted' ? 'submitted' : 'in_progress', assignmentId]
            });
        } else {
            await query({
                query: 'UPDATE activity_assignments SET status = ? WHERE id = ?',
                values: [reportStatus === 'submitted' ? 'submitted' : 'in_progress', assignmentId]
            });
        }

        if (reportStatus === 'submitted') {
            const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
            const hodLink = `${base}/department-head`;
            type HodCtx = { hod_id: number | null; activity_title: string; task_label: string };
            let ctx: HodCtx | null = null;
            if (assignmentType === 'process_subtask') {
                const r = (await query({
                    query: `
                        SELECT d.hod_id, sa.title AS activity_title,
                               CONCAT_WS(' — ', NULLIF(sp.step_name, ''), NULLIF(s.title, '')) AS task_label
                        FROM staff_process_subtasks s
                        JOIN staff_process_assignments spa ON s.process_assignment_id = spa.id
                        JOIN strategic_activities sa ON spa.activity_id = sa.id
                        JOIN standard_processes sp ON spa.standard_process_id = sp.id
                        LEFT JOIN departments d ON sa.department_id = d.id
                        WHERE s.id = ? AND s.assigned_to = ?
                    `,
                    values: [assignmentId, decoded.userId],
                })) as HodCtx[];
                ctx = r[0] ?? null;
            } else if (assignmentType === 'process_task') {
                const r = (await query({
                    query: `
                        SELECT d.hod_id, sa.title AS activity_title, sp.step_name AS task_label
                        FROM staff_process_assignments spa
                        JOIN strategic_activities sa ON spa.activity_id = sa.id
                        JOIN standard_processes sp ON spa.standard_process_id = sp.id
                        LEFT JOIN departments d ON sa.department_id = d.id
                        WHERE spa.id = ? AND spa.staff_id = ?
                    `,
                    values: [assignmentId, decoded.userId],
                })) as HodCtx[];
                ctx = r[0] ?? null;
            } else {
                const r = (await query({
                    query: `
                        SELECT d.hod_id,
                               COALESCE(p.title, sa.title) AS activity_title,
                               sa.title AS task_label
                        FROM activity_assignments aa
                        JOIN strategic_activities sa ON aa.activity_id = sa.id
                        LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                        LEFT JOIN departments d ON sa.department_id = d.id
                        WHERE aa.id = ? AND aa.assigned_to_user_id = ?
                    `,
                    values: [assignmentId, decoded.userId],
                })) as HodCtx[];
                ctx = r[0] ?? null;
            }

            if (ctx?.hod_id != null) {
                const hodUser = (await query({
                    query: 'SELECT email, full_name FROM users WHERE id = ? AND status = ?',
                    values: [ctx.hod_id, 'Active'],
                })) as { email: string; full_name: string }[];
                const hodEmail = hodUser[0]?.email?.trim();
                const staffRow = (await query({
                    query: 'SELECT full_name FROM users WHERE id = ?',
                    values: [decoded.userId],
                })) as { full_name: string }[];
                const staffName = staffRow[0]?.full_name || 'A staff member';
                if (hodEmail) {
                    const inner = `
<p style="color:#333333;font-size:16px;line-height:1.6;">Hello ${escapeHtml(hodUser[0].full_name || '')},</p>
<p style="color:#333333;font-size:16px;line-height:1.6;"><strong>${escapeHtml(staffName)}</strong> submitted a report for review.</p>
<p style="color:#666666;font-size:14px;line-height:1.6;"><strong>Activity:</strong> ${escapeHtml(ctx.activity_title || '')}<br/>
<strong>Task:</strong> ${escapeHtml(ctx.task_label || '')}</p>
<p style="color:#333333;font-size:16px;line-height:1.6;">Review submissions in the department head portal: <a href="${escapeHtml(hodLink)}" style="color:#005696;">${escapeHtml(hodLink)}</a></p>`;
                    void sendTransactionalMail({
                        to: hodEmail,
                        subject: 'M&E: Staff report submitted for review',
                        html: brandEmailWrapper(inner),
                    });
                }
            }
        }

        return NextResponse.json({ success: true, message: isDraft ? 'Draft saved' : 'Report submitted successfully' });

    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
            console.log('Staff Submissions API: Unauthorized access attempt (session expired)');
        } else {
            console.error('Staff Submissions API POST Error:', error);
        }
        return NextResponse.json(
            { message: 'Error submitting report', detail: error.message },
            { status: (error.message === 'Unauthorized' || error.message === 'Invalid token') ? 401 : 500 }
        );
    }
}
