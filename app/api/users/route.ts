import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { isCommitteeType } from '@/lib/committee-types';
import { normalizeStaffCategory } from '@/lib/staff-categories';
import {
  isEmploymentStatus,
  isGender,
  isLeaveStatus,
  normalizeDisabilityPayload,
  normalizeOptionalDate,
  normalizeOptionalString,
} from '@/lib/staff-biodata';
import { normalizeUserAccountStatus } from '@/lib/user-account-status';
import { syncAllIndicatorsForAmbassadorCatalog } from '@/lib/questionnaire/sync-indicator-groups';

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
    const statusParam = searchParams.get('status');
    const departmentIdParam = searchParams.get('department_id');
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 100);
    const offset = (page - 1) * limit;

    let where = ' WHERE 1=1';
    const values: unknown[] = [];

    if (role && role !== 'All Roles') {
      where += ' AND u.role LIKE ?';
      values.push(`%${role}%`);
    }

    if (search) {
      where += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
      values.push(`%${search}%`, `%${search}%`);
    }

    if (statusParam && statusParam !== 'All Statuses') {
      where += ' AND u.status = ?';
      values.push(normalizeUserAccountStatus(statusParam));
    }

    if (departmentIdParam) {
      const departmentId = Number(departmentIdParam);
      if (Number.isFinite(departmentId) && departmentId > 0) {
        // Match the unit itself and any child units (staff are usually on child department rows).
        where += ' AND (u.department_id = ? OR u.department_id IN (SELECT id FROM departments WHERE parent_id = ?))';
        values.push(departmentId, departmentId);
      }
    }

    const fromClause = `
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN departments mu ON u.managed_unit_id = mu.id
      LEFT JOIN departments mp ON mu.parent_id = mp.id
    `;

    const countRows = (await query({
      query: `SELECT COUNT(*) AS total ${fromClause} ${where}`,
      values,
    })) as { total: number }[];

    const total = Number(countRows[0]?.total ?? 0);

    const users = await query({
      query: `
      SELECT u.id, u.full_name, u.email, u.role, u.status, u.department_id, u.managed_unit_id,
             COALESCE(NULLIF(TRIM(d.external_name), ''), d.name) AS department,
             COALESCE(NULLIF(TRIM(mu.external_name), ''), mu.name) AS managed_unit,
             mp.name AS managed_unit_parent,
             DATE_FORMAT(u.created_at, '%d %b %Y') as created_date
      ${fromClause}
      ${where}
      ORDER BY u.id ASC
      LIMIT ${limit} OFFSET ${offset}`,
      values,
    });

    return NextResponse.json({
      users,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
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
    const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
    if (!decoded?.userId) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }
    const callerRole = (decoded.role || '').toLowerCase().replace(/\s+/g, '_');
    if (callerRole !== 'system_admin' && callerRole !== 'system_administrator' && callerRole !== 'strategy_manager') {
      return NextResponse.json({ message: 'Forbidden: admin role required' }, { status: 403 });
    }
    const assignedBy = decoded.userId;

    const body = await request.json();
    const { 
      full_name, email, password, role, department_id, managed_unit_id, committee_types,
      first_name, surname, other_names, employee_id, contract_terms, contract_type, staff_category,
      position, contract_start, contract_end,
      gender, nationality, date_of_birth, date_first_appointment, date_current_appointment,
      date_office_assignment, retirement_date, designation_grade, employment_status, leave_status,
      disability_status, disability_type, workplace_accommodation, special_support_needs,
      status: statusBody,
    } = body;

    const accountStatus = normalizeUserAccountStatus(statusBody);

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

    const genderRaw = gender !== undefined && gender !== null ? String(gender).trim() : '';
    const genderDb = genderRaw === '' ? null : genderRaw;
    if (genderDb && !isGender(genderDb)) {
      return NextResponse.json({ message: 'Invalid gender value.' }, { status: 400 });
    }

    const employmentStatusDb =
      employment_status && isEmploymentStatus(String(employment_status).trim())
        ? String(employment_status).trim()
        : 'active';

    const leaveStatusDb =
      leave_status && isLeaveStatus(String(leave_status).trim())
        ? String(leave_status).trim()
        : 'On Duty';

    const contractStart = normalizeOptionalDate(contract_start);
    const contractEnd = normalizeOptionalDate(contract_end);

    const pwd = normalizeDisabilityPayload({
      disability_status,
      disability_type,
      workplace_accommodation,
      special_support_needs,
    });
    if (pwd.error) {
      return NextResponse.json({ message: pwd.error }, { status: 400 });
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

    // Default temporary password for new users (if none is provided explicitly).
    // NOTE: This is a simple, non-random value intended only for first login,
    // and users are forced to change it immediately afterwards.
    const passwordToHash = password || 'password';
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
                   position, contract_start, contract_end, contract_start_date, contract_end_date,
                   gender, nationality, designation_grade,
                   date_of_birth, date_first_appointment, date_current_appointment,
                   date_office_assignment, retirement_date, employment_status, leave_status,
                   disability_status, disability_type, workplace_accommodation, special_support_needs
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          finalFullName, email, hashedPassword, roleStr, departmentId, managedUnitId, 
          accountStatus, first_name || null, surname || null, other_names || null, 
          employee_id || null, contract_terms || null, contract_type || null, staffCategoryDb,
          position || null, contractStart, contractEnd, contractStart, contractEnd,
          genderDb,
          normalizeOptionalString(nationality, 100),
          normalizeOptionalString(designation_grade, 100),
          normalizeOptionalDate(date_of_birth),
          normalizeOptionalDate(date_first_appointment),
          normalizeOptionalDate(date_current_appointment),
          normalizeOptionalDate(date_office_assignment),
          normalizeOptionalDate(retirement_date),
          employmentStatusDb,
          leaveStatusDb,
          pwd.disability_status,
          pwd.disability_type,
          pwd.workplace_accommodation,
          pwd.special_support_needs,
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
            accountStatus, first_name || null, surname || null, other_names || null, 
            employee_id || null, contract_terms || null, contract_type || null, staffCategoryDb,
            position || null, contractStart, contractEnd
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

    if (roleListNormalized.includes('ambassador') && managedUnitId) {
      try {
        await syncAllIndicatorsForAmbassadorCatalog();
      } catch (syncErr) {
        console.error('sync indicators after ambassador user create', syncErr);
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