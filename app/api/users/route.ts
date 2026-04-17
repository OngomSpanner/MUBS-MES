import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { isCommitteeType } from '@/lib/committee-types';
import { normalizeStaffCategory } from '@/lib/staff-categories';

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
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    let sql = `
      SELECT u.id, u.full_name, u.email, u.role, u.status, u.department_id, u.managed_unit_id,
             d.name AS department,
             DATE_FORMAT(u.created_at, '%d %b %Y') as created_date
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1
    `;
    const values: any[] = [];

    if (role && role !== 'All Roles') {
      sql += ' AND u.role LIKE ?';
      values.push(`%${role}%`);
    }

    if (search) {
      sql += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
      values.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY u.created_at DESC LIMIT 50';

    const users = await query({ query: sql, values });
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { message: 'Error fetching users' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const decoded = verifyToken(token) as any;
    const assignedBy = decoded?.userId ?? null;

    const body = await request.json();
    const { 
      full_name, email, password, role, department_id, managed_unit_id, committee_types,
      first_name, surname, other_names, employee_id, contract_terms, contract_type, staff_category,
      position, contract_start, contract_end
    } = body;

    const finalFullName = full_name || `${first_name || ''} ${surname || ''}`.trim();

    const staffCategoryRaw =
      staff_category !== undefined && staff_category !== null ? String(staff_category).trim() : '';
    const staffCategoryDb = normalizeStaffCategory(staff_category);
    if (staffCategoryRaw !== '' && !staffCategoryDb) {
      return NextResponse.json(
        { message: 'Invalid staff category. Use Academic, Administrative, or Support.' },
        { status: 400 }
      );
    }

    if (!finalFullName || !email || !role) {
      return NextResponse.json(
        { message: 'Name (Full or First/Surname), email and at least one role are required' },
        { status: 400 }
      );
    }

    const existing = await query({
      query: 'SELECT id FROM users WHERE email = ?',
      values: [email]
    });

    if ((existing as any[]).length > 0) {
      return NextResponse.json(
        { message: 'User already exists' },
        { status: 400 }
      );
    }

    const passwordToHash = password || 'Welcome@2025';
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);

    const roleStr = typeof role === 'string' ? role : (Array.isArray(role) ? role.join(',') : '');
    const departmentId = department_id != null && department_id !== '' ? Number(department_id) : null;

    // Normalize role values for user_roles.role enum (snake_case: hod, unit_head, strategy_manager, etc.)
    const roleList = roleStr.split(',').map((r: string) => r.trim()).filter(Boolean);
    const managedUnitId = managed_unit_id != null && managed_unit_id !== '' ? Number(managed_unit_id) : null;

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

    let newUserId: number;
    try {
      const result = await query({
        query: `INSERT INTO users (
                   full_name, email, password_hash, role, department_id, managed_unit_id, 
                   status, must_change_password, first_name, surname, other_names, 
                   employee_id, contract_terms, contract_type, staff_category,
                   position, contract_start, contract_end
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          finalFullName, email, hashedPassword, roleStr, departmentId, managedUnitId, 
          'Active', first_name || null, surname || null, other_names || null, 
          employee_id || null, contract_terms || null, contract_type || null, staffCategoryDb,
          position || null, contract_start || null, contract_end || null
        ]
      });
      newUserId = (result as any).insertId;
    } catch (insertError: any) {
      const msg = (insertError?.message || String(insertError)).toLowerCase();
      if (msg.includes('must_change_password') || msg.includes('unknown column')) {
        const result = await query({
          query: `INSERT INTO users (
                     full_name, email, password_hash, role, department_id, managed_unit_id, 
                     status, first_name, surname, other_names, 
                     employee_id, contract_terms, contract_type, staff_category,
                     position, contract_start, contract_end
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            finalFullName, email, hashedPassword, roleStr, departmentId, managedUnitId, 
            'Active', first_name || null, surname || null, other_names || null, 
            employee_id || null, contract_terms || null, contract_type || null, staffCategoryDb,
            position || null, contract_start || null, contract_end || null
          ]
        });
        newUserId = (result as any).insertId;
      } else {
        throw insertError;
      }
    }

    for (const r of roleListNormalized) {
      try {
        await query({
          query: 'INSERT INTO user_roles (user_id, role, assigned_by) VALUES (?, ?, ?)',
          values: [newUserId, r, assignedBy]
        });
      } catch (roleErr: any) {
        const roleMsg = roleErr?.message || String(roleErr);
        console.error('user_roles insert failed for role:', r, roleMsg);
        if (roleMsg.includes('unit_head') || roleMsg.includes('Data truncated') || roleMsg.includes('enum')) {
          return NextResponse.json(
            { message: `Could not assign role "${r}". Run migration add_unit_head_role.sql to enable Unit Head, or choose a different role.` },
            { status: 500 }
          );
        }
        throw roleErr;
      }
    }

    // Committee assignments for committee_member role
    const hasCommitteeRole = roleListNormalized.some((r: string) => r === 'committee_member');
    if (hasCommitteeRole && Array.isArray(committee_types) && committee_types.length > 0) {
      const validCommittees = committee_types
        .map((c: unknown) => (typeof c === 'string' ? c.trim() : ''))
        .filter((c: string) => c && isCommitteeType(c));
      for (const ct of validCommittees) {
        try {
          await query({
            query: 'INSERT INTO user_committee_assignments (user_id, committee_type) VALUES (?, ?)',
            values: [newUserId, ct]
          });
        } catch (e: any) {
          if (e?.code !== 'ER_NO_SUCH_TABLE') console.error('user_committee_assignments insert:', e);
        }
      }
    }

    return NextResponse.json({
      message: 'User created successfully',
      userId: newUserId
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    const msg = error?.message || String(error);
    return NextResponse.json(
      { message: 'Error creating user', detail: msg },
      { status: 500 }
    );
  }
}