import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Match filenames produced by staff submissions upload (timestamp-name.ext). */
const SAFE_FILENAME = /^[a-zA-Z0-9._-]+$/;

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

function contentTypeFor(filename: string): string {
  const i = filename.lastIndexOf('.');
  if (i < 0) return 'application/octet-stream';
  const ext = filename.slice(i).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filename = segments.join('/');
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return new NextResponse('Bad request', { status: 400 });
  }
  if (!SAFE_FILENAME.test(filename)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const filepath = path.join(uploadsDir, filename);
  const resolvedFile = path.resolve(filepath);
  const resolvedDir = path.resolve(uploadsDir);
  if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const buf = await readFile(resolvedFile);
    const contentType = contentTypeFor(filename);
    const asciiName = filename.replace(/[^\x20-\x7E]/g, '_');
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${asciiName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
