import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { unlink } from 'fs/promises';
import path from 'path';
import { verifyToken } from '@/lib/auth';
import { canManageStrategicStandards } from '@/lib/role-routing';
import { query } from '@/lib/db';
import { ensureDocumentsTable } from '@/lib/documents-schema';

export const dynamic = 'force-dynamic';

async function requireDocumentManager() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token) as { userId?: number; role?: string } | null;
  if (!decoded?.userId || !canManageStrategicStandards(decoded.role)) return null;
  return decoded;
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireDocumentManager();
    if (!admin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await ensureDocumentsTable();

    const { id } = await context.params;
    const rows = (await query({
      query: 'SELECT file_url FROM staff_documents WHERE id = ?',
      values: [id],
    })) as { file_url: string }[];

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const fileUrl = rows[0].file_url;
    if (fileUrl.startsWith('/api/uploads/')) {
      const filename = fileUrl.replace('/api/uploads/', '');
      if (/^[a-zA-Z0-9._-]+$/.test(filename)) {
        const filepath = path.join(process.cwd(), 'public/uploads', filename);
        await unlink(filepath).catch(() => {});
      }
    }

    await query({ query: 'DELETE FROM staff_documents WHERE id = ?', values: [id] });

    return NextResponse.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('admin documents DELETE', error);
    return NextResponse.json({ message: 'Error deleting document' }, { status: 500 });
  }
}
