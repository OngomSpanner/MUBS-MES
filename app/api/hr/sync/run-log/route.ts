import { NextResponse } from 'next/server';
import { requireHrmsAdmin } from '@/lib/hrms-access';
import { recordHrSyncRunComplete, recordHrSyncRunStart } from '@/lib/hrms/sync-status';

export async function POST(request: Request) {
  const auth = await requireHrmsAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'start') {
      const runType = String(body.runType || 'manual');
      const runId = await recordHrSyncRunStart(runType);
      return NextResponse.json({ runId });
    }

    if (action === 'complete') {
      const runId = body.runId != null ? Number(body.runId) : null;
      await recordHrSyncRunComplete(runId, {
        updated: Number(body.updated ?? 0),
        skippedNotInHr: Number(body.skippedNotInHr ?? 0),
        errorCount: Number(body.errorCount ?? 0),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: 'action must be start or complete' }, { status: 400 });
  } catch (error) {
    console.error('HR sync run-log:', error);
    return NextResponse.json({ message: 'Could not record sync run' }, { status: 500 });
  }
}
