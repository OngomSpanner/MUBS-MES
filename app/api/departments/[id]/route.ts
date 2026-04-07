import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token) as any;
        if (!decoded) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const roles = typeof decoded.role === 'string' ? decoded.role.split(',') : (Array.isArray(decoded.role) ? decoded.role : []);
        const hasAccess = roles.some((r: string) => {
            const role = r.trim().toLowerCase();
            return role === 'system_admin' || role === 'system administrator' || 
                   role === 'strategy_manager' || role === 'strategy manager';
        });

        if (!hasAccess) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, code, unit_type, parent_id, description, is_active } = body;

        if (!name || !code) {
            return NextResponse.json({ message: 'Name and code are required' }, { status: 400 });
        }

        await query({
            query: `UPDATE departments 
                    SET name = ?, code = ?, unit_type = ?, parent_id = ?, description = ?, is_active = ?
                    WHERE id = ?`,
            values: [name, code, unit_type, parent_id || null, description || null, is_active ?? 1, id]
        });

        return NextResponse.json({ message: 'Department updated successfully' });

    } catch (error: any) {
        console.error('Update Department API Error:', error);
        return NextResponse.json(
            { message: 'Error updating department', error: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const decoded = verifyToken(token) as any;
        if (!decoded) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const roles = typeof decoded.role === 'string' ? decoded.role.split(',') : (Array.isArray(decoded.role) ? decoded.role : []);
        const hasAccess = roles.some((r: string) => {
            const role = r.trim().toLowerCase();
            return role === 'system_admin' || role === 'system administrator' || 
                   role === 'strategy_manager' || role === 'strategy manager';
        });

        if (!hasAccess) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Before deleting, nullify department_id in users to prevent orphan references
        await query({
            query: "UPDATE users SET department_id = NULL WHERE department_id = ?",
            values: [id]
        });

        const result = await query({
            query: "DELETE FROM departments WHERE id = ?",
            values: [id]
        }) as any;

        if (result.affectedRows === 0) {
            return NextResponse.json({ message: 'Department not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Department deleted successfully' });

    } catch (error: any) {
        console.error('Delete Department API Error:', error);
        return NextResponse.json(
            { message: 'Error deleting department', detail: error.message },
            { status: 500 }
        );
    }
}
