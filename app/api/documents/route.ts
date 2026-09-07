import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { ensureDocumentsTable } from '@/lib/documents-schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    await ensureDocumentsTable();

    const documents = await query({
      query: `SELECT id, title, description, category, file_url, original_filename, file_size, created_at
              FROM staff_documents ORDER BY created_at DESC`,
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('documents GET', error);
    return NextResponse.json({ message: 'Error loading documents' }, { status: 500 });
  }
}
