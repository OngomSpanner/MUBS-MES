import { NextResponse } from 'next/server';
import { tryRunMonthlyAutoSync } from '@/lib/hrms/monthly-auto-sync';
import { getHrSyncStatus } from '@/lib/hrms/sync-status';
import { isLastDayOfMonth } from '@/lib/hrms/sync-schedule';

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.HRMS_CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return request.headers.get('x-cron-secret') === secret;
}

/**
 * Monthly HR sync — optional external cron on the last day of each month.
 * POST or GET with Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: Request) {
  return handleMonthlySync(request);
}

export async function GET(request: Request) {
  return handleMonthlySync(request);
}

async function handleMonthlySync(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (!isLastDayOfMonth()) {
    const status = await getHrSyncStatus();
    return NextResponse.json({
      skipped: true,
      reason: 'Not the last day of the month',
      nextMonthlySync: status.nextMonthlySync,
      nextMonthlySyncLabel: status.nextMonthlySyncLabel,
    });
  }

  try {
    const result = await tryRunMonthlyAutoSync();
    if (!result.ran) {
      return NextResponse.json({ skipped: true, reason: result.reason });
    }
    return NextResponse.json({
      ok: true,
      scope: 'monthly_auto',
      total: result.total,
      updated: result.updated,
      skippedNotInHr: result.skippedNotInHr,
      errors: result.errorCount,
    });
  } catch (error) {
    console.error('Monthly HR sync failed:', error);
    return NextResponse.json(
      {
        message: 'Monthly sync failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
