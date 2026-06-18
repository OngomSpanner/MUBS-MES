'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DepartmentTeachingData from './DepartmentTeachingData';

export default function DepartmentTeachingDataGate() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/department-head/profile')
      .then((r) => (r.ok ? r.json() : { hasAcademicTeachingScope: false }))
      .then((data: { hasAcademicTeachingScope?: boolean }) => {
        if (cancelled) return;
        if (data.hasAcademicTeachingScope) setAllowed(true);
        else router.replace('/department-head?pg=dashboard');
      })
      .catch(() => {
        if (!cancelled) router.replace('/department-head?pg=dashboard');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (allowed !== true) {
    return <div className="text-muted small py-4">Loading…</div>;
  }

  return <DepartmentTeachingData />;
}
