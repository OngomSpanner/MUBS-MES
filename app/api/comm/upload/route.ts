import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'png', 'jpeg', 'jpg', 'xls', 'xlsx'];

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        const decoded = verifyToken(token) as any;
        if (!decoded?.userId) return NextResponse.json({ message: 'Invalid token' }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file || file.size === 0) {
            return NextResponse.json({ message: 'No file provided' }, { status: 400 });
        }
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ message: 'File too large (max 20MB)' }, { status: 400 });
        }
        const ext = (file.name || '').split('.').pop()?.toLowerCase();
        if (!ext || !ALLOWED_EXT.includes(ext)) {
            return NextResponse.json({ message: 'File type not allowed. Use: PDF, DOC, DOCX, PNG, JPEG, XLS, XLSX' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const uniqueFilename = `${Date.now()}-${safeName}`;
        const filepath = path.join(uploadDir, uniqueFilename);
        await writeFile(filepath, buffer);
        const filePath = `/uploads/${uniqueFilename}`;
        return NextResponse.json({ path: filePath, name: file.name });
    } catch (error: any) {
        console.error('Comm upload error:', error);
        return NextResponse.json(
            { message: 'Upload failed', detail: error.message },
            { status: 500 }
        );
    }
}
