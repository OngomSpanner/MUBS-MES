import { query } from '@/lib/db';

let ensured = false;

export async function ensureDocumentsTable(): Promise<void> {
  if (ensured) return;

  await query({
    query: `CREATE TABLE IF NOT EXISTS staff_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      category VARCHAR(100) NULL,
      file_url VARCHAR(500) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      file_size INT NULL,
      uploaded_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  });

  const rows = (await query({
    query: 'SELECT COUNT(*) as c FROM staff_documents',
  })) as { c: number }[];

  if (rows[0].c === 0) {
    await query({
      query: `INSERT INTO staff_documents
              (title, description, category, file_url, original_filename, file_size)
              VALUES (?, ?, ?, ?, ?, ?)`,
      values: [
        'Fourth National Development Plan (NDP-IV)',
        'National Planning Authority strategic framework guiding national development priorities.',
        'National Policy',
        '/documents/fourth-national-development-plan-ndp-iv.pdf',
        'fourth-national-development-plan-ndp-iv.pdf',
        496693,
      ],
    });
  }

  ensured = true;
}
