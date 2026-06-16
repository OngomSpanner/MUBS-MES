import { query } from '@/lib/db';
import type {
  AdminChangeRequest,
  AmbassadorChangeRequest,
  ChangeRequestCategory,
  ChangeRequestStatus,
} from '@/lib/ambassador/change-request-constants';
export {
  CHANGE_REQUEST_CATEGORIES,
  CHANGE_REQUEST_STATUS_LABELS,
  CHANGE_REQUEST_STATUSES,
  isChangeRequestCategory,
  isChangeRequestStatus,
} from '@/lib/ambassador/change-request-constants';
export type {
  AdminChangeRequest,
  AmbassadorChangeRequest,
  ChangeRequestCategory,
  ChangeRequestStatus,
} from '@/lib/ambassador/change-request-constants';

let ensured = false;

export async function ensureChangeRequestTable(): Promise<void> {
  if (ensured) return;

  await query({
    query: `
      CREATE TABLE IF NOT EXISTS ambassador_change_requests (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        managed_unit_id INT NULL,
        category ENUM('unit_structure', 'indicators', 'activity_templates', 'other') NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status ENUM('submitted', 'under_review', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'submitted',
        admin_notes TEXT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_change_requests_user (user_id),
        KEY idx_change_requests_unit (managed_unit_id),
        KEY idx_change_requests_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
  });

  ensured = true;
}

export async function listChangeRequestsForUser(userId: number): Promise<AmbassadorChangeRequest[]> {
  await ensureChangeRequestTable();

  const rows = (await query({
    query: `
      SELECT id, user_id, managed_unit_id, category, title, description, status, admin_notes,
             created_at, updated_at
      FROM ambassador_change_requests
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
    `,
    values: [userId],
  })) as {
    id: number;
    user_id: number;
    managed_unit_id: number | null;
    category: ChangeRequestCategory;
    title: string;
    description: string;
    status: ChangeRequestStatus;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    managedUnitId: r.managed_unit_id,
    category: r.category,
    title: r.title,
    description: r.description,
    status: r.status,
    adminNotes: r.admin_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createChangeRequest(input: {
  userId: number;
  managedUnitId: number | null;
  category: ChangeRequestCategory;
  title: string;
  description: string;
}): Promise<number> {
  await ensureChangeRequestTable();

  const result = (await query({
    query: `
      INSERT INTO ambassador_change_requests
        (user_id, managed_unit_id, category, title, description, status)
      VALUES (?, ?, ?, ?, ?, 'submitted')
    `,
    values: [input.userId, input.managedUnitId, input.category, input.title, input.description],
  })) as { insertId?: number };

  return Number(result.insertId ?? 0);
}

type ChangeRequestRow = {
  id: number;
  user_id: number;
  managed_unit_id: number | null;
  category: ChangeRequestCategory;
  title: string;
  description: string;
  status: ChangeRequestStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

type AdminChangeRequestRow = ChangeRequestRow & {
  ambassador_name: string | null;
  ambassador_email: string | null;
  managed_unit_name: string | null;
};

function mapAdminChangeRequestRow(r: AdminChangeRequestRow): AdminChangeRequest {
  return {
    ...mapChangeRequestRow(r),
    ambassadorName: String(r.ambassador_name || '').trim() || 'Unknown ambassador',
    ambassadorEmail: String(r.ambassador_email || '').trim(),
    managedUnitName: String(r.managed_unit_name || '').trim() || 'Unknown unit',
  };
}

function mapChangeRequestRow(r: ChangeRequestRow): AmbassadorChangeRequest {
  return {
    id: r.id,
    userId: r.user_id,
    managedUnitId: r.managed_unit_id,
    category: r.category,
    title: r.title,
    description: r.description,
    status: r.status,
    adminNotes: r.admin_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function departmentScopeClause(departmentIds: number[]): { clause: string; values: number[] } {
  if (!departmentIds.length) {
    return { clause: 'AND 1=0', values: [] };
  }
  const placeholders = departmentIds.map(() => '?').join(', ');
  return {
    clause: `AND r.managed_unit_id IN (${placeholders})`,
    values: departmentIds,
  };
}

export async function listChangeRequestsForDepartmentReview(
  departmentIds: number[],
  statusFilter?: ChangeRequestStatus
): Promise<AdminChangeRequest[]> {
  await ensureChangeRequestTable();

  const values: (number | string)[] = [];
  let statusClause = '';
  if (statusFilter) {
    statusClause = 'AND r.status = ?';
    values.push(statusFilter);
  }

  const scope = departmentScopeClause(departmentIds);
  values.push(...scope.values);

  const rows = (await query({
    query: `
      SELECT r.id, r.user_id, r.managed_unit_id, r.category, r.title, r.description, r.status, r.admin_notes,
             r.created_at, r.updated_at,
             u.full_name AS ambassador_name,
             u.email AS ambassador_email,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS managed_unit_name
      FROM ambassador_change_requests r
      INNER JOIN users u ON u.id = r.user_id
      LEFT JOIN departments d ON d.id = r.managed_unit_id
      WHERE 1=1 ${statusClause} ${scope.clause}
      ORDER BY r.created_at DESC, r.id DESC
    `,
    values,
  })) as AdminChangeRequestRow[];

  return rows.map(mapAdminChangeRequestRow);
}

export async function getChangeRequestForDepartmentReview(
  id: number,
  departmentIds: number[]
): Promise<AdminChangeRequest | null> {
  await ensureChangeRequestTable();

  const scope = departmentScopeClause(departmentIds);
  const values = [id, ...scope.values];

  const rows = (await query({
    query: `
      SELECT r.id, r.user_id, r.managed_unit_id, r.category, r.title, r.description, r.status, r.admin_notes,
             r.created_at, r.updated_at,
             u.full_name AS ambassador_name,
             u.email AS ambassador_email,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS managed_unit_name
      FROM ambassador_change_requests r
      INNER JOIN users u ON u.id = r.user_id
      LEFT JOIN departments d ON d.id = r.managed_unit_id
      WHERE r.id = ? ${scope.clause}
      LIMIT 1
    `,
    values,
  })) as AdminChangeRequestRow[];

  const r = rows[0];
  if (!r) return null;

  return mapAdminChangeRequestRow(r);
}

export async function updateChangeRequestReview(
  id: number,
  input: { status: ChangeRequestStatus; adminNotes: string | null }
): Promise<boolean> {
  await ensureChangeRequestTable();

  const result = (await query({
    query: `
      UPDATE ambassador_change_requests
      SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    values: [input.status, input.adminNotes, id],
  })) as { affectedRows?: number };

  return Number(result.affectedRows ?? 0) > 0;
}
