import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { applyHodAssignmentRows, parseHodAssignmentWorkbook } from '@/lib/users/bulk-hod-assignment';

export async function POST(request: Request) {
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

    const form = await request.formData();
    const file = form.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ message: 'Upload an Excel file (.xlsx)' }, { status: 400 });
    }

    const name = file instanceof File ? file.name : '';
    if (name && !name.toLowerCase().endsWith('.xlsx') && !name.toLowerCase().endsWith('.xls')) {
      return NextResponse.json({ message: 'Only .xlsx or .xls files are supported' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseHodAssignmentWorkbook(buffer);
    if (rows.length === 0) {
      return NextResponse.json(
        { message: 'No assignment rows found. Use the Assignments sheet and fill at least one row.' },
        { status: 400 }
      );
    }

    const results = await applyHodAssignmentRows(rows);
    const updated = results.filter((r) => r.status === 'updated').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({
      message: `Processed ${results.length} row(s): ${updated} updated, ${errors} error(s).`,
      summary: { total: results.length, updated, errors },
      results,
    });
  } catch (error) {
    console.error('bulk-hod-assignment POST:', error);
    return NextResponse.json({ message: 'Bulk assignment failed' }, { status: 500 });
  }
}
