import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

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
      SELECT u.id, u.full_name, u.email, u.role, u.status, u.department_id,
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
    const { full_name, email, password, role, department_id } = body;

    if (!full_name || !email || !role) {
      return NextResponse.json(
        { message: 'Full name, email and at least one role are required' },
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

    const result = await query({
      query: 'INSERT INTO users (full_name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      values: [full_name, email, hashedPassword, roleStr, departmentId, 'Active']
    });

    const newUserId = (result as any).insertId;
    const roleList = roleStr.split(',').map((r: string) => r.trim()).filter(Boolean);

    for (const r of roleList) {
      await query({
        query: 'INSERT INTO user_roles (user_id, role, assigned_by) VALUES (?, ?, ?)',
        values: [newUserId, r, assignedBy]
      });
    }

    return NextResponse.json({
      message: 'User created successfully',
      userId: newUserId
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { message: 'Error creating user' },
      { status: 500 }
    );
  }
}