import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { normalizeRoleForCookie } from '@/lib/role-routing';

export type ActionActor = {
  userId: number;
  fullName: string;
  role: string;
  isStrategy: boolean;
  isHod: boolean;
  isStaff: boolean;
  departmentId: number | null;
  managedUnitId: number | null;
};

export async function getActionActor(): Promise<ActionActor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId) return null;

  const rows = (await query({
    query: `SELECT id, full_name, role, department_id, managed_unit_id, status
            FROM users WHERE id = ? LIMIT 1`,
    values: [decoded.userId],
  })) as {
    id: number;
    full_name: string;
    role: string;
    department_id: number | null;
    managed_unit_id: number | null;
    status: string;
  }[];
  const user = rows[0];
  if (!user || String(user.status) !== 'Active') return null;

  const role = normalizeRoleForCookie(decoded.role || user.role);
  const isStrategy = role === 'System Administrator' || role === 'Strategy Manager';
  const isHod = role === 'HOD';
  return {
    userId: Number(user.id),
    fullName: String(user.full_name || ''),
    role,
    isStrategy,
    isHod,
    isStaff: !isStrategy,
    departmentId: user.department_id != null ? Number(user.department_id) : null,
    managedUnitId: user.managed_unit_id != null ? Number(user.managed_unit_id) : null,
  };
}

export async function unitScopeIds(actor: ActionActor): Promise<number[]> {
  const root = actor.managedUnitId || actor.departmentId;
  if (!root) return [];
  const rows = (await query({
    query: 'SELECT id FROM departments WHERE id = ? OR parent_id = ?',
    values: [root, root],
  })) as { id: number }[];
  return rows.map((r) => Number(r.id));
}

export async function canEditTeam(actor: ActionActor, teamId: number): Promise<boolean> {
  if (actor.isStrategy) return true;
  if (!actor.isHod) return false;
  const teams = (await query({
    query: 'SELECT kind, department_id FROM action_teams WHERE id = ? LIMIT 1',
    values: [teamId],
  })) as { kind: string; department_id: number | null }[];
  const team = teams[0];
  if (!team) return false;
  if (String(team.kind) !== 'departmental') return false;
  const scope = await unitScopeIds(actor);
  return team.department_id != null && scope.includes(Number(team.department_id));
}

export async function canAssignOnTeam(actor: ActionActor, teamId: number): Promise<boolean> {
  if (await canEditTeam(actor, teamId)) return true;
  if (actor.isStrategy) return true;
  const members = (await query({
    query: `SELECT is_secretariat FROM action_team_members
            WHERE team_id = ? AND user_id = ? LIMIT 1`,
    values: [teamId, actor.userId],
  })) as { is_secretariat: number }[];
  return members.length > 0;
}

export async function visibleTeamIds(actor: ActionActor): Promise<number[] | 'all'> {
  if (actor.isStrategy) return 'all';
  const ids = new Set<number>();
  const asMember = (await query({
    query: 'SELECT team_id FROM action_team_members WHERE user_id = ?',
    values: [actor.userId],
  })) as { team_id: number }[];
  for (const row of asMember) ids.add(Number(row.team_id));

  const assigned = (await query({
    query: 'SELECT DISTINCT team_id FROM action_items WHERE assignee_user_id = ?',
    values: [actor.userId],
  })) as { team_id: number }[];
  for (const row of assigned) ids.add(Number(row.team_id));

  if (actor.isHod) {
    const scope = await unitScopeIds(actor);
    if (scope.length) {
      const placeholders = scope.map(() => '?').join(',');
      const officeTeams = (await query({
        query: `SELECT DISTINCT team_id FROM action_team_members WHERE department_id IN (${placeholders})
                UNION
                SELECT DISTINCT team_id FROM action_items WHERE office_department_id IN (${placeholders})
                UNION
                SELECT id FROM action_teams WHERE kind = 'departmental' AND department_id IN (${placeholders})`,
        values: [...scope, ...scope, ...scope],
      })) as { team_id?: number; id?: number }[];
      for (const row of officeTeams) ids.add(Number(row.team_id ?? row.id));
    }
  }
  return [...ids];
}
