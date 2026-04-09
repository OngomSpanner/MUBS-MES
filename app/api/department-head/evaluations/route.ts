import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getVisibleDepartmentIds, inPlaceholders } from '@/lib/department-head';
import {
    computeCompleteEvaluationMetrics,
    mergeEvaluationFeedback,
    ratingForCompleteMetrics,
} from '@/lib/evaluation-scoring';
import { autoOpenNextProcessStepAfterCompletion } from '@/lib/process-auto-open';
import { brandEmailWrapper, escapeHtml, sendTransactionalMail } from '@/lib/mail';

async function appendSubmissionFeedbackLog(staffReportId: number, authorUserId: number, body: string) {
    const text = String(body || '').trim();
    if (!text) return;
    try {
        await query({
            query: `INSERT INTO submission_feedback_events (staff_report_id, author_user_id, body) VALUES (?, ?, ?)`,
            values: [staffReportId, authorUserId, text],
        });
    } catch {
        /* submission_feedback_events optional until migration */
    }
}

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');

        const departmentIds = await getVisibleDepartmentIds(decoded.userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({ pending: [], completed: [] });
        }

        const placeholders = inPlaceholders(departmentIds.length);

        const searchParams = new URL(req.url).searchParams;
        const taskId = searchParams.get('taskId');

        const evaluationsQuery = await query({
            query: `
                SELECT 
                    sr.id,
                    COALESCE(
                        sa.title,
                        CASE
                          WHEN sps.id IS NOT NULL THEN CONCAT(sp.step_name, ' — ', sps.title)
                          ELSE sp.step_name
                        END
                    ) as report_name,
                    COALESCE(p.title, psa_sa.title) as activity_title,
                    u.full_name as staff_name,
                    sr.updated_at as submitted_at,
                    sr.status as db_status,
                    sr.progress_percentage as progress,
                    sr.achievements as report_summary,
                    sr.attachments,
                    e.score,
                    e.metrics_achieved,
                    e.metrics_target,
                    e.qualitative_feedback as reviewer_notes,
                    e.rating,
                    COALESCE(sa.task_type, 'process') as task_type,
                    sr.kpi_actual_value
                FROM staff_reports sr
                LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                LEFT JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p ON sa.parent_id = p.id
                LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
                LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
                LEFT JOIN standard_processes sp ON spa.standard_process_id = sp.id
                LEFT JOIN strategic_activities psa_sa ON spa.activity_id = psa_sa.id
                JOIN users u ON COALESCE(aa.assigned_to_user_id, spa.staff_id, sps.assigned_to) = u.id
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                WHERE (sa.department_id IN (${placeholders}) OR p.department_id IN (${placeholders}) OR psa_sa.department_id IN (${placeholders}))
                AND (sr.status IN ('submitted', 'evaluated', 'incomplete', 'not_done') OR (sr.status = 'draft' AND e.id IS NOT NULL))
                ${
                    taskId
                        ? 'AND (sa.id = ? OR psa_sa.id = ? OR spa.id = ? OR aa.id = ?)'
                        : ''
                }
                ORDER BY sr.updated_at DESC
            `,
            values: [
                ...departmentIds,
                ...departmentIds,
                ...departmentIds,
                ...(taskId ? [taskId, taskId, taskId, taskId] : []),
            ]
        }) as any[];

        // Progress in list: same scale as Department Efficiency — use evaluation outcome when evaluated, else staff-reported progress_percentage
        const progressFromDbStatus = (dbStatus: string | null): number | null => {
            if (!dbStatus) return null;
            const s = (dbStatus + '').toLowerCase();
            // "submitted" means awaiting review; progress is not an evaluation outcome yet.
            if (s === 'submitted') return 0;
            if (s === 'draft') return 0;
            if (s === 'evaluated') return 100;
            if (s === 'incomplete') return 50;
            if (s === 'not_done') return 0;
            return null;
        };

        const evaluations = evaluationsQuery.map((e: any) => {
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
            const is02Scale = e.metrics_target === 2 && e.metrics_achieved != null;
            const scoreDisplay = is02Scale ? e.metrics_achieved : (e.rating ? ratingToScore[e.rating] : (e.score != null ? Math.round(Number(e.score) / 20) : undefined));
            const displayStatus = e.db_status === 'submitted' ? 'Pending' : e.db_status === 'incomplete' ? 'Incomplete' : e.db_status === 'not_done' ? 'Not Done' : (e.db_status === 'draft' ? 'Returned' : 'Completed');
            const derivedProgress = progressFromDbStatus(e.db_status);
            const progress = derivedProgress != null ? derivedProgress : (e.progress != null ? Math.min(100, Math.max(0, Number(e.progress))) : 0);
            return {
                ...e,
                status: displayStatus,
                score: scoreDisplay,
                progress
            };
        });
        evaluations.forEach((e: any) => { delete e.rating; });

        const pending = evaluations.filter((e: any) => e.status === 'Pending');
        const completed = evaluations.filter((e: any) => ['Completed', 'Returned', 'Incomplete', 'Not Done'].includes(e.status));

        return NextResponse.json({
            pending,
            completed
        });
    } catch (error: any) {
        console.error('Department Evaluations API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching department evaluations', detail: error.message },
            { status: 500 }
        );
    }
}

const ratingFromScore = (score: number): string => {
    if (score <= 1) return 'Below Expectations';
    if (score <= 2) return 'Improvement Needed';
    if (score <= 3) return 'Meets Expectations';
    if (score <= 4) return 'Exceeds Expectations';
    return 'Exceptional Performance';
};

export async function PUT(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');

        const decoded = verifyToken(token) as any;
        if (!decoded || !decoded.userId) throw new Error('Invalid token');
        const userId = decoded.userId;

        let departmentIds = await getVisibleDepartmentIds(userId);
        if (departmentIds.length === 0) {
            return NextResponse.json({ message: 'No department assigned' }, { status: 403 });
        }
        departmentIds = departmentIds.map((id: number) => Number(id));

        const body = await req.json();
        const { id: staffReportId, status, score, reviewer_notes, kpi_actual_value } = body;
        if (!staffReportId || !status) {
            return NextResponse.json({ message: 'id and status are required' }, { status: 400 });
        }
        const terminalStatuses = ['Complete', 'Incomplete', 'Not Done'];
        const legacyReturned = status === 'Returned';
        if (!terminalStatuses.includes(status) && !legacyReturned) {
            return NextResponse.json({ message: 'status must be one of: Complete, Incomplete, Not Done' }, { status: 400 });
        }
        // Performance scale: Complete = 2 pts, Incomplete = 1 pt, Not Done = 0 pts
        const validScores = [0, 1, 2];
        const scoreNum = score != null ? Number(score) : null;
        // Complete: client sends score 2 as "approve" intent; actual points (1 or 2) are computed from dates.
        if (status === 'Complete' && scoreNum !== 2) {
            return NextResponse.json({ message: 'Complete must be submitted as a full approval (2 pt intent).' }, { status: 400 });
        }
        if (status === 'Incomplete' && (scoreNum !== 1)) {
            return NextResponse.json({ message: 'Incomplete must be submitted with 1 point.' }, { status: 400 });
        }
        if (status === 'Not Done' && (scoreNum !== 0)) {
            return NextResponse.json({ message: 'Not Done must be submitted with 0 points.' }, { status: 400 });
        }
        if (!validScores.includes(scoreNum as number)) {
            return NextResponse.json({ message: 'Score must be 0, 1, or 2 (Not Done, Incomplete, Complete).' }, { status: 400 });
        }

        let appliedCompleteScore: number | undefined;
        let delayedHodNoteApplied = false;
        /** When a standard process step is fully marked Complete, open the next step (sequential workflow). */
        let autoOpenAfterProcessAssignmentId: number | null = null;

        if ((status === 'Incomplete' || legacyReturned) && (!reviewer_notes || String(reviewer_notes).trim() === '')) {
            return NextResponse.json({ message: 'Comment is required when marking Incomplete.' }, { status: 400 });
        }

        const placeholders = inPlaceholders(departmentIds.length);
        const reportCheck = await query({
            query: `
                SELECT
                    sr.id,
                    sr.activity_assignment_id,
                    sr.process_assignment_id,
                    sr.process_subtask_id,
                    COALESCE(aa.activity_id, spa.activity_id) as task_id,
                    COALESCE(sa.id, psa_sa.id) as sa_id,
                    COALESCE(sa.task_type, 'process') as task_type,
                    COALESCE(sa.parent_id, psa_sa.parent_id) as strategic_activity_id,
                    COALESCE(sr.submitted_at, sr.updated_at) as staff_submitted_at,
                    COALESCE(aa.end_date, spa.end_date) as assignment_end_date,
                    spa.id as resolved_process_assignment_id
                FROM staff_reports sr
                LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                LEFT JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
                LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
                LEFT JOIN strategic_activities psa_sa ON spa.activity_id = psa_sa.id
                WHERE sr.id = ?
                  AND (sa.department_id IN (${placeholders}) OR psa_sa.department_id IN (${placeholders}))
            `,
            values: [staffReportId, ...departmentIds, ...departmentIds]
        }) as any[];
        if (reportCheck.length === 0) {
            return NextResponse.json({ message: 'Report not found or unauthorized' }, { status: 403 });
        }

        const row = reportCheck[0];
        const taskType = row.task_type;
        const taskId = Number(row.task_id ?? row.sa_id ?? 0) || null;
        const parentId = row.strategic_activity_id;
        const assignmentId = row.activity_assignment_id;
        const processAssignmentId = row.resolved_process_assignment_id ?? row.process_assignment_id;
        const processSubtaskId = row.process_subtask_id != null ? Number(row.process_subtask_id) : null;
        // When HOD marks Complete, task progress is set to 100% for Department Tasks display
        const taskProgressWhenComplete = 100;
        const isKpiDriver = taskType === 'kpi_driver';
        // KPI actual value is optional when marking Complete (work is determined by rating option)

        // Resolve task id for updating strategic_activities.progress (same scale as Department Efficiency: Complete=100%, Incomplete=50%, Not Done=0%)
        async function resolveTaskId(): Promise<number | null> {
            let id = taskId;
            if (!id && assignmentId) {
                const aaRow = await query({
                    query: 'SELECT activity_id FROM activity_assignments WHERE id = ?',
                    values: [assignmentId]
                }) as any[];
                id = aaRow[0]?.activity_id ? Number(aaRow[0].activity_id) : null;
            }
            return id ?? null;
        }

        if (status === 'Incomplete' || legacyReturned) {
            const dbStatus = 'incomplete';
            await query({
                query: 'UPDATE staff_reports SET status = ? WHERE id = ?',
                values: [dbStatus, staffReportId]
            });
            const notes = reviewer_notes || '';
            const existing = await query({
                query: 'SELECT id FROM evaluations WHERE staff_report_id = ?',
                values: [staffReportId]
            }) as any[];
            const ratingInc = 'Improvement Needed';
            if (existing.length > 0) {
                await query({
                    query: 'UPDATE evaluations SET qualitative_feedback = ?, evaluated_by = ?, evaluation_date = CURRENT_TIMESTAMP, metrics_achieved = 1, metrics_target = 2, rating = ? WHERE staff_report_id = ?',
                    values: [notes, userId, ratingInc, staffReportId]
                });
            } else {
                await query({
                    query: `INSERT INTO evaluations (staff_report_id, evaluated_by, qualitative_feedback, metrics_achieved, metrics_target, rating, created_at) VALUES (?, ?, ?, 1, 2, ?, CURRENT_TIMESTAMP)`,
                    values: [staffReportId, userId, notes, ratingInc]
                });
            }
            await appendSubmissionFeedbackLog(staffReportId, userId, notes);

            // Update assignment status for Incomplete
            if (assignmentId) {
                await query({
                    query: 'UPDATE activity_assignments SET status = ? WHERE id = ?',
                    values: ['incomplete', assignmentId]
                });
            }
            if (processAssignmentId) {
                if (processSubtaskId) {
                    await query({
                        query: 'UPDATE staff_process_subtasks SET status = ? WHERE id = ?',
                        values: ['incomplete', processSubtaskId],
                    });
                } else {
                    await query({
                        query: 'UPDATE staff_process_assignments SET status = ? WHERE id = ?',
                        values: ['incomplete', processAssignmentId]
                    });
                }
            }
        }

        else if (status === 'Not Done') {
            await query({
                query: 'UPDATE staff_reports SET status = ? WHERE id = ?',
                values: ['not_done', staffReportId]
            });
            const existing = await query({
                query: 'SELECT id FROM evaluations WHERE staff_report_id = ?',
                values: [staffReportId]
            }) as any[];
            const ratingNot = 'Below Expectations';
            if (existing.length > 0) {
                await query({
                    query: 'UPDATE evaluations SET qualitative_feedback = ?, evaluated_by = ?, evaluation_date = CURRENT_TIMESTAMP, metrics_achieved = 0, metrics_target = 2, rating = ? WHERE staff_report_id = ?',
                    values: [reviewer_notes || '', userId, ratingNot, staffReportId]
                });
            } else {
                await query({
                    query: `INSERT INTO evaluations (staff_report_id, evaluated_by, qualitative_feedback, metrics_achieved, metrics_target, rating, created_at) VALUES (?, ?, ?, 0, 2, ?, CURRENT_TIMESTAMP)`,
                    values: [staffReportId, userId, reviewer_notes || '', ratingNot]
                });
            }
            await appendSubmissionFeedbackLog(staffReportId, userId, reviewer_notes || '');
            // Update assignment status for Not Done
            if (assignmentId) {
                await query({
                    query: 'UPDATE activity_assignments SET status = ? WHERE id = ?',
                    values: ['not_done', assignmentId]
                });
            }
            if (processAssignmentId) {
                if (processSubtaskId) {
                    await query({
                        query: 'UPDATE staff_process_subtasks SET status = ? WHERE id = ?',
                        values: ['not_done', processSubtaskId],
                    });
                } else {
                    await query({
                        query: 'UPDATE staff_process_assignments SET status = ? WHERE id = ?',
                        values: ['not_done', processAssignmentId]
                    });
                }
            }
        }
        else if (status === 'Complete') {
            // Complete path: set staff_reports.status = 'evaluated', store kpi_actual_value if KPI-Driver, update parent Strategic Activity actuals
            const kpiActualNum = isKpiDriver && kpi_actual_value != null && kpi_actual_value !== '' ? Number(kpi_actual_value) : null;
            if (kpiActualNum != null && !Number.isNaN(kpiActualNum) && parentId != null) {
                await query({
                    query: 'UPDATE staff_reports SET status = ?, kpi_actual_value = ? WHERE id = ?',
                    values: ['evaluated', kpiActualNum, staffReportId]
                });
                await query({
                    query: 'UPDATE strategic_activities SET actual_value = COALESCE(actual_value, 0) + ? WHERE id = ?',
                    values: [kpiActualNum, parentId]
                });
            } else {
                await query({
                    query: 'UPDATE staff_reports SET status = ? WHERE id = ?',
                    values: ['evaluated', staffReportId]
                });
            }

            let metricsAchieved: 0 | 1 | 2;
            let appendNote: string | null;
            if (processAssignmentId) {
                metricsAchieved = 2;
                appendNote = null;
            } else {
                const computed = computeCompleteEvaluationMetrics({
                    assignmentEnd: row.assignment_end_date,
                    staffSubmittedAt: row.staff_submitted_at,
                });
                metricsAchieved = computed.metricsAchieved;
                appendNote = computed.appendNote;
            }
            appliedCompleteScore = metricsAchieved;
            delayedHodNoteApplied = Boolean(appendNote);
            const qualitativeMerged = mergeEvaluationFeedback(reviewer_notes || '', appendNote);
            const rating = ratingForCompleteMetrics(metricsAchieved);
            const metricsTarget = 2;

            const existingEval = await query({
                query: 'SELECT id FROM evaluations WHERE staff_report_id = ?',
                values: [staffReportId]
            }) as any[];

            if (existingEval.length > 0) {
                await query({
                    query: `
                        UPDATE evaluations SET evaluated_by = ?, evaluation_date = CURRENT_TIMESTAMP,
                        qualitative_feedback = ?, metrics_achieved = ?, metrics_target = ?, rating = ?
                        WHERE staff_report_id = ?
                    `,
                    values: [userId, qualitativeMerged, metricsAchieved, metricsTarget, rating, staffReportId]
                });
            } else {
                await query({
                    query: `
                        INSERT INTO evaluations (staff_report_id, evaluated_by, qualitative_feedback, metrics_achieved, metrics_target, rating, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `,
                    values: [staffReportId, userId, qualitativeMerged, metricsAchieved, metricsTarget, rating]
                });
            }
            await appendSubmissionFeedbackLog(staffReportId, userId, reviewer_notes || '');

            // Update assignment status for Complete
            if (assignmentId) {
                await query({
                    query: 'UPDATE activity_assignments SET status = ? WHERE id = ?',
                    values: ['evaluated', assignmentId]
                });
            }
            if (processAssignmentId) {
                if (processSubtaskId) {
                    await query({
                        query: 'UPDATE staff_process_subtasks SET status = ? WHERE id = ?',
                        values: ['evaluated', processSubtaskId],
                    });
                } else {
                    await query({
                        query: 'UPDATE staff_process_assignments SET status = ? WHERE id = ?',
                        values: ['evaluated', processAssignmentId]
                    });
                    autoOpenAfterProcessAssignmentId = Number(processAssignmentId);
                }
            }
        }

        // If this report belongs to a sub-task, recompute the parent process_assignment status from its subtasks.
        // This prevents marking the whole process assignment "evaluated" when only one sub-task is reviewed.
        if (processAssignmentId && processSubtaskId) {
            const subStatuses = (await query({
                query: 'SELECT status FROM staff_process_subtasks WHERE process_assignment_id = ?',
                values: [processAssignmentId],
            })) as { status: string }[];
            const normalized = subStatuses.map((r) => String(r.status || '').toLowerCase());
            const total = normalized.length;
            const done = normalized.filter((s) => s === 'completed' || s === 'evaluated').length;
            let parentStatus = 'in_progress';
            if (total > 0 && done === total) parentStatus = 'evaluated';
            else if (normalized.includes('submitted')) parentStatus = 'submitted';
            else if (normalized.includes('incomplete')) parentStatus = 'incomplete';
            else if (normalized.includes('not_done')) parentStatus = 'not_done';
            await query({
                query: 'UPDATE staff_process_assignments SET status = ? WHERE id = ?',
                values: [parentStatus, processAssignmentId],
            });
            if (parentStatus === 'evaluated') {
                autoOpenAfterProcessAssignmentId = Number(processAssignmentId);
            }
        }

        // Recalculate and update the task/activity progress (strategic_activities.progress)
        const updateTaskId = await resolveTaskId();
        let taskIdToUpdate: number | null = updateTaskId;
        let parentIdForRecalc = parentId;

        if (processAssignmentId) {
            // Standard process assignment: recalculate based on assignments.
            const assignments = await query({
                query: 'SELECT status FROM staff_process_assignments WHERE activity_id = ?',
                values: [taskId]
            }) as any[];
            const total = assignments.length || 1;
            const points = assignments.reduce((acc: number, cur: any) => {
                if (cur.status === 'evaluated') return acc + 100;
                if (cur.status === 'incomplete') return acc + 50;
                return acc;
            }, 0);
            const currentProgress = Math.round(points / total);
            const currentStatus = currentProgress === 100 ? 'completed' : 'in_progress';

            if (taskId) {
                await query({
                    query: 'UPDATE strategic_activities SET progress = ?, status = ? WHERE id = ?',
                    values: [currentProgress, currentStatus, taskId]
                });
            }
            parentIdForRecalc = row.strategic_activity_id;
        } else if (updateTaskId) {
            // Fixed outcome for standard tasks
            const taskProgress = status === 'Complete' ? 100 : (status === 'Incomplete' ? 50 : 0);
            const taskStatus = status === 'Complete' ? 'completed' : 'in_progress';
            
            const rowCheck = await query({
                query: 'SELECT id, parent_id, department_id, title, description, pillar, target_kpi, start_date, end_date, created_by FROM strategic_activities WHERE id = ?',
                values: [updateTaskId]
            }) as any[];
            const isParentRow = rowCheck[0]?.parent_id == null;

            if (isParentRow) {
                // Shared activity logic: update/create department child
                const childInDept = await query({
                    query: `SELECT id FROM strategic_activities WHERE parent_id = ? AND department_id IN (${placeholders}) ORDER BY id LIMIT 1`,
                    values: [updateTaskId, ...departmentIds]
                }) as any[];
                let childId = childInDept[0]?.id ? Number(childInDept[0].id) : null;

                if (!childId && (rowCheck[0].department_id != null && !departmentIds.includes(rowCheck[0].department_id))) {
                    const r = rowCheck[0];
                    const insertResult = await query({
                        query: `
                            INSERT INTO strategic_activities 
                            (activity_type, task_type, source, title, description, pillar, department_id, target_kpi, status, parent_id, progress, start_date, end_date, created_by)
                            VALUES ('detailed', 'process', 'strategic_plan', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        values: [r.title, r.description, r.pillar, departmentIds[0], r.target_kpi, taskStatus, updateTaskId, taskProgress, r.start_date, r.end_date, r.created_by]
                    }) as any;
                    childId = insertResult.insertId;
                }

                if (childId) {
                    taskIdToUpdate = childId;
                    parentIdForRecalc = updateTaskId;
                }
            }

            if (taskIdToUpdate) {
                await query({
                    query: 'UPDATE strategic_activities SET progress = ?, status = ? WHERE id = ?',
                    values: [taskProgress, taskStatus, taskIdToUpdate]
                });
            }
        }

        // Final step: Recalculate parent goal progress so Activity page correctly reflects child unit completions
        let parentProgress = 0;
        let parentUpdated = false;
        if (parentIdForRecalc) {
            const childCounts = await query({
                query: `
                    SELECT 
                        COUNT(*) as total,
                        COALESCE(SUM(progress), 0) as total_progress
                    FROM strategic_activities
                    WHERE parent_id = ?
                `,
                values: [parentIdForRecalc]
            }) as any[];
            const totalRec = Number(childCounts[0]?.total ?? 0);
            const sumProgress = Number(childCounts[0]?.total_progress ?? 0);
            parentProgress = totalRec > 0 ? Math.round(sumProgress / totalRec) : 0;
            const parentStatus = parentProgress === 100 ? 'completed' : 'in_progress';
            const parentResult = await query({
                query: 'UPDATE strategic_activities SET progress = ?, status = ? WHERE id = ?',
                values: [parentProgress, parentStatus, parentIdForRecalc]
            }) as any;
            parentUpdated = parentResult?.affectedRows > 0;
        }

        if (status === 'Complete' && autoOpenAfterProcessAssignmentId != null) {
            try {
                await autoOpenNextProcessStepAfterCompletion(autoOpenAfterProcessAssignmentId, departmentIds);
            } catch (e) {
                console.error('Auto-open next process step:', e);
            }
        }

        const assigneeRows = (await query({
            query: `
                SELECT u.email, u.full_name, e.qualitative_feedback AS feedback,
                       COALESCE(
                         sa.title,
                         CASE WHEN sps.id IS NOT NULL THEN CONCAT_WS(' — ', NULLIF(sp.step_name, ''), NULLIF(sps.title, '')) ELSE sp.step_name END
                       ) AS task_name,
                       COALESCE(p_leg.title, p_proc.title) AS activity_title
                FROM staff_reports sr
                LEFT JOIN activity_assignments aa ON sr.activity_assignment_id = aa.id
                LEFT JOIN strategic_activities sa ON aa.activity_id = sa.id
                LEFT JOIN strategic_activities p_leg ON sa.parent_id = p_leg.id
                LEFT JOIN staff_process_subtasks sps ON sr.process_subtask_id = sps.id
                LEFT JOIN staff_process_assignments spa ON COALESCE(sr.process_assignment_id, sps.process_assignment_id) = spa.id
                LEFT JOIN standard_processes sp ON spa.standard_process_id = sp.id
                LEFT JOIN strategic_activities psa_sa ON spa.activity_id = psa_sa.id
                LEFT JOIN strategic_activities p_proc ON psa_sa.parent_id = p_proc.id
                JOIN users u ON u.id = COALESCE(aa.assigned_to_user_id, spa.staff_id, sps.assigned_to)
                LEFT JOIN evaluations e ON e.staff_report_id = sr.id
                WHERE sr.id = ?
            `,
            values: [staffReportId],
        })) as {
            email: string;
            full_name: string;
            feedback: string | null;
            task_name: string | null;
            activity_title: string | null;
        }[];

        const assignee = assigneeRows[0];
        const assigneeEmail = assignee?.email?.trim();
        if (assigneeEmail) {
            const outcomeLabel =
                status === 'Complete'
                    ? 'Complete'
                    : status === 'Not Done'
                      ? 'Not Done'
                      : 'Incomplete — revision requested';
            const subject =
                status === 'Complete'
                    ? 'M&E: Your submission was reviewed (Complete)'
                    : status === 'Not Done'
                      ? 'M&E: Your submission was reviewed (Not Done)'
                      : 'M&E: Your submission was reviewed (revision requested)';
            const fbRaw = (assignee.feedback || '').trim();
            const fbShort = fbRaw.length > 2000 ? `${fbRaw.slice(0, 1997)}…` : fbRaw;
            const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
            const staffLink = `${base}/staff`;
            const inner = `
<p style="color:#333333;font-size:16px;line-height:1.6;">Hello ${escapeHtml(assignee.full_name || '')},</p>
<p style="color:#333333;font-size:16px;line-height:1.6;">Your department head has reviewed your submission. <strong>Outcome:</strong> ${escapeHtml(outcomeLabel)}</p>
<p style="color:#666666;font-size:14px;line-height:1.6;"><strong>Activity:</strong> ${escapeHtml(assignee.activity_title || '')}<br/>
<strong>Task:</strong> ${escapeHtml(assignee.task_name || '')}</p>
${fbShort ? `<p style="color:#333333;font-size:15px;line-height:1.6;"><strong>Feedback:</strong><br/>${escapeHtml(fbShort).replace(/\n/g, '<br/>')}</p>` : ''}
<p style="color:#333333;font-size:16px;line-height:1.6;">Open the staff portal: <a href="${escapeHtml(staffLink)}" style="color:#005696;">${escapeHtml(staffLink)}</a></p>`;
            void sendTransactionalMail({
                to: assigneeEmail,
                subject,
                html: brandEmailWrapper(inner),
            });
        }

        return NextResponse.json({
            message: 'Evaluation submitted successfully',
            updated: { taskId: taskIdToUpdate ?? updateTaskId ?? null, parentId: parentIdForRecalc ?? null, parentProgress, parentUpdated },
            appliedCompleteScore,
            delayedHodNoteApplied,
        });
    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
            console.log('Department Evaluations PUT: Unauthorized access attempt (session expired)');
        } else {
            console.error('Department Evaluations PUT Error:', error);
        }
        return NextResponse.json(
            { message: error.message || 'Error submitting evaluation', detail: error.message },
            { status: (error.message === 'Unauthorized' || error.message === 'Invalid token') ? 401 : 500 }
        );
    }
}
