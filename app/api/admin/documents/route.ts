import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { writeFile, mkdir } from 'fs/promises';
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

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt',
]);
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const admin = await requireDocumentManager();
    if (!admin) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await ensureDocumentsTable();

    const formData = await req.formData();
    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    const category = (formData.get('category') as string)?.trim() || null;
    const file = formData.get('file') as File | null;

    if (!title) {
      return NextResponse.json({ message: 'Title is required' }, { status: 400 });
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ message: 'A file is required' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ message: 'Unsupported file type' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ message: 'File too large (max 25MB)' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public/uploads');
    await mkdir(uploadDir, { recursive: true });

    const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, uniqueFilename), buffer);

    const fileUrl = `/api/uploads/${uniqueFilename}`;

    await query({
      query: `INSERT INTO staff_documents
              (title, description, category, file_url, original_filename, file_size, uploaded_by)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [title, description, category, fileUrl, file.name, file.size, admin.userId],
    });

    return NextResponse.json({ message: 'Document uploaded' }, { status: 201 });
  } catch (error) {
    console.error('admin documents POST', error);
    return NextResponse.json({ message: 'Error uploading document' }, { status: 500 });
  }
}
