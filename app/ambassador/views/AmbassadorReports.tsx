'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AmbassadorTracking from './AmbassadorTracking';
import AmbassadorReporting from './AmbassadorReporting';

/** @deprecated Legacy wrapper — use AmbassadorTracking or AmbassadorReporting directly. */
export default function AmbassadorReports() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'compliance';

  if (tab === 'compliance') {
    return (
      <Suspense fallback={null}>
        <AmbassadorTracking />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <AmbassadorReporting />
    </Suspense>
  );
}
