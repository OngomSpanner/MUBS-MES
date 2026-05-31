import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const userRows = await query({
      query: `SELECT u.id, u.full_name, u.email, u.role, u.department_id, u.managed_unit_id, u.status,
                     u.first_name, u.surname, u.other_names, u.employee_id, u.contract_terms, 
                     u.contract_type, u.staff_category, u.position,
                     u.gender, u.nationality, u.designation_grade,
                     u.employment_status, u.leave_status,
                     DATE_FORMAT(COALESCE(u.contract_start, u.contract_start_date), '%Y-%m-%d') AS contract_start,
                     DATE_FORMAT(COALESCE(u.contract_end, u.contract_end_date), '%Y-%m-%d') AS contract_end,
                     DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS date_of_birth,
                     DATE_FORMAT(u.date_first_appointment, '%Y-%m-%d') AS date_first_appointment,
                     DATE_FORMAT(u.date_current_appointment, '%Y-%m-%d') AS date_current_appointment,
                     DATE_FORMAT(u.date_office_assignment, '%Y-%m-%d') AS date_office_assignment,
                     DATE_FORMAT(u.retirement_date, '%Y-%m-%d') AS retirement_date,
                     u.disability_status, u.disability_type, u.workplace_accommodation, u.special_support_needs,
                     u.faculty_office,
                     COALESCE(d.name, '') AS department,
                     COALESCE(NULLIF(TRIM(mu.external_name), ''), mu.name) AS managed_unit,
                     mp.name AS managed_unit_parent
              FROM users u
              LEFT JOIN departments d ON u.department_id = d.id
              LEFT JOIN departments mu ON u.managed_unit_id = mu.id
              LEFT JOIN departments mp ON mu.parent_id = mp.id
              WHERE u.id = ?`,
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
      position, contract_start, contract_end,
      gender, nationality, date_of_birth, date_first_appointment, date_current_appointment,
      date_office_assignment, retirement_date, designation_grade, employment_status, leave_status,
      disability_status, disability_type, workplace_accommodation, special_support_needs,
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

    if (!finalFullName || !email?.trim() || !role) {
      return NextResponse.json(
        { message: 'Name, email and role are required' },
        { status: 400 }
      );
    }

    const genderRaw = gender !== undefined && gender !== null ? String(gender).trim() : '';
    const genderDb = genderRaw === '' ? null : genderRaw;
    if (genderDb && !isGender(genderDb)) {
      return NextResponse.json({ message: 'Invalid gender value.' }, { status: 400 });
    }

    const employmentStatusRaw =
      employment_status !== undefined && employment_status !== null
        ? String(employment_status).trim()
        : '';
    const employmentStatusDb = employmentStatusRaw === '' ? null : employmentStatusRaw;
    if (employmentStatusDb && !isEmploymentStatus(employmentStatusDb)) {
      return NextResponse.json({ message: 'Invalid employment status.' }, { status: 400 });
    }

    const leaveStatusRaw =
      leave_status !== undefined && leave_status !== null ? String(leave_status).trim() : '';
    const leaveStatusDb = leaveStatusRaw === '' ? null : leaveStatusRaw;
    if (leaveStatusDb && !isLeaveStatus(leaveStatusDb)) {
      return NextResponse.json({ message: 'Invalid leave status.' }, { status: 400 });
    }

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

    const roleStr = typeof role === 'string' ? role : (Array.isArray(role) ? role.join(',') : '');
    const departmentId = department_id !== undefined && department_id !== '' ? Number(department_id) : null;
    const managedUnitId = managed_unit_id !== undefined && managed_unit_id !== '' ? Number(managed_unit_id) : null;
    const accountStatus = normalizeUserAccountStatus(status);

    const updateSql = `
      UPDATE users 
      SET full_name = ?, email = ?, role = ?, department_id = ?, managed_unit_id = ?, 
          status = ?, first_name = ?, surname = ?, other_names = ?, 
          employee_id = ?, contract_terms = ?, contract_type = ?, staff_category = ?,
          position = ?, contract_start = ?, contract_end = ?,
          contract_start_date = ?, contract_end_date = ?,
          gender = ?, nationality = ?, designation_grade = ?,
          date_of_birth = ?, date_first_appointment = ?, date_current_appointment = ?,
          date_office_assignment = ?, retirement_date = ?,
          employment_status = COALESCE(?, employment_status),
          leave_status = COALESCE(?, leave_status),
          disability_status = ?, disability_type = ?,
          workplace_accommodation = ?, special_support_needs = ?
      WHERE id = ?
    `;
    const updateValues = [
      finalFullName, email.trim(), roleStr, departmentId, managedUnitId, 
      accountStatus, first_name || null, surname || null, other_names || null,
      employee_id || null, contract_terms || null, contract_type || null, staffCategoryDb,
      position || null, contractStart, contractEnd,
      contractStart, contractEnd,
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
    const accountStatus = normalizeUserAccountStatus(status);

    await query({
      query: 'UPDATE users SET status = ? WHERE id = ?',
      values: [accountStatus, id]
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