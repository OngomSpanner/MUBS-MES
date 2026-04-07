import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const userRows = await query({
      query: `SELECT id, full_name, email, role, department_id, managed_unit_id, status,
                     first_name, surname, other_names, employee_id, contract_terms, 
                     contract_type, staff_category, position,
                     DATE_FORMAT(contract_start, '%Y-%m-%d') as contract_start,
                     DATE_FORMAT(contract_end, '%Y-%m-%d') as contract_end
              FROM users WHERE id = ?`,
      values: [id]
    });

    if (!(userRows as any[]).length) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    const user = (userRows as any[])[0];
    let committees: string[] = [];
    try {
      const rows = (await query({
        query: 'SELECT committee_type FROM user_committee_assignments WHERE user_id = ? ORDER BY committee_type',
        values: [id]
      })) as any[];
      committees = (rows || []).map((r: any) => r.committee_type).filter(Boolean);
    } catch {
      // table may not exist
    }

    return NextResponse.json({ ...user, committees });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { message: 'Error fetching user' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const body = await request.json();
    const { 
      full_name, email, role, department_id, managed_unit_id, status, committee_types,
      first_name, surname, other_names, employee_id, contract_terms, contract_type, staff_category,
      position, contract_start, contract_end
    } = body;

    const finalFullName = full_name || `${first_name || ''} ${surname || ''}`.trim();

    if (!finalFullName || !email?.trim() || !role) {
      return NextResponse.json(
        { message: 'Name, email and role are required' },
        { status: 400 }
      );
    }

    const roleStr = typeof role === 'string' ? role : (Array.isArray(role) ? role.join(',') : '');
    const departmentId = department_id !== undefined && department_id !== '' ? Number(department_id) : null;
    const managedUnitId = managed_unit_id !== undefined && managed_unit_id !== '' ? Number(managed_unit_id) : null;

    const updateSql = `
      UPDATE users 
      SET full_name = ?, email = ?, role = ?, department_id = ?, managed_unit_id = ?, 
          status = ?, first_name = ?, surname = ?, other_names = ?, 
          employee_id = ?, contract_terms = ?, contract_type = ?, staff_category = ?,
          position = ?, contract_start = ?, contract_end = ?
      WHERE id = ?
    `;
    const updateValues = [
      finalFullName, email.trim(), roleStr, departmentId, managedUnitId, 
      status || 'Active', first_name || null, surname || null, other_names || null,
      employee_id || null, contract_terms || null, contract_type || null, staff_category || null,
      position || null, contract_start || null, contract_end || null,
      id
    ];

    await query({
      query: updateSql,
      values: updateValues
    });

    // Sync user_roles table
    const roleList = roleStr.split(',').map((r: string) => r.trim()).filter(Boolean);
    const roleListNormalized = roleList.map((r: string) => {
      const lower = r.toLowerCase().replace(/\s+/g, '_');
      const map: Record<string, string> = {
        'system_administrator': 'system_admin', 'strategy_manager': 'strategy_manager',
        'committee_member': 'committee_member', 'principal': 'principal',
        'department_head': 'department_head', 'unit_head': 'unit_head', 'hod': 'hod',
        'staff': 'staff', 'viewer': 'viewer', 'ambassador': 'ambassador'
      };
      return map[lower] || lower;
    });

    try {
      await query({
        query: 'DELETE FROM user_roles WHERE user_id = ?',
        values: [id]
      });
      for (const r of roleListNormalized) {
        await query({
          query: 'INSERT INTO user_roles (user_id, role) VALUES (?, ?)',
          values: [id, r]
        });
      }
    } catch (roleErr) {
      console.error('user_roles sync failed during PUT:', roleErr);
    }

    // Sync committee assignments when provided
    if (Array.isArray(committee_types)) {
      try {
        await query({
          query: 'DELETE FROM user_committee_assignments WHERE user_id = ?',
          values: [id]
        });
        const { isCommitteeType } = await import('@/lib/committee-types');
        const valid = committee_types
          .map((c: unknown) => (typeof c === 'string' ? c.trim() : ''))
          .filter((c: string) => c && isCommitteeType(c));
        for (const ct of valid) {
          await query({
            query: 'INSERT INTO user_committee_assignments (user_id, committee_type) VALUES (?, ?)',
            values: [id, ct]
          });
        }
      } catch (e: any) {
        if (e?.code !== 'ER_NO_SUCH_TABLE') console.error('user_committee_assignments update:', e);
      }
    }

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { message: 'Error updating user' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { status } = await request.json();

    await query({
      query: 'UPDATE users SET status = ? WHERE id = ?',
      values: [status, id]
    });

    return NextResponse.json({ message: 'User status updated successfully' });
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { message: 'Error updating user status' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await query({
      query: 'DELETE FROM users WHERE id = ?',
      values: [id]
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { message: 'Error deleting user' },
      { status: 500 }
    );
  }
}