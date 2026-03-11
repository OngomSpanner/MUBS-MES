import { query } from '@/lib/db';

/**
 * Returns department IDs the HOD can see: their department, plus parent (if in a sub-department)
 * or all child departments (if at faculty/root level). Used so Faculty of Commerce HOD sees
 * activities for the faculty and all its units (Accounting, Finance, etc.).
 */
export async function getVisibleDepartmentIds(userId: number): Promise<number[]> {
    const users = await query({
        query: 'SELECT department_id FROM users WHERE id = ?',
        values: [userId]
    }) as any[];
    const departmentId = users[0]?.department_id;
    if (!departmentId) return [];

    const depts = await query({
        query: 'SELECT id, parent_id FROM departments WHERE id = ?',
        values: [departmentId]
    }) as any[];
    if (depts.length === 0) return [departmentId];

    const parentId = depts[0].parent_id;

    if (parentId != null) {
        return [departmentId, parentId];
    }

    const children = await query({
        query: 'SELECT id FROM departments WHERE parent_id = ? AND is_active = 1',
        values: [departmentId]
    }) as any[];
    const childIds = (children || []).map((r: any) => r.id);
    return [departmentId, ...childIds];
}

/** Build placeholders for IN clause: "?,?,?" */
export function inPlaceholders(count: number): string {
    return Array(count).fill('?').join(',');
}
