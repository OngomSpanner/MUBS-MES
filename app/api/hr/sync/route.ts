import { NextResponse } from 'next/server';
import { requireHrmsAdmin } from '@/lib/hrms-access';
import { query } from '@/lib/db';
import { buildChangedUsersWhere } from '@/lib/hrms/sync-queries';
import { importNewStaffFromHrmsBatch } from '@/lib/hrms/sync-import';
import { syncBatchFromSearchQueries, syncUserFromHrmsSearch } from '@/lib/hrms/sync-user';

export async function POST(request: Request) {
  const auth = await requireHrmsAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const dryRun = Boolean(body.dryRun);
    const scope = body.scope as string | undefined;
    const limit = Math.min(Math.max(parseInt(String(body.limit ?? 50), 10) || 50, 1), 100);
    const offset = Math.max(parseInt(String(body.offset ?? 0), 10) || 0, 0);

    if (scope === 'import_new') {
      const result = await importNewStaffFromHrmsBatch(offset, limit, { dryRun });
      return NextResponse.json({
        scope: 'import_new',
        summary: result,
        pagination: {
          offset,
          limit,
          processed: result.processed,
          total: result.totalInRoster,
          nextOffset: result.nextOffset,
        },
      });
    }

    if (scope === 'database') {
      const onlyChanged = Boolean(body.onlyChanged);
      const changedSinceDays =
        body.changedSinceDays !== undefined
          ? parseInt(String(body.changedSinceDays), 10)
          : parseInt(process.env.HRMS_SYNC_CHANGED_DAYS || '7', 10);

      const where = buildChangedUsersWhere(onlyChanged, changedSinceDays);

      const rows = (await query({
        query: `SELECT email FROM users
                WHERE ${where}
                ORDER BY id ASC
                LIMIT ${limit} OFFSET ${offset}`,
        values: [],
      })) as { email: string }[];

      const countRows = (await query({
        query: `SELECT COUNT(*) AS c FROM users WHERE ${where}`,
        values: [],
      })) as { c: number }[];

      const total = Number(countRows[0]?.c ?? 0);
      const emails = rows.map((r) => String(r.email).trim()).filter(Boolean);

      const delayMs = onlyChanged ? 60 : 120;

      const summary = await syncBatchFromSearchQueries(emails, {
        dryRun,
        createIfMissing: false,
        delayMs,
      });

      return NextResponse.json({
        scope: 'database',
        onlyChanged,
        changedSinceDays,
        summary,
        pagination: {
          offset,
          limit,
          processed: emails.length,
          total,
          nextOffset: offset + emails.length < total ? offset + emails.length : null,
        },
      });
    }

    const q = String(body.query || body.email || body.search || '').trim();
    if (!q || q.length < 3) {
      return NextResponse.json(
        { message: 'scope must be database or import_new, or provide query (min 3 chars)' },
        { status: 400 }
      );
    }

    const result = await syncUserFromHrmsSearch(q, {
      dryRun,
      createIfMissing: body.createIfMissing !== false,
    });
    return NextResponse.json({ result });
  } catch (error) {
    console.error('HR sync:', error);
    return NextResponse.json(
      { message: 'Sync failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
