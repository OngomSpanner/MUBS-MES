import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
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
        const unitsOnly = searchParams.get('units_only') === 'true' || searchParams.get('units_only') === '1';
        const parentsOnly = searchParams.get('parents_only') === 'true' || searchParams.get('parents_only') === '1';
        
        let departments: any[];
        try {
            let sql = `
                SELECT d.id, d.name, d.code, d.unit_type, d.parent_id, d.is_active, d.external_name,
                       p.name as parent_name
                FROM departments d
                LEFT JOIN departments p ON d.parent_id = p.id
            `;
            
            if (parentsOnly) {
                sql += " WHERE d.is_active = 1 AND d.parent_id IS NULL";
            } else if (unitsOnly) {
                sql += " WHERE d.is_active = 1 AND d.unit_type IN ('department', 'unit')";
            }
            
            sql += " ORDER BY d.parent_id IS NULL DESC, d.name ASC";

            departments = await query({
                query: sql,
                values: []
            }) as any[];
        } catch (e: any) {
            console.error('Error fetching departments with join:', e);
            departments = await query({
                query: 'SELECT id, name, parent_id FROM departments ORDER BY name ASC',
                values: []
            }) as any[];
        }

        return NextResponse.json(departments);

    } catch (error: any) {
        console.error('Departments API Error:', error);
        return NextResponse.json(
            { message: 'Error fetching departments', detail: error.message },
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
        const { name, code, unit_type, parent_id, description } = body;

        if (!name || !code) {
            return NextResponse.json({ message: 'Name and code are required' }, { status: 400 });
        }

        const result = await query({
            query: `INSERT INTO departments (name, code, unit_type, parent_id, description, is_active, created_at, external_name)
                    VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?)`,
            values: [name, code, unit_type || 'department', parent_id || null, description || null, name]
        }) as any;

        return NextResponse.json({ 
            message: 'Department created successfully', 
            id: result.insertId 
        });

    } catch (error: any) {
        console.error('Create Department API Error:', error);
        return NextResponse.json(
            { message: 'Error creating department', detail: error.message },
            { status: 500 }
        );
    }
}
