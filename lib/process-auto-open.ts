import { query } from '@/lib/db';
import { inPlaceholders } from '@/lib/department-head';
import { addDurationToStartDate } from '@/lib/process-duration';

const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * After a process step (staff_process_assignments row) is fully complete,
 * open the next step on the same activity + standard (by standard_processes.step_order).
 */
export async function autoOpenNextProcessStepAfterCompletion(
    completedAssignmentId: number,
    departmentIds: number[]
): Promise<void> {
    if (!Number.isFinite(completedAssignmentId) || completedAssignmentId <= 0 || departmentIds.length === 0) {
        return;
    }
    const placeholders = inPlaceholders(departmentIds.length);

    const cur = (await query({
        query: `
            SELECT spa.activity_id, sp.step_order, st.id AS standard_id
            FROM staff_process_assignments spa
            JOIN strategic_activities sa ON spa.activity_id = sa.id
            JOIN standard_processes sp ON spa.standard_process_id = sp.id
            JOIN standards st ON sp.standard_id = st.id
            WHERE spa.id = ? AND sa.department_id IN (${placeholders})
        `,
        values: [completedAssignmentId, ...departmentIds],
    })) as { activity_id: number; step_order: number; standard_id: number }[];

    if (!cur[0]) return;
    const { activity_id, step_order, standard_id } = cur[0];

    const nextRows = (await query({
        query: `
            SELECT spa.id, spa.start_date, st2.duration_value, st2.duration_unit
            FROM staff_process_assignments spa
            JOIN strategic_activities sa ON spa.activity_id = sa.id
            JOIN standard_processes sp2 ON spa.standard_process_id = sp2.id
            JOIN standards st2 ON sp2.standard_id = st2.id
            WHERE spa.activity_id = ?
              AND st2.id = ?
              AND sp2.step_order > ?
              AND sa.department_id IN (${placeholders})
            ORDER BY sp2.step_order ASC, spa.id ASC
            LIMIT 1
        `,
        values: [activity_id, standard_id, step_order, ...departmentIds],
    })) as { id: number; start_date: string | null; duration_value: number | null; duration_unit: string | null }[];

    if (!nextRows[0]) return;
    const next = nextRows[0];
    if (next.start_date != null && String(next.start_date).trim() !== '') return;
    if (next.duration_value == null || !String(next.duration_unit || '').trim()) return;

    const startDate = toYMD(new Date());
    const endDate = addDurationToStartDate(startDate, next.duration_value, next.duration_unit);

    await query({
        query: `UPDATE staff_process_assignments SET start_date = ?, end_date = ?, status = 'in_progress' WHERE id = ?`,
        values: [startDate, endDate, next.id],
    });
}

/**
 * For manual open: all prior steps (lower step_order, same activity + standard) must be evaluated or completed.
 */
export async function assertPriorProcessStepsComplete(
    assignmentId: number,
    departmentIds: number[]
): Promise<{ ok: true } | { ok: false; message: string }> {
    const placeholders = inPlaceholders(departmentIds.length);

    const cur = (await query({
        query: `
            SELECT spa.activity_id, sp.step_order, st.id AS standard_id
            FROM staff_process_assignments spa
            JOIN strategic_activities sa ON spa.activity_id = sa.id
            JOIN standard_processes sp ON spa.standard_process_id = sp.id
            JOIN standards st ON sp.standard_id = st.id
            WHERE spa.id = ? AND sa.department_id IN (${placeholders})
        `,
        values: [assignmentId, ...departmentIds],
    })) as { activity_id: number; step_order: number; standard_id: number }[];

    if (!cur[0]) return { ok: false, message: 'Process assignment not found' };
    const { activity_id, step_order, standard_id } = cur[0];

    const pending = (await query({
        query: `
            SELECT COUNT(*) AS c
            FROM staff_process_assignments spa
            JOIN strategic_activities sa ON spa.activity_id = sa.id
            JOIN standard_processes sp ON spa.standard_process_id = sp.id
            JOIN standards st ON sp.standard_id = st.id
            WHERE spa.activity_id = ?
              AND st.id = ?
              AND sp.step_order < ?
              AND sa.department_id IN (${placeholders})
              AND LOWER(TRIM(COALESCE(spa.status, ''))) NOT IN ('evaluated', 'completed')
        `,
        values: [activity_id, standard_id, step_order, ...departmentIds],
    })) as { c: number }[];

    const n = Number(pending[0]?.c ?? 0);
    if (n > 0) {
        return {
            ok: false,
            message: 'Complete earlier process steps first (they run in order).',
        };
    }
    return { ok: true };
}
