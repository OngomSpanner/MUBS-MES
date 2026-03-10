import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await query({
      query: 'SELECT id, full_name, email, role, department_id, status FROM users WHERE id = ?',
      values: [id]
    });

    if (!(user as any[]).length) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json((user as any[])[0]);
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
    const body = await request.json();
    const { full_name, email, role, department_id, status } = body;

    if (!full_name || !email || !role || !department_id || !status) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    await query({
      query: 'UPDATE users SET full_name = ?, email = ?, role = ?, department_id = ?, status = ? WHERE id = ?',
      values: [full_name, email, role, department_id, status, id]
    });

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