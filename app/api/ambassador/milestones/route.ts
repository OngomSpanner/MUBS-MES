import { NextResponse } from 'next/server';
import { requireAmbassador } from '@/lib/ambassador/context';
import { listManagedUnitMilestoneActivities } from '@/lib/ambassador/milestone-overview';

export async function GET() {
  try {
    const ctx = await requireAmbassador();
    if ('error' in ctx) return ctx.error;

    const activities = await listManagedUnitMilestoneActivities(ctx.managedUnitId);

    return NextResponse.json({
      managedUnitName: ctx.managedUnitName,
      activities,
      totalActivities: activities.length,
      totalPendingTasks: activities.reduce((sum, a) => sum + a.pendingTasks, 0),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Ambassador milestones GET error:', error);
    return NextResponse.json(
      { message: 'Error loading milestone progress', detail: message },
      { status: 500 }
    );
  }
}
