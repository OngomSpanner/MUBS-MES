'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — Activity Tracking was removed; send users to Reports. */
export default function TrackingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin?pg=reports');
  }, [router]);

  return null;
}
