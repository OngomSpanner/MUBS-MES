import { NextResponse } from 'next/server';

/**
 * Use in debug, migration, and seed API routes.
 * In production, returns 404 so these endpoints are disabled.
 * In development, returns null and the route handler continues.
 */
export function disallowInProduction(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });
  }
  return null;
}
