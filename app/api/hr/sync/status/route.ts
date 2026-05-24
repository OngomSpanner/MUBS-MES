import { NextResponse } from 'next/server';
import { requireHrmsAdmin } from '@/lib/hrms-access';
import {
  isMonthlyAutoSyncRunning,
  triggerMonthlyAutoSyncInBackground,
} from '@/lib/hrms/monthly-auto-sync';
import { getHrSyncStatus } from '@/lib/hrms/sync-status';

export async function GET() {
  const auth = await requireHrmsAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const status = await getHrSyncStatus();

    if (status.shouldAutoStartMonthly && !isMonthlyAutoSyncRunning()) {
      triggerMonthlyAutoSyncInBackground();
    }

    return NextResponse.json({
      ...status,
      monthlySyncInProgress: isMonthlyAutoSyncRunning(),
    });
  } catch (error) {
    console.error('HR sync status:', error);
    return NextResponse.json({ message: 'Could not load HR sync status' }, { status: 500 });
  }
}
