import { NextResponse } from 'next/server';
import { tryRunAmbassadorAutoReminders } from '@/lib/ambassador-report-auto-reminders';

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.AMBASSADOR_CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return request.headers.get('x-cron-secret') === secret;
}

/** External cron for weekly ambassador reporting reminders. POST/GET with Bearer CRON_SECRET. */
export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get('force') === '1';

  try {
    const result = await tryRunAmbassadorAutoReminders(force);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Ambassador auto-reminders cron failed:', error);
    return NextResponse.json(
      { message: 'Reminder job failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
