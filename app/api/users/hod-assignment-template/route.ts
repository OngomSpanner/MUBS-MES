import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  buildHodAssignmentWorkbook,
  fetchDepartmentsForTemplate,
  workbookToBuffer,
} from '@/lib/users/bulk-hod-assignment';

export async function GET() {
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

    const departments = await fetchDepartmentsForTemplate();
    const wb = buildHodAssignmentWorkbook(departments);
    const buffer = workbookToBuffer(wb);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="hod-role-assignment-template.xlsx"',
      },
    });
  } catch (error) {
    console.error('hod-assignment-template GET:', error);
    return NextResponse.json({ message: 'Failed to generate template' }, { status: 500 });
  }
}
